import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Server-side Supabase client with admin privileges
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

export async function POST(request: Request) {
  try {
    const { order_id, customer_name, company_name } = await request.json();

    if (!order_id) {
      return NextResponse.json(
        { error: 'Order ID is required' },
        { status: 400 }
      );
    }

    // First, check if an invoice for this order already exists
    const { data: existingInvoice, error: checkError } = await supabaseAdmin
      .from('invoices')
      .select('id')
      .eq('order_id', order_id)
      .maybeSingle();

    if (checkError) {
      console.error('Error checking for existing invoice:', checkError);
      return NextResponse.json(
        { error: checkError.message },
        { status: 500 }
      );
    }

    // If invoice already exists, return it
    if (existingInvoice) {
      return NextResponse.json(existingInvoice);
    }

    // Get order details to populate the invoice
    const { data: orderData, error: orderError } = await supabaseAdmin
      .from('one_time_orders')
      .select('*')
      .eq('id', order_id)
      .single();

    if (orderError || !orderData) {
      console.error('Error fetching order details:', orderError);
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    // Generate invoice number
    const invoiceNumber = `INV-${Date.now().toString().substring(0, 10)}`;
    
    // Calculate invoice details
    const amount = 20; // Fixed price of 20 EUR
    const vatRate = 20; // 20% VAT
    const vatAmount = (amount * vatRate) / 100;
    const subtotal = amount;
    const totalAmount = amount + vatAmount;

    // Set invoice dates
    const invoiceDate = new Date().toISOString();
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 14); // Due in 14 days

    // Create invoice record
    const { data: invoice, error: createError } = await supabaseAdmin
      .from('invoices')
      .insert({
        order_id: order_id,
        user_id: orderData.user_id,
        invoice_number: invoiceNumber,
        invoice_date: invoiceDate,
        due_date: dueDate.toISOString(),
        amount: totalAmount,
        currency: 'EUR',
        status: orderData.payment_status || 'pending',
        customer_name: customer_name || `${orderData.tellija_eesnimi || ''} ${orderData.tellija_perenimi || ''}`.trim(),
        customer_email: orderData.tellija_epost,
        company_name: company_name || orderData.tellija_firma || orderData.company_name,
        company_registry_code: orderData.company_registry_code,
        company_address: orderData.company_address,
        service_description: 'Ettevõtte toetuste analüüs',
        vat_rate: vatRate,
        vat_amount: vatAmount,
        subtotal: subtotal,
        arve_saaja: orderData.arve_saaja || 'eraisik',
        arve_saaja_juriidiline_aadress: orderData.arve_saaja_juriidiline_aadress,
        tellija_eesnimi: orderData.tellija_eesnimi,
        tellija_perenimi: orderData.tellija_perenimi,
        tellija_epost: orderData.tellija_epost,
        tellija_firma: orderData.tellija_firma,
        tellimuse_number: `ORD-${order_id.substring(0, 8)}`
      })
      .select()
      .single();

    if (createError) {
      console.error('Error creating invoice:', createError);
      return NextResponse.json(
        { error: createError.message },
        { status: 500 }
      );
    }

    return NextResponse.json(invoice);
  } catch (error: any) {
    console.error('Error in create invoice API route:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 