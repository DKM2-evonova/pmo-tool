import { NextResponse } from 'next/server';
import { processFile } from '@/lib/file-processing';
import { createClient } from '@/lib/supabase/server';
import { loggers } from '@/lib/logger';

const log = loggers.file;

export async function GET() {
  // Disable debug routes in production
  if (process.env.NODE_ENV === 'production' && !process.env.ENABLE_DEBUG_ROUTES) {
    return NextResponse.json({ error: 'Debug routes disabled in production' }, { status: 404 });
  }

  try {
    // Authentication check - debug routes require admin
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('global_role')
      .eq('id', user.id)
      .single();

    if (profile?.global_role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    log.debug('Testing file processing imports');

    // Create a simple test text file content
    const testText = 'This is a test transcript for debugging purposes.';
    const blob = new Blob([testText], { type: 'text/plain' });
    const testFile = new File([blob], 'test.txt', { type: 'text/plain' });

    log.debug('Created test file, processing');
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
    log.error('File processing test failed', { error: error instanceof Error ? error.message : 'Unknown error' });
    return NextResponse.json({
      success: false,
      error: 'File processing test failed'
    }, { status: 500 });
  }
}
























