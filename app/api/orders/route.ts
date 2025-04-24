import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Server-side Supabase client with admin privileges
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '15');
    
    // Calculate the range based on page and pageSize
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    // Get the total count of orders for pagination
    const { count: totalCount, error: countError } = await supabaseAdmin
      .from('one_time_orders')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error('Error fetching orders count:', countError);
      return NextResponse.json({ error: countError.message }, { status: 500 });
    }

    // Fetch paginated orders
    const { data, error } = await supabaseAdmin
      .from('one_time_orders')
      .select('*')
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      console.error('Error fetching orders:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Return data with pagination info
    return NextResponse.json({
      data,
      pagination: {
        page,
        pageSize,
        totalCount,
        totalPages: Math.ceil((totalCount ?? 0) / pageSize)
      }
    });
  } catch (error) {
    console.error('Error in orders API route:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 