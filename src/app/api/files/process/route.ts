import { NextRequest, NextResponse } from 'next/server';
import { processFile } from '@/lib/file-processing';
import { createClient } from '@/lib/supabase/server';
import { loggers } from '@/lib/logger';

const log = loggers.file;

export async function POST(request: NextRequest) {
  try {
    // Require authentication to prevent abuse
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

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
    log.info('Processing file', { fileName: file.name, fileType: file.type, fileSize: file.size });
    const result = await processFile(file);

    if (!result.success) {
      log.warn('File processing failed', { fileName: file.name, error: result.error });
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    log.info('Successfully processed file', { fileName: file.name, charCount: result.text?.length || 0 });

    return NextResponse.json({
      success: true,
      text: result.text,
      fileName: file.name,
      fileSize: file.size,
      characters: result.text?.length || 0,
    });

  } catch (error) {
    log.error('File processing API error', { error: error instanceof Error ? error.message : 'Unknown error' });
    return NextResponse.json(
      { error: `Failed to process file: ${error instanceof Error ? error.message : 'Unknown error'}. Please try copying the text directly.` },
      { status: 500 }
    );
  }
}