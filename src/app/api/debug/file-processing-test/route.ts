import { NextResponse } from 'next/server';
import { processFile } from '@/lib/file-processing';

export async function GET() {
  try {
    // Test that we can import and use the file processing functions
    console.log('Testing file processing imports...');

    // Create a simple test text file content
    const testText = 'This is a test transcript for debugging purposes.';
    const blob = new Blob([testText], { type: 'text/plain' });
    const testFile = new File([blob], 'test.txt', { type: 'text/plain' });

    console.log('Created test file, processing...');
    const result = await processFile(testFile);

    return NextResponse.json({
      success: true,
      message: 'File processing test successful',
      result: {
        success: result.success,
        textLength: result.text?.length || 0,
        error: result.error
      }
    });
  } catch (error) {
    console.error('File processing test failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}


