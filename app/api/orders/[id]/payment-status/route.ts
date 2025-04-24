import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Server-side Supabase client with admin privileges
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

export async function PATCH(
  request: Request,
  context: { params: { id: string } }
) {
  try {
    const id = context.params.id;
    if (!id) {
      return NextResponse.json(
        { error: 'Order ID is required' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { status } = body;

    if (!status || !['pending', 'paid'].includes(status)) {
      return NextResponse.json(
        { error: 'Valid status is required (pending or paid)' },
        { status: 400 }
      );
    }

    // Update the payment status in the database
    const { data, error } = await supabaseAdmin
      .from('one_time_orders')
      .update({ payment_status: status })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating payment status:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    // Return the updated order data
    return NextResponse.json({
      message: 'Payment status updated successfully',
      data
    });
  } catch (error) {
    console.error('Error in update payment status API route:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 