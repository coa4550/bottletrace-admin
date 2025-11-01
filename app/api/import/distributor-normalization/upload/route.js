import { NextResponse } from 'next/server';

export async function POST(req) {
  try {
    const n8nWebhookUrl = process.env.N8N_CSV_UPLOAD_WEBHOOK_URL;
    
    if (!n8nWebhookUrl) {
      return NextResponse.json(
        { error: 'N8N webhook URL not configured. Please set N8N_CSV_UPLOAD_WEBHOOK_URL environment variable.' },
        { status: 500 }
      );
    }

    // Get form data from request
    const formData = await req.formData();
    const file = formData.get('file');
    
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file type (CSV)
    if (!file.name || (!file.name.endsWith('.csv') && !file.type?.includes('csv'))) {
      return NextResponse.json(
        { error: 'Invalid file type. Please upload a CSV file.' },
        { status: 400 }
      );
    }

    // Create new FormData for N8N webhook
    const n8nFormData = new FormData();
    
    // Convert file to blob for forwarding
    const fileBlob = await file.arrayBuffer();
    const blob = new Blob([fileBlob], { type: file.type || 'text/csv' });
    
    // Append file to form data with field name 'data' as specified by N8N requirements
    n8nFormData.append('data', blob, file.name);

    // Forward to N8N webhook
    const response = await fetch(n8nWebhookUrl, {
      method: 'POST',
      body: n8nFormData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('N8N webhook error:', errorText);
      return NextResponse.json(
        { error: `N8N webhook returned error: ${response.status} ${response.statusText}` },
        { status: response.status }
      );
    }

    // Parse N8N response
    const result = await response.json();
    
    // Validate response structure
    if (result.status !== 'success' || !result.brand_file_url || !result.relationship_file_url) {
      return NextResponse.json(
        { error: 'Invalid response from N8N webhook. Expected status: success, brand_file_url, and relationship_file_url.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      status: 'success',
      brand_file_url: result.brand_file_url,
      relationship_file_url: result.relationship_file_url,
      message: result.message || 'Files processed successfully'
    });

  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to upload file to N8N webhook' },
      { status: 500 }
    );
  }
}

