import { NextResponse } from 'next/server';
import Papa from 'papaparse';

export async function POST(req) {
  try {
    const { fileUrl } = await req.json();
    
    if (!fileUrl) {
      return NextResponse.json(
        { error: 'File URL is required' },
        { status: 400 }
      );
    }

    // Validate URL
    try {
      new URL(fileUrl);
    } catch (e) {
      return NextResponse.json(
        { error: 'Invalid file URL' },
        { status: 400 }
      );
    }

    // Fetch CSV file
    const response = await fetch(fileUrl);
    
    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch CSV file: ${response.status} ${response.statusText}` },
        { status: response.status }
      );
    }

    // Get CSV text
    const csvText = await response.text();
    
    if (!csvText || csvText.trim().length === 0) {
      return NextResponse.json(
        { error: 'CSV file is empty' },
        { status: 400 }
      );
    }

    // Parse CSV (first 20 rows for preview)
    return new Promise((resolve) => {
      Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          if (results.errors && results.errors.length > 0) {
            const parseError = results.errors[0];
            resolve(NextResponse.json(
              { error: `CSV parse error: ${parseError.message}` },
              { status: 400 }
            ));
            return;
          }

          // Limit to first 20 rows for preview
          const previewRows = results.data.slice(0, 20);
          
          resolve(NextResponse.json({
            headers: results.meta.fields || [],
            rows: previewRows,
            totalRows: results.data.length,
            previewRowCount: previewRows.length
          }));
        },
        error: (error) => {
          resolve(NextResponse.json(
            { error: `Failed to parse CSV: ${error.message}` },
            { status: 400 }
          ));
        }
      });
    });

  } catch (error) {
    console.error('Preview error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch and parse CSV file' },
      { status: 500 }
    );
  }
}







