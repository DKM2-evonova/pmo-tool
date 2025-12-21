import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Pre-compiled UUID regex for performance (compiled once at module load)
 * Matches UUID versions 1-5
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Merge Tailwind classes with clsx
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format date to YYYY-MM-DD
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toISOString().split('T')[0];
}

/**
 * Format date to readable string
 */
export function formatDateReadable(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Format timestamp (HH:MM:SS)
 */
export function formatTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

/**
 * Parse timestamp string (HH:MM:SS) to seconds
 * Returns 0 for invalid input
 */
export function parseTimestamp(timestamp: string): number {
  if (!timestamp || typeof timestamp !== 'string') {
    return 0;
  }
  const parts = timestamp.split(':').map(Number);
  if (parts.length !== 3 || parts.some(isNaN) || parts.some(p => p < 0)) {
    return 0;
  }
  const [hours, minutes, seconds] = parts;
  // Validate ranges: minutes and seconds should be 0-59
  if (minutes > 59 || seconds > 59) {
    return 0;
  }
  return hours * 3600 + minutes * 60 + seconds;
}

/**
 * Truncate text with ellipsis
 * Returns empty string for invalid input
 */
export function truncate(text: string, maxLength: number): string {
  if (!text || typeof text !== 'string') {
    return '';
  }
  if (maxLength < 4) {
    // Can't fit ellipsis, just return first chars
    return text.slice(0, Math.max(0, maxLength));
  }
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

/**
 * Generate a unique ID
 */
export function generateId(): string {
  return crypto.randomUUID();
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Calculate risk severity from probability and impact
 */
export function calculateRiskSeverity(
  probability: 'Low' | 'Med' | 'High',
  impact: 'Low' | 'Med' | 'High'
): 'Low' | 'Med' | 'High' {
  const severityMatrix: Record<string, Record<string, 'Low' | 'Med' | 'High'>> =
    {
      Low: { Low: 'Low', Med: 'Low', High: 'Med' },
      Med: { Low: 'Low', Med: 'Med', High: 'High' },
      High: { Low: 'Med', Med: 'High', High: 'High' },
    };
  return severityMatrix[probability][impact];
}

/**
 * Check if a date is overdue
 */
export function isOverdue(dateString: string | null): boolean {
  if (!dateString) return false;
  const date = new Date(dateString);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date < today;
}

/**
 * Get initials from a name
 * Returns empty string for invalid input
 */
export function getInitials(name: string): string {
  if (!name || typeof name !== 'string') {
    return '';
  }
  const trimmed = name.trim();
  if (!trimmed) {
    return '';
  }
  return trimmed
    .split(' ')
    .filter(part => part.length > 0)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Safely parse JSON
 */
export function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

/**
 * Sleep for a given number of milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error | null = null;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (i < maxRetries - 1) {
        await sleep(baseDelay * Math.pow(2, i));
      }
    }
  }
  throw lastError;
}

/**
 * Validate UUID format
 * Returns true if the string is a valid UUID v1-5 format
 * Uses pre-compiled regex for performance
 */
export function isValidUUID(id: string): boolean {
  return UUID_REGEX.test(id);
}

