import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    // Extract the invoice ID from the request
    const { id } = await request.json();

    if (!id) {
      return NextResponse.json(
        { error: 'Invoice ID is required' },
        { status: 400 }
      );
    }

    // Forward the request to the external API
    const externalApiResponse = await fetch('https://userfrontend1.azurewebsites.net/api/generate-invoice-pdf', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ id }),
    });

    // If the external API returns an error
    if (!externalApiResponse.ok) {
      const errorText = await externalApiResponse.text();
      console.error('External API error:', errorText);
      
      return NextResponse.json(
        { error: 'PDF generation failed' },
        { status: externalApiResponse.status }
      );
    }

    // Get the PDF data as an array buffer
    const pdfData = await externalApiResponse.arrayBuffer();

    // Create a response with the PDF data
    return new NextResponse(pdfData, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="invoice-${id.substring(0, 8)}.pdf"`,
      },
    });
  } catch (error: any) {
    console.error('Error in generate invoice PDF API route:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 