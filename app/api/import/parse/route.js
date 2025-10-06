import { NextResponse } from 'next/server';
export async function POST() {
  // Placeholder for PDF/DOCX/API parsing pipeline
  return NextResponse.json({ ok: false, message: 'Parser not implemented yet' }, { status: 501 });
}