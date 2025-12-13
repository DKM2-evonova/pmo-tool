import pdfParse from 'pdf-parse';

// Dynamic import for mammoth to avoid loading issues
let mammoth: any = null;
const loadMammoth = async () => {
  if (!mammoth) {
    try {
      mammoth = await import('mammoth');
    } catch (error) {
      console.error('Failed to load mammoth library:', error);
      throw new Error('DOCX processing library not available. Please try copying the text directly.');
    }
  }
  return mammoth;
};

export interface FileProcessingResult {
  success: boolean;
  text?: string;
  error?: string;
}

/**
 * Extract text from a DOCX file with multiple fallback strategies
 */
export async function extractTextFromDocx(buffer: ArrayBuffer): Promise<FileProcessingResult> {
  try {
    console.log('Loading mammoth library for DOCX processing...');
    // Load mammoth library
    const mammothLib = await loadMammoth();
    console.log('Mammoth library loaded successfully');

    // First, verify it's actually a DOCX file (ZIP archive with PK signature)
    const bytes = new Uint8Array(buffer);
    const signature = bytes.slice(0, 4);
    const signatureHex = Array.from(signature).map(b => b.toString(16).padStart(2, '0')).join(' ');
    const isZipFile = signature[0] === 0x50 && signature[1] === 0x4B &&
                      (signature[2] === 0x03 || signature[2] === 0x05 || signature[2] === 0x07);

    console.log('DOCX file signature:', signatureHex, 'isZipFile:', isZipFile, 'buffer size:', buffer.byteLength);

    if (!isZipFile) {
      return {
        success: false,
        error: `The file does not appear to be a valid DOCX file. File signature: ${signatureHex}. DOCX files should start with '50 4b 03 04'. This might be a different file format with a .docx extension.`,
      };
    }

    const nodeBuffer = Buffer.from(buffer);

    // Try multiple extraction strategies
    const strategies = [
      {
        name: 'extractRawText',
        fn: () => mammothLib.extractRawText({ buffer: nodeBuffer })
      },
      {
        name: 'convertToHtml',
        fn: () => mammothLib.convertToHtml({ buffer: nodeBuffer })
      },
      {
        name: 'extractRawText with arrayBuffer',
        fn: () => mammothLib.extractRawText({ arrayBuffer: buffer })
      },
      {
        name: 'convertToHtml with arrayBuffer',
        fn: () => mammothLib.convertToHtml({ arrayBuffer: buffer })
      }
    ];

    for (const strategy of strategies) {
      try {
        console.log(`Attempting DOCX extraction with strategy: ${strategy.name}`);
        const result = await strategy.fn();

        // Handle different result formats
        let extractedText = '';
        if (strategy.name.includes('extractRawText')) {
          extractedText = result.value?.trim() || '';
        } else if (strategy.name.includes('convertToHtml')) {
          // Extract text from HTML by removing tags
          extractedText = result.value
            .replace(/<[^>]*>/g, ' ') // Remove HTML tags
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/\s+/g, ' ')
            .trim();
        }

        // Log any messages from mammoth
        if (result.messages && result.messages.length > 0) {
          console.log(`DOCX conversion messages for ${strategy.name}:`, result.messages);
        }

        // Check if we got meaningful text
        if (extractedText && extractedText.length > 10) { // Require at least 10 characters
          console.log(`Successfully extracted ${extractedText.length} characters using ${strategy.name}`);
          return {
            success: true,
            text: extractedText,
          };
        } else {
          console.log(`Strategy ${strategy.name} returned insufficient text (${extractedText.length} chars)`);
        }

      } catch (strategyError) {
        console.error(`Strategy ${strategy.name} failed:`, strategyError);
        // Continue to next strategy
      }
    }

    // If all strategies failed, try a manual approach for common issues
    console.log('All mammoth strategies failed, trying manual DOCX parsing...');
    try {
      const manualResult = await extractTextFromDocxManual(nodeBuffer);
      if (manualResult.success) {
        return manualResult;
      }
    } catch (manualError) {
      console.error('Manual DOCX parsing also failed:', manualError);
    }

    return {
      success: false,
      error: 'All DOCX extraction methods failed. This file may be corrupted, password-protected, or in an unsupported format. Please try: 1) Copying the text directly, 2) Re-exporting from Google Meet, or 3) Converting to PDF first.',
    };

  } catch (error) {
    console.error('Critical error in DOCX processing:', error);

    if (error instanceof Error) {
      console.error('Final error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack?.substring(0, 500)
      });

      // Provide specific guidance based on error type
      if (error.message.includes('Could not find file in options')) {
        return {
          success: false,
          error: 'The DOCX file structure is not recognized. This might be a corrupted file or an unusual DOCX format. Please try re-exporting from Google Meet.',
        };
      }
      if (error.message.includes('Invalid') || error.message.includes('corrupt')) {
        return {
          success: false,
          error: 'The DOCX file appears to be corrupted. Please try downloading/exporting the transcript again.',
        };
      }
      if (error.message.includes('password') || error.message.includes('encrypted')) {
        return {
          success: false,
          error: 'The DOCX file appears to be password-protected. Please remove the password and try again.',
        };
      }
    }

    return {
      success: false,
      error: 'Failed to process DOCX file. The file may be in an unsupported format. Please try copying the text directly or converting to a different format.',
    };
  }
}

/**
 * Manual DOCX text extraction as a last resort
 * This tries to extract text directly from the ZIP structure without mammoth
 */
async function extractTextFromDocxManual(buffer: Buffer): Promise<FileProcessingResult> {
  try {
    // Try to use a different library or approach for stubborn DOCX files
    // For now, we'll try to detect if this is actually a different format
    const text = buffer.toString('utf8', 0, Math.min(1000, buffer.length));

    // Look for XML content that might indicate a different format
    if (text.includes('<?xml') && text.includes('<word/')) {
      // This might be a raw XML file that looks like DOCX
      const cleanText = text
        .replace(/<[^>]*>/g, ' ')
        .replace(/&[^;]+;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      if (cleanText.length > 50) { // If we got substantial text
        return {
          success: true,
          text: cleanText,
        };
      }
    }

    return {
      success: false,
      error: 'Manual extraction found no readable content',
    };

  } catch (error) {
    console.error('Manual DOCX extraction failed:', error);
    return {
      success: false,
      error: 'Manual extraction failed',
    };
  }
}

/**
 * Extract text from a PDF file
 */
export async function extractTextFromPdf(buffer: ArrayBuffer): Promise<FileProcessingResult> {
  try {
    const data = await pdfParse(Buffer.from(buffer));

    if (!data.text || data.text.trim().length === 0) {
      return {
        success: false,
        error: 'No text content found in PDF. The file may contain only images or be password-protected.',
      };
    }

    return {
      success: true,
      text: data.text.trim(),
    };
  } catch (error) {
    console.error('Error processing PDF file:', error);
    return {
      success: false,
      error: 'Failed to extract text from PDF file. The file may be corrupted, password-protected, or in an unsupported format.',
    };
  }
}

/**
 * Extract text from RTF file
 */
export async function extractTextFromRtf(buffer: ArrayBuffer): Promise<FileProcessingResult> {
  try {
    const text = new TextDecoder('utf-8').decode(buffer);

    // Basic RTF parsing - remove RTF control codes
    let cleanedText = text
      .replace(/\\[a-zA-Z]+\d*/g, '') // Remove RTF control words (case-insensitive)
      .replace(/[{}]/g, '') // Remove braces
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();

    if (!cleanedText || cleanedText.length < 10) {
      return {
        success: false,
        error: 'No readable text found in RTF file. The file may be corrupted or empty.',
      };
    }

    return {
      success: true,
      text: cleanedText,
    };
  } catch (error) {
    console.error('Error processing RTF file:', error);
    return {
      success: false,
      error: 'Failed to extract text from RTF file. The file may be corrupted or in an unsupported format.',
    };
  }
}

/**
 * Extract text from buffer with multiple encoding attempts
 * Only use this for actual text files, not binary formats like DOCX/PDF
 */
export async function extractTextFromBuffer(buffer: ArrayBuffer): Promise<FileProcessingResult> {
  try {
    // Check if this looks like binary data (ZIP, PDF, etc.)
    const bytes = new Uint8Array(buffer);
    const signature = bytes.slice(0, 4);
    
    // Check for common binary file signatures
    const isZipFile = signature[0] === 0x50 && signature[1] === 0x4B;
    const isPdfFile = signature[0] === 0x25 && signature[1] === 0x50 && signature[2] === 0x44 && signature[3] === 0x46;
    
    if (isZipFile || isPdfFile) {
      return {
        success: false,
        error: 'This appears to be a binary file format. Please use the appropriate file type handler.',
      };
    }

    // Try different encodings
    const encodings = ['utf-8', 'utf-16le', 'latin1'];

    for (const encoding of encodings) {
      try {
        const text = new TextDecoder(encoding).decode(buffer);
        const trimmedText = text.trim();

        // Look for transcript-like content
        if (trimmedText && trimmedText.length > 10) {
          // Check if it looks like readable text (not binary/XML)
          // Binary/XML content often has patterns like PK, <?xml, <word/, etc.
          const looksLikeBinary = /PK\s*[\x00-\x1F]/.test(trimmedText) ||
                                  trimmedText.includes('<?xml') ||
                                  trimmedText.includes('<word/') ||
                                  trimmedText.includes('[word/') ||
                                  /[\x00-\x08\x0E-\x1F]/.test(trimmedText); // Control characters

          if (looksLikeBinary) {
            continue; // Try next encoding
          }

          // Check if it looks like a transcript (has punctuation, structure)
          const hasStructure = /[.!?]\s+[A-Z]/.test(trimmedText) ||
                              trimmedText.includes(':') ||
                              trimmedText.toLowerCase().includes('meeting') ||
                              trimmedText.toLowerCase().includes('transcript') ||
                              /[a-zA-Z]{3,}/.test(trimmedText); // Has words

          if (hasStructure) {
            return {
              success: true,
              text: trimmedText,
            };
          }
        }
      } catch (e) {
        continue;
      }
    }

    return {
      success: false,
      error: 'No readable text content found in the file.',
    };
  } catch (error) {
    console.error('Error extracting text from buffer:', error);
    return {
      success: false,
      error: 'Failed to read text from file. The file may be corrupted.',
    };
  }
}

/**
 * Process a file based on its type and extract text with flexible format detection
 */
export async function processFile(file: File): Promise<FileProcessingResult> {
  try {
    console.log(`Starting file processing for ${file.name} (${file.type}, ${file.size} bytes)`);

    // Validate file size (max 50MB)
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      return {
        success: false,
        error: 'File size exceeds 50MB limit. Please choose a smaller file.',
      };
    }

    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    console.log(`File buffer loaded, size: ${buffer.byteLength} bytes`);

    // Determine file type based on content, not just extension/mime type
    const fileType = detectFileType(bytes, file.name, file.type);
    console.log(`Detected file type: ${fileType}`);

    switch (fileType) {
      case 'docx':
        console.log('Processing as DOCX file');
        return await extractTextFromDocx(buffer);

      case 'doc':
        console.log('Processing as legacy DOC file - will attempt DOCX extraction');
        // Try DOCX extraction first, as some .doc files might actually be mislabeled DOCX
        return await extractTextFromDocx(buffer);

      case 'pdf':
        console.log('Processing as PDF file');
        return await extractTextFromPdf(buffer);

      case 'rtf':
        console.log('Processing as RTF file');
        return await extractTextFromRtf(buffer);

      case 'text':
        console.log('Processing as plain text file');
        return await extractTextFromBuffer(buffer);

      default:
        // Try multiple formats as fallback
        console.log('Unknown file type, trying multiple extraction methods...');
        const fallbackResults = await tryMultipleFormats(buffer, file.name);
        if (fallbackResults.success) {
          return fallbackResults;
        }

        return {
          success: false,
          error: `Unable to process ${file.name}. This file type is not supported or the file may be corrupted. Supported formats: DOCX, PDF, RTF, TXT. Please try copying the text directly.`,
        };
    }
  } catch (error) {
    console.error('Unexpected error in processFile:', error);
    return {
      success: false,
      error: `File processing failed: ${error instanceof Error ? error.message : 'Unknown error'}. Please try copying the text directly.`,
    };
  }
}

/**
 * Detect file type based on content signatures and file metadata
 */
function detectFileType(bytes: Uint8Array, fileName: string, mimeType: string): string {
  // Check file signatures first (most reliable)
  if (bytes.length >= 4) {
    const signature = bytes.slice(0, 8);

    // PDF signature
    if (signature[0] === 0x25 && signature[1] === 0x50 && signature[2] === 0x44 && signature[3] === 0x46) {
      return 'pdf';
    }

    // ZIP/DOCX signature
    if (signature[0] === 0x50 && signature[1] === 0x4B &&
        (signature[2] === 0x03 || signature[2] === 0x05 || signature[2] === 0x07)) {
      return 'docx';
    }

    // RTF signature (common patterns)
    const textStart = new TextDecoder('utf-8').decode(bytes.slice(0, 50));
    if (textStart.includes('\\rtf') || textStart.includes('{\\rtf')) {
      return 'rtf';
    }
  }

  // Fall back to mime type and extension
  const lowerName = fileName.toLowerCase();

  if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      lowerName.endsWith('.docx')) {
    return 'docx';
  }

  if (mimeType === 'application/msword' || lowerName.endsWith('.doc')) {
    return 'doc';
  }

  if (mimeType === 'application/pdf' || lowerName.endsWith('.pdf')) {
    return 'pdf';
  }

  if (mimeType === 'text/rtf' || lowerName.endsWith('.rtf')) {
    return 'rtf';
  }

  if (mimeType === 'text/plain' || lowerName.endsWith('.txt') || lowerName.endsWith('.text')) {
    return 'text';
  }

  // If we can't determine the type, default to text (most permissive)
  return 'text';
}

/**
 * Try multiple extraction methods when file type detection fails
 */
async function tryMultipleFormats(buffer: ArrayBuffer, fileName: string): Promise<FileProcessingResult> {
  const methods = [
    { name: 'DOCX', fn: () => extractTextFromDocx(buffer) },
    { name: 'PDF', fn: () => extractTextFromPdf(buffer) },
    { name: 'RTF', fn: () => extractTextFromRtf(buffer) },
    { name: 'Text', fn: () => extractTextFromBuffer(buffer) },
  ];

  // For DOC files, prioritize DOCX extraction
  if (fileName.toLowerCase().endsWith('.doc')) {
    methods.unshift({ name: 'DOCX (for DOC file)', fn: () => extractTextFromDocx(buffer) });
  }

  for (const method of methods) {
    try {
      console.log(`Trying ${method.name} extraction for ${fileName}...`);
      const result = await method.fn();
      if (result.success && result.text && result.text.length > 10) {
        console.log(`Successfully extracted text using ${method.name} method`);
        return result;
      }
    } catch (error) {
      console.log(`${method.name} extraction failed:`, error);
    }
  }

  return {
    success: false,
    error: 'All extraction methods failed. The file may be corrupted or in an unsupported format.',
  };
}