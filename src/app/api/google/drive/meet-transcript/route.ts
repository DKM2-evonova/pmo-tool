import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  findMeetRecordingsFolder,
  listFilesInFolder,
  exportGoogleDoc,
  downloadFile,
  parseMeetingFromFilename,
} from '@/lib/google/drive-client';
import { loggers } from '@/lib/logger';
import {
  extractTextFromDocx,
  extractTextFromPdf,
  extractTextFromRtf,
  extractTextFromBuffer,
} from '@/lib/file-processing';

const log = loggers.drive;

/**
 * POST /api/google/drive/meet-transcript
 * Searches for and fetches a Google Meet transcript from Drive
 *
 * Body:
 * - title: string - Meeting title to search for
 * - date: string - Meeting date (YYYY-MM-DD)
 * - meetingId?: string - Optional Google Calendar event ID
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { title, date } = body;

    if (!title || !date) {
      return NextResponse.json(
        { error: 'title and date are required' },
        { status: 400 }
      );
    }

    log.info('Searching for Meet transcript', { userId: user.id, title, date });

    // Find the Meet Recordings folder
    const meetFolder = await findMeetRecordingsFolder(user.id);
    if (!meetFolder) {
      return NextResponse.json({
        found: false,
        reason: 'no_meet_folder',
        message: 'Meet Recordings folder not found in your Drive',
      });
    }

    // List recent files in the folder (last 30 days should cover most cases)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { files } = await listFilesInFolder(user.id, meetFolder.id, {
      maxResults: 100,
      modifiedAfter: thirtyDaysAgo.toISOString(),
    });

    if (files.length === 0) {
      return NextResponse.json({
        found: false,
        reason: 'no_files',
        message: 'No recent transcripts found in Meet Recordings folder',
      });
    }

    // Search for matching file by title and date
    const searchDate = date; // YYYY-MM-DD format
    const normalizedTitle = title.toLowerCase().trim();

    // Score each file for match quality
    const scoredFiles = files.map(file => {
      const parsed = parseMeetingFromFilename(file.name, file.modifiedTime);
      const fileDate = parsed.date;
      const fileTitle = parsed.title.toLowerCase().trim();

      let score = 0;

      // Date match is critical - must be same day
      if (fileDate === searchDate) {
        score += 100;
      } else {
        // Check if date is within 1 day (timezone issues)
        const searchDateObj = new Date(searchDate);
        const fileDateObj = new Date(fileDate);
        const dayDiff = Math.abs(searchDateObj.getTime() - fileDateObj.getTime()) / (1000 * 60 * 60 * 24);
        if (dayDiff <= 1) {
          score += 50;
        }
      }

      // Title matching
      if (fileTitle === normalizedTitle) {
        score += 100;
      } else if (fileTitle.includes(normalizedTitle) || normalizedTitle.includes(fileTitle)) {
        score += 50;
      } else {
        // Check for word overlap
        const fileWords = new Set(fileTitle.split(/\s+/).filter((w: string) => w.length > 2));
        const searchWords = normalizedTitle.split(/\s+/).filter((w: string) => w.length > 2);
        const matchingWords = searchWords.filter((w: string) => fileWords.has(w));
        score += matchingWords.length * 10;
      }

      return { file, parsed, score };
    });

    // Sort by score descending
    scoredFiles.sort((a, b) => b.score - a.score);

    // Get best match if score is high enough
    const bestMatch = scoredFiles[0];
    if (!bestMatch || bestMatch.score < 50) {
      return NextResponse.json({
        found: false,
        reason: 'no_match',
        message: 'No matching transcript found for this meeting',
        searchedFiles: files.length,
        candidates: scoredFiles.slice(0, 5).map(s => ({
          name: s.file.name,
          score: s.score,
          parsedTitle: s.parsed.title,
          parsedDate: s.parsed.date,
        })),
      });
    }

    log.info('Found matching transcript', {
      fileName: bestMatch.file.name,
      score: bestMatch.score,
      fileId: bestMatch.file.id,
    });

    // Download/export the transcript content
    let transcriptText: string;
    const file = bestMatch.file;

    try {
      if (file.mimeType === 'application/vnd.google-apps.document') {
        // Export Google Doc as plain text
        transcriptText = await exportGoogleDoc(user.id, file.id, 'text/plain');
      } else if (file.mimeType === 'text/plain') {
        // Download text file directly
        const buffer = await downloadFile(user.id, file.id);
        transcriptText = new TextDecoder().decode(buffer);
      } else {
        // For DOCX, PDF, RTF etc. - download and extract text based on type
        const buffer = await downloadFile(user.id, file.id);
        let result;

        if (file.mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
          result = await extractTextFromDocx(buffer);
        } else if (file.mimeType === 'application/pdf') {
          result = await extractTextFromPdf(buffer);
        } else if (file.mimeType === 'application/rtf') {
          result = await extractTextFromRtf(buffer);
        } else {
          // Try generic text extraction
          result = await extractTextFromBuffer(buffer);
        }

        if (!result.success || !result.text) {
          throw new Error(result.error || 'Failed to extract text from file');
        }
        transcriptText = result.text;
      }
    } catch (downloadError) {
      log.error('Failed to download transcript', {
        error: downloadError instanceof Error ? downloadError.message : 'Unknown',
        fileId: file.id,
      });
      return NextResponse.json({
        found: true,
        downloadFailed: true,
        reason: 'download_error',
        message: 'Found transcript but failed to download content',
        file: {
          id: file.id,
          name: file.name,
          webViewLink: file.webViewLink,
        },
      });
    }

    return NextResponse.json({
      found: true,
      transcript: transcriptText,
      file: {
        id: file.id,
        name: file.name,
        mimeType: file.mimeType,
        webViewLink: file.webViewLink,
      },
      matchScore: bestMatch.score,
    });

  } catch (error) {
    log.error('Error searching for Meet transcript', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    if (error instanceof Error) {
      if (error.message.includes('No valid access token')) {
        return NextResponse.json(
          { error: 'Drive not connected or session expired', code: 'RECONNECT_REQUIRED' },
          { status: 401 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Failed to search for transcript' },
      { status: 500 }
    );
  }
}
