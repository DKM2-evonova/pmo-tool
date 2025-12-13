'use client';

import { useState, useRef } from 'react';
import { Upload, FileText, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TranscriptUploadProps {
  value: string;
  onChange: (value: string) => void;
}

export function TranscriptUpload({ value, onChange }: TranscriptUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const supportedTypes = [
    'text/plain',
    'text/vtt',
    'text/rtf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/pdf',
  ];

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      await processFile(file);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await processFile(file);
    }
  };

  const processFile = async (file: File) => {
    setIsProcessing(true);
    setError(null);

    try {
      // Handle text files directly on client
      if (file.type === 'text/plain' || file.name.endsWith('.vtt')) {
        const text = await file.text();
        // Clean VTT format if needed
        const cleanedText = cleanVTT(text);
        onChange(cleanedText);
        setFileName(file.name);
      }
      // Handle DOCX, PDF, and RTF files via server-side processing
      else if (
        file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        file.name.toLowerCase().endsWith('.docx') ||
        file.type === 'application/pdf' ||
        file.name.toLowerCase().endsWith('.pdf') ||
        file.type === 'text/rtf' ||
        file.name.toLowerCase().endsWith('.rtf')
      ) {
        await processFileOnServer(file);
      } else {
        setError('Unsupported file type. Please use TXT, VTT, DOCX, or PDF.');
      }
    } catch (err) {
      console.error('Error processing file:', err);
      setError('Failed to process file. Please try again or paste text.');
    } finally {
      setIsProcessing(false);
    }
  };

  const processFileOnServer = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/files/process', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to process file');
      }

      // Validate that the extracted text looks like actual text, not binary data
      const extractedText = result.text || '';
      if (extractedText) {
        // Check for signs of binary/XML content that shouldn't be displayed
        const looksLikeBinary = /PK\s*[\x00-\x1F]/.test(extractedText) ||
                                extractedText.includes('<?xml') ||
                                extractedText.includes('<word/') ||
                                extractedText.includes('[word/') ||
                                /[\x00-\x08\x0E-\x1F]/.test(extractedText); // Control characters

        if (looksLikeBinary) {
          throw new Error('The file was processed but contains binary data instead of readable text. Please try re-exporting the transcript from Google Meet or copy the text directly.');
        }

        // Check if it has minimal readable content
        const hasReadableContent = /[a-zA-Z]{3,}/.test(extractedText);
        if (!hasReadableContent) {
          throw new Error('No readable text content was found in the file. Please ensure the file contains transcript text.');
        }
      }

      onChange(extractedText);
      setFileName(result.fileName);
    } catch (err) {
      console.error('Server processing error:', err);
      setError(err instanceof Error ? err.message : 'Failed to process file on server');
    }
  };

  const cleanVTT = (text: string): string => {
    // Remove VTT header and timestamps
    const lines = text.split('\n');
    const cleanedLines: string[] = [];
    let skipNext = false;

    for (const line of lines) {
      // Skip WEBVTT header
      if (line.startsWith('WEBVTT')) continue;
      // Skip timestamp lines
      if (line.match(/^\d{2}:\d{2}:\d{2}/)) {
        skipNext = false;
        continue;
      }
      // Skip cue identifiers
      if (line.match(/^\d+$/)) continue;
      // Skip empty lines but keep track for speaker changes
      if (line.trim() === '') {
        skipNext = false;
        continue;
      }
      // Add content lines
      cleanedLines.push(line.trim());
    }

    return cleanedLines.join('\n');
  };

  const handleClear = () => {
    onChange('');
    setFileName(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-4">
      <label className="label">Transcript</label>

      {/* File upload zone */}
      {!value && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            'relative flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors',
            isDragging
              ? 'border-primary-400 bg-primary-50'
              : 'border-surface-300 hover:border-surface-400'
          )}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.vtt,.docx,.pdf,.rtf"
            onChange={handleFileSelect}
            className="absolute inset-0 cursor-pointer opacity-0"
          />
          {isProcessing ? (
            <Loader2 className="h-10 w-10 animate-spin text-primary-500" />
          ) : (
            <Upload className="h-10 w-10 text-surface-400" />
          )}
          <p className="mt-4 text-sm font-medium text-surface-900">
            {isProcessing ? 'Processing...' : 'Drop file here or click to upload'}
          </p>
          <p className="mt-1 text-xs text-surface-500">
            Supports VTT, TXT, DOCX, PDF, and RTF files
          </p>
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-danger-50 p-3 text-sm text-danger-600">
          {error}
        </div>
      )}

      {/* Text area */}
      {value ? (
        <div className="relative">
          {fileName && (
            <div className="mb-2 flex items-center gap-2 text-sm text-surface-500">
              <FileText className="h-4 w-4" />
              <span>{fileName}</span>
              <button
                onClick={handleClear}
                className="ml-auto rounded p-1 hover:bg-surface-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Paste transcript text here..."
            rows={10}
            className="input resize-none font-mono text-sm"
          />
          <div className="mt-2 text-right text-xs text-surface-400">
            {value.length.toLocaleString()} characters
          </div>
        </div>
      ) : (
        <div className="relative">
          <div className="absolute inset-x-0 top-0 flex items-center justify-center py-2 text-sm text-surface-400">
            or paste directly below
          </div>
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Paste transcript text here..."
            rows={6}
            className="input resize-none pt-8 font-mono text-sm"
          />
        </div>
      )}
    </div>
  );
}

