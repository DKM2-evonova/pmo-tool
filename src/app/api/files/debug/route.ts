import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);

    // Check file signature (first 8 bytes)
    const signature = Array.from(bytes.slice(0, 8))
      .map(b => b.toString(16).padStart(2, '0'))
      .join(' ');

    // Check if it looks like a DOCX file (ZIP format)
    const isZipLike = signature.startsWith('50 4b 03 04') || signature.startsWith('50 4b 05 06') || signature.startsWith('50 4b 07 08');

    // Try to decode as text for debugging
    let textPreview = '';
    try {
      const decoder = new TextDecoder('utf-8', { fatal: false });
      textPreview = decoder.decode(bytes.slice(0, 1000));
    } catch (e) {
      textPreview = 'Could not decode as UTF-8 text';
    }

    return NextResponse.json({
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
      signature,
      isZipLike,
      textPreview: textPreview.substring(0, 500),
    });

  } catch (error) {
    console.error('Debug API error:', error);
    return NextResponse.json(
      { error: 'Debug failed' },
      { status: 500 }
    );
  }
}