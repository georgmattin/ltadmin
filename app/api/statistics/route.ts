import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { PostgrestFilterBuilder } from '@supabase/postgrest-js';

// Server-side Supabase client with admin privileges
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'all';
    const fromDate = searchParams.get('from');
    const toDate = searchParams.get('to');
    
    let dateFilter: {
      fromDate?: string;
      toDate?: string;
      isCustomRange?: boolean;
      filterField?: string;
      filterValue?: string;
      operator?: string;
    } | null;
    const now = new Date();
    
    // Handle custom date range
    if (fromDate && toDate) {
      dateFilter = {
        fromDate,
        toDate,
        isCustomRange: true
      };
    } else {
      // Handle predefined periods
      switch (period) {
        case 'today':
          // Today's date in YYYY-MM-DD format
          const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
          dateFilter = {
            filterField: 'created_at',
            filterValue: todayStart,
            operator: 'gte'
          };
          break;
        case '7days':
          // Last 7 days
          const sevenDaysAgo = new Date(now);
          sevenDaysAgo.setDate(now.getDate() - 7);
          dateFilter = {
            filterField: 'created_at',
            filterValue: sevenDaysAgo.toISOString(),
            operator: 'gte'
          };
          break;
        case '30days':
          // Last 30 days
          const thirtyDaysAgo = new Date(now);
          thirtyDaysAgo.setDate(now.getDate() - 30);
          dateFilter = {
            filterField: 'created_at',
            filterValue: thirtyDaysAgo.toISOString(),
            operator: 'gte'
          };
          break;
        case '3months':
          // Last 3 months
          const threeMonthsAgo = new Date(now);
          threeMonthsAgo.setMonth(now.getMonth() - 3);
          dateFilter = {
            filterField: 'created_at',
            filterValue: threeMonthsAgo.toISOString(),
            operator: 'gte'
          };
          break;
        case '6months':
          // Last 6 months
          const sixMonthsAgo = new Date(now);
          sixMonthsAgo.setMonth(now.getMonth() - 6);
          dateFilter = {
            filterField: 'created_at',
            filterValue: sixMonthsAgo.toISOString(),
            operator: 'gte'
          };
          break;
        case '1year':
          // Last year
          const oneYearAgo = new Date(now);
          oneYearAgo.setFullYear(now.getFullYear() - 1);
          dateFilter = {
            filterField: 'created_at',
            filterValue: oneYearAgo.toISOString(),
            operator: 'gte'
          };
          break;
        default:
          // All time - no date filter
          dateFilter = null;
          break;
      }
    }

    // Helper function to apply date filter
    const applyDateFilter = (query: PostgrestFilterBuilder<any, any, any>) => {
      if (!dateFilter) {
        return query;
      }
      
      if (dateFilter.isCustomRange && dateFilter.fromDate && dateFilter.toDate) {
        return query
          .gte('created_at', dateFilter.fromDate)
          .lte('created_at', dateFilter.toDate);
      }
      
      if (dateFilter.operator === 'gte' && dateFilter.filterField && dateFilter.filterValue) {
        return query.gte(dateFilter.filterField, dateFilter.filterValue);
      } else if (dateFilter.operator === 'lte' && dateFilter.filterField && dateFilter.filterValue) {
        return query.lte(dateFilter.filterField, dateFilter.filterValue);
      }
      
      return query;
    };

    // Fetch paid orders count
    let paidOrdersQuery = supabaseAdmin
      .from('one_time_orders')
      .select('*', { count: 'exact', head: true })
      .eq('payment_status', 'paid');
    
    paidOrdersQuery = applyDateFilter(paidOrdersQuery);
    const { count: paidOrdersCount, error: paidOrdersError } = await paidOrdersQuery;

    if (paidOrdersError) {
      console.error('Error fetching paid orders count:', paidOrdersError);
      return NextResponse.json({ error: paidOrdersError.message }, { status: 500 });
    }

    // Fetch completed quick analyses count
    let quickAnalysesQuery = supabaseAdmin
      .from('one_time_orders')
      .select('*', { count: 'exact', head: true })
      .eq('qm_status', 'Done');
    
    quickAnalysesQuery = applyDateFilter(quickAnalysesQuery);
    const { count: quickAnalysesCount, error: quickAnalysesError } = await quickAnalysesQuery;

    if (quickAnalysesError) {
      console.error('Error fetching quick analyses count:', quickAnalysesError);
      return NextResponse.json({ error: quickAnalysesError.message }, { status: 500 });
    }

    // Fetch completed full analyses count
    let fullAnalysesQuery = supabaseAdmin
      .from('one_time_orders')
      .select('*', { count: 'exact', head: true })
      .eq('fm_status', 'Done');
    
    fullAnalysesQuery = applyDateFilter(fullAnalysesQuery);
    const { count: fullAnalysesCount, error: fullAnalysesError } = await fullAnalysesQuery;

    if (fullAnalysesError) {
      console.error('Error fetching full analyses count:', fullAnalysesError);
      return NextResponse.json({ error: fullAnalysesError.message }, { status: 500 });
    }

    // Fetch registered users count
    let usersQuery = supabaseAdmin
      .from('profiles')
      .select('*', { count: 'exact', head: true });
    
    // Only apply date filter if it's not "all" period
    if (period !== 'all' || dateFilter?.isCustomRange) {
      usersQuery = applyDateFilter(usersQuery);
    }
    const { count: usersCount, error: usersError } = await usersQuery;

    if (usersError) {
      console.error('Error fetching users count:', usersError);
      return NextResponse.json({ error: usersError.message }, { status: 500 });
    }

    // Return all statistics
    return NextResponse.json({
      paidOrdersCount,
      quickAnalysesCount,
      fullAnalysesCount,
      usersCount,
      period: dateFilter?.isCustomRange ? 'custom' : period
    });
  } catch (error) {
    console.error('Error in statistics API route:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 