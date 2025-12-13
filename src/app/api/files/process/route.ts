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

    // Be more permissive with file types - let the processing logic decide
    // We still want to filter out obviously wrong files
    const blockedTypes = [
      'application/octet-stream', // Generic binary
      'application/x-msdownload', // Executables
      'application/x-executable'
    ];

    if (blockedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'This file type is not allowed. Please upload a document file (DOCX, PDF, RTF, or TXT).' },
        { status: 400 }
      );
    }

    // Check for obviously wrong file extensions
    const blockedExtensions = ['.exe', '.dll', '.bat', '.cmd', '.com', '.scr', '.pif'];
    const lowerName = file.name.toLowerCase();

    if (blockedExtensions.some(ext => lowerName.endsWith(ext))) {
      return NextResponse.json(
        { error: 'This file type is not allowed. Please upload a document file.' },
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
      characters: result.text?.length || 0,
    });

  } catch (error) {
    console.error('File processing API error:', error);
    return NextResponse.json(
      { error: `Failed to process file: ${error instanceof Error ? error.message : 'Unknown error'}. Please try copying the text directly.` },
      { status: 500 }
    );
  }
}