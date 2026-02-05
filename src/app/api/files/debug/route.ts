import { NextRequest, NextResponse } from 'next/server';
import { processFile } from '@/lib/file-processing';
import { createClient } from '@/lib/supabase/server';
import { loggers } from '@/lib/logger';

const log = loggers.file;

export async function POST(request: NextRequest) {
  // Only allow in development or with explicit flag
  if (process.env.NODE_ENV === 'production' && !process.env.ENABLE_DEBUG_ROUTES) {
    return NextResponse.json({ error: 'Debug routes disabled in production' }, { status: 404 });
  }

  try {
    // Require authentication
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // In production (even with flag), require admin role
    if (process.env.NODE_ENV === 'production') {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('global_role')
        .eq('id', user.id)
        .single();

      if (profileError || !profile) {
        log.error('Failed to fetch user profile', { userId: user.id, error: profileError?.message });
        return NextResponse.json(
          { error: 'Failed to verify user permissions' },
          { status: 500 }
        );
      }

      if (profile.global_role !== 'admin') {
        return NextResponse.json(
          { error: 'Admin access required' },
          { status: 403 }
        );
      }
    }

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

    // Check for PDF signature
    const isPdfLike = signature.startsWith('25 50 44 46');

    // Try to decode as text for debugging
    let textPreview = '';
    try {
      const decoder = new TextDecoder('utf-8', { fatal: false });
      textPreview = decoder.decode(bytes.slice(0, 1000));
    } catch (e) {
      textPreview = 'Could not decode as UTF-8 text';
    }

    // Try to process the file and see what happens
    let processingResult = null;
    try {
      log.debug('Testing file processing for debug', { fileName: file.name });
      const result = await processFile(file);
      processingResult = {
        success: result.success,
        error: result.error,
        textLength: result.text?.length || 0,
        textPreview: result.text?.substring(0, 200) || null
      };
    } catch (processingError) {
      log.error('Processing test failed', { error: processingError instanceof Error ? processingError.message : 'Unknown error' });
      processingResult = {
        success: false,
        error: processingError instanceof Error ? processingError.message : 'Unknown processing error',
        textLength: 0,
        textPreview: null
      };
    }

    // Additional checks for common issues
    const looksLikeBinary = /PK\s*[\x00-\x1F]/.test(textPreview) ||
                            textPreview.includes('<?xml') ||
                            textPreview.includes('<word/') ||
                            /[\x00-\x08\x0E-\x1F]/.test(textPreview);

    const hasReadableContent = /[a-zA-Z]{3,}/.test(textPreview.replace(/[\x00-\x1F]/g, ''));

    return NextResponse.json({
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
      signature,
      isZipLike,
      isPdfLike,
      looksLikeBinary,
      hasReadableContent,
      textPreview: textPreview.substring(0, 500),
      processingResult,
      recommendations: getRecommendations(file, signature, isZipLike, isPdfLike, processingResult, looksLikeBinary, hasReadableContent)
    });

  } catch (error) {
    log.error('Debug API error', { error: error instanceof Error ? error.message : 'Unknown error' });
    return NextResponse.json(
      { error: 'Debug failed' },
      { status: 500 }
    );
  }
}

function getRecommendations(
  file: File,
  signature: string,
  isZipLike: boolean,
  isPdfLike: boolean,
  processingResult: any,
  looksLikeBinary: boolean,
  hasReadableContent: boolean
): string[] {
  const recommendations = [];

  if (!processingResult.success) {
    if (!isZipLike && file.name.toLowerCase().endsWith('.docx')) {
      recommendations.push('The file claims to be DOCX but doesn\'t have the correct ZIP file signature. Try re-exporting from Google Meet.');
    }

    if (looksLikeBinary && !hasReadableContent) {
      recommendations.push('The file appears to contain binary data rather than readable text. Try copying the transcript text directly.');
    }

    if (processingResult.error?.includes('corrupted')) {
      recommendations.push('The file may be corrupted. Try downloading/exporting the transcript again from Google Meet.');
    }

    if (processingResult.error?.includes('password') || processingResult.error?.includes('encrypted')) {
      recommendations.push('The file appears to be password-protected. Remove the password and try again.');
    }

    if (processingResult.error?.includes('format') || processingResult.error?.includes('Unsupported')) {
      recommendations.push('The file format is not supported. Try saving as a different version of DOCX or export as PDF instead.');
    }
  }

  if (!recommendations.length) {
    recommendations.push('Try copying the transcript text directly into the text area instead of uploading the file.');
    recommendations.push('If you\'re using Google Meet, try the "Save transcript" option again.');
  }

  return recommendations;
}