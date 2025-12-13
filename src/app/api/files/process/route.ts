import { NextRequest, NextResponse } from 'next/server';
import { processFile } from '@/lib/file-processing';

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

    // Validate file type
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/rtf',
      'text/plain'
    ];

    const allowedExtensions = ['.pdf', '.docx', '.rtf', '.txt'];

    const hasAllowedType = allowedTypes.includes(file.type);
    const hasAllowedExtension = allowedExtensions.some(ext =>
      file.name.toLowerCase().endsWith(ext)
    );

    if (!hasAllowedType && !hasAllowedExtension) {
      return NextResponse.json(
        { error: 'Unsupported file type. Please upload a PDF or DOCX file.' },
        { status: 400 }
      );
    }

    // Process the file
    console.log(`Processing file: ${file.name}, type: ${file.type}, size: ${file.size} bytes`);
    const result = await processFile(file);

    if (!result.success) {
      console.error(`File processing failed for ${file.name}:`, result.error);
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    console.log(`Successfully processed ${file.name}, extracted ${result.text?.length || 0} characters`);

    return NextResponse.json({
      success: true,
      text: result.text,
      fileName: file.name,
      fileSize: file.size,
    });

  } catch (error) {
    console.error('File processing API error:', error);
    return NextResponse.json(
      { error: 'Internal server error while processing file' },
      { status: 500 }
    );
  }
}