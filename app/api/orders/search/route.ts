import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Server-side Supabase client with admin privileges
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query');
    
    if (!query || query.trim() === '') {
      return NextResponse.json({
        data: [],
        message: 'Search query is required'
      }, { status: 400 });
    }

    // Normalize the query
    const normalizedQuery = query.trim().toLowerCase();
    
    // Check if it might be a UUID (simple pattern check)
    const isUuidLike = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(normalizedQuery) ||
                      normalizedQuery.length >= 8 && /^[0-9a-f-]+$/i.test(normalizedQuery);

    let whereClause = '';
    
    // Build different query conditions based on the input format
    if (isUuidLike) {
      // For UUID-like input, use direct equality for ID
      whereClause = `id.ilike.${normalizedQuery}%`;
    } else {
      // For text fields, use ILIKE operators
      whereClause = `tellija_eesnimi.ilike.%${normalizedQuery}%,` +
                   `tellija_perenimi.ilike.%${normalizedQuery}%,` +
                   `tellija_firma.ilike.%${normalizedQuery}%,` +
                   `company_name.ilike.%${normalizedQuery}%,` +
                   `tellija_epost.ilike.%${normalizedQuery}%`;
    }

    // Count total records matching the query
    let countQuery = supabaseAdmin
      .from('one_time_orders')
      .select('*', { count: 'exact', head: true });
    
    if (isUuidLike) {
      countQuery = countQuery.ilike('id', `${normalizedQuery}%`);
    } else {
      countQuery = countQuery.or(whereClause);
    }
    
    const { count, error: countError } = await countQuery;

    if (countError) {
      console.error('Error counting search results:', countError);
      return NextResponse.json({ error: countError.message }, { status: 500 });
    }

    // Build search query
    let searchQuery = supabaseAdmin
      .from('one_time_orders')
      .select('*')
      .order('created_at', { ascending: false });
      
    if (isUuidLike) {
      searchQuery = searchQuery.ilike('id', `${normalizedQuery}%`);
    } else {
      searchQuery = searchQuery.or(whereClause);
    }
    
    const { data, error } = await searchQuery.limit(100);

    if (error) {
      console.error('Error searching orders:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    let finalResults = data || [];
    let fullTextSearchUsed = false;

    // Only use full text search for non-UUID queries with few results
    if (!isUuidLike && finalResults.length < 5 && normalizedQuery.length > 2) {
      try {
        // Try to use full-text search
        const { data: fullTextData, error: fullTextError } = await supabaseAdmin
          .from('one_time_orders')
          .select('*')
          .textSearch('company_details', normalizedQuery, {
            type: 'plain',  // Use plain for simpler matching
            config: 'english'
          })
          .order('created_at', { ascending: false })
          .limit(50);

        if (!fullTextError && fullTextData && fullTextData.length > 0) {
          // If there were some exact matches, combine the results
          if (finalResults.length > 0) {
            // Create a set of existing IDs to avoid duplicates
            const existingIds = new Set(finalResults.map(item => item.id));
            
            // Add only new items from full text search
            const newItems = fullTextData.filter(item => !existingIds.has(item.id));
            
            finalResults = [...finalResults, ...newItems];
          } else {
            finalResults = fullTextData;
          }
          
          fullTextSearchUsed = true;
        }
      } catch (fullTextError) {
        // If full text search fails, just continue with regular search results
        console.error('Full text search error:', fullTextError);
      }
    }

    return NextResponse.json({
      data: finalResults,
      totalCount: count || finalResults.length,
      fullTextSearchUsed,
      message: 'Search completed successfully'
    });
  } catch (error: any) {
    console.error('Error in search API route:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 