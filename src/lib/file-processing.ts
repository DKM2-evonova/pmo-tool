import mammoth from 'mammoth';
import pdfParse from 'pdf-parse';

export interface FileProcessingResult {
  success: boolean;
  text?: string;
  error?: string;
}

/**
 * Extract text from a DOCX file
 */
export async function extractTextFromDocx(buffer: ArrayBuffer): Promise<FileProcessingResult> {
  try {
    // First, verify it's actually a DOCX file (ZIP archive with PK signature)
    const bytes = new Uint8Array(buffer);
    const signature = bytes.slice(0, 4);
    const isZipFile = signature[0] === 0x50 && signature[1] === 0x4B && 
                      (signature[2] === 0x03 || signature[2] === 0x05 || signature[2] === 0x07);

    if (!isZipFile) {
      return {
        success: false,
        error: 'The file does not appear to be a valid DOCX file. DOCX files are ZIP archives. Please ensure the file was exported correctly from Google Meet.',
      };
    }

    // Try extracting with mammoth
    let result;
    try {
      result = await mammoth.extractRawText({
        arrayBuffer: buffer
      });
    } catch (mammothError) {
      console.error('Mammoth extraction error:', mammothError);
      
      // Try alternative extraction method using convertToHtml
      try {
        const htmlResult = await mammoth.convertToHtml({
          arrayBuffer: buffer
        });
        
        // Extract text from HTML by removing tags
        const textFromHtml = htmlResult.value
          .replace(/<[^>]*>/g, ' ') // Remove HTML tags
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/\s+/g, ' ')
          .trim();

        if (textFromHtml && textFromHtml.length > 0) {
          return {
            success: true,
            text: textFromHtml,
          };
        }
      } catch (htmlError) {
        console.error('HTML conversion also failed:', htmlError);
      }

      throw mammothError; // Re-throw original error
    }

    // Check for conversion errors and warnings
    if (result.messages.length > 0) {
      console.warn('DOCX conversion messages:', result.messages);

      // Check if there are any severe errors
      const severeMessages = result.messages.filter(msg =>
        msg.type === 'error' || (msg.type === 'warning' && msg.message.includes('corrupt'))
      );

      if (severeMessages.length > 0) {
        console.error('Severe DOCX conversion issues:', severeMessages);
        return {
          success: false,
          error: 'The DOCX file appears to be corrupted or in an unsupported format. Please try exporting the transcript again from Google Meet.',
        };
      }
    }

    const extractedText = result.value.trim();
    if (!extractedText) {
      return {
        success: false,
        error: 'No text content found in the DOCX file. The file may be empty or contain only images/formatting.',
      };
    }

    return {
      success: true,
      text: extractedText,
    };
  } catch (error) {
    console.error('Error processing DOCX file:', error);

    // Provide more specific error messages based on the error type
    if (error instanceof Error) {
      if (error.message.includes('Invalid') || error.message.includes('corrupt')) {
        return {
          success: false,
          error: 'The DOCX file appears to be corrupted. Please try re-exporting the transcript from Google Meet.',
        };
      }
      if (error.message.includes('Unsupported') || error.message.includes('format')) {
        return {
          success: false,
          error: 'This DOCX format is not supported. Please save the transcript as a different DOCX version or try copying the text directly.',
        };
      }
      if (error.message.includes('not a zip file') || error.message.includes('ZIP')) {
        return {
          success: false,
          error: 'The file is not a valid DOCX file. Please ensure it was exported correctly from Google Meet.',
        };
      }
    }

    return {
      success: false,
      error: 'Failed to extract text from DOCX file. The file may be corrupted or in an unsupported format. Please try copying the text directly or re-exporting from Google Meet.',
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
      .replace(/\\[a-z]+\d*/g, '') // Remove RTF control words
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
 * Process a file based on its type and extract text
 */
export async function processFile(file: File): Promise<FileProcessingResult> {
  // Validate file size (max 50MB)
  const maxSize = 50 * 1024 * 1024; // 50MB
  if (file.size > maxSize) {
    return {
      success: false,
      error: 'File size exceeds 50MB limit. Please choose a smaller file.',
    };
  }

  const buffer = await file.arrayBuffer();

  if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      file.name.toLowerCase().endsWith('.docx')) {
    // DOCX files are ZIP archives - never try to decode them as plain text
    return extractTextFromDocx(buffer);
  } else if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
    return extractTextFromPdf(buffer);
  } else if (file.type === 'text/rtf' || file.name.toLowerCase().endsWith('.rtf')) {
    return extractTextFromRtf(buffer);
  } else if (file.type === 'text/plain' || file.name.toLowerCase().endsWith('.txt')) {
    return extractTextFromBuffer(buffer);
  } else {
    return {
      success: false,
      error: 'Unsupported file type. Please upload a DOCX, PDF, RTF, or TXT file.',
    };
  }
}