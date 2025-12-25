/**
 * Retry Utility
 * Provides exponential backoff retry logic for transient failures
 */

import { RETRY_MAX_ATTEMPTS, RETRY_BASE_DELAY_MS, RETRY_MAX_DELAY_MS } from './config';
import { createLogger } from './logger';

const log = createLogger('retry');

export interface RetryOptions {
  /** Maximum number of retry attempts (default: from config) */
  maxAttempts?: number;
  /** Base delay between retries in ms (default: from config) */
  baseDelayMs?: number;
  /** Maximum delay between retries in ms (default: from config) */
  maxDelayMs?: number;
  /** Function to determine if an error is retryable (default: all errors) */
  isRetryable?: (error: unknown) => boolean;
  /** Optional context for logging */
  context?: string;
  /** Callback for each retry attempt */
  onRetry?: (attempt: number, error: unknown, delayMs: number) => void;
}

/**
 * Default function to determine if an error is retryable
 * Retries on network errors, timeouts, and 5xx server errors
 */
export function isTransientError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    // Network errors
    if (
      message.includes('network') ||
      message.includes('timeout') ||
      message.includes('econnrefused') ||
      message.includes('econnreset') ||
      message.includes('etimedout') ||
      message.includes('socket hang up')
    ) {
      return true;
    }

    // Rate limiting
    if (message.includes('rate limit') || message.includes('too many requests')) {
      return true;
    }
  }

  // Check for HTTP response errors with status codes
  if (error && typeof error === 'object' && 'status' in error) {
    const status = (error as { status: number }).status;
    // Retry on 408, 429, and 5xx errors
    if (status === 408 || status === 429 || (status >= 500 && status < 600)) {
      return true;
    }
  }

  return false;
}

/**
 * Calculate delay for exponential backoff with jitter
 */
function calculateDelay(
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number
): number {
  // Exponential backoff: baseDelay * 2^attempt
  const exponentialDelay = baseDelayMs * Math.pow(2, attempt);

  // Cap at max delay
  const cappedDelay = Math.min(exponentialDelay, maxDelayMs);

  // Add jitter (0-25% random variation) to prevent thundering herd
  const jitter = cappedDelay * 0.25 * Math.random();

  return Math.floor(cappedDelay + jitter);
}

/**
 * Sleep for a specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Execute a function with retry logic on transient failures
 *
 * @example
 * ```typescript
 * const result = await withRetry(
 *   () => fetchFromAPI(url),
 *   { context: 'API call', maxAttempts: 3 }
 * );
 * ```
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxAttempts = RETRY_MAX_ATTEMPTS,
    baseDelayMs = RETRY_BASE_DELAY_MS,
    maxDelayMs = RETRY_MAX_DELAY_MS,
    isRetryable = isTransientError,
    context = 'operation',
    onRetry,
  } = options;

  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Check if we should retry
      if (attempt >= maxAttempts - 1 || !isRetryable(error)) {
        throw error;
      }

      // Calculate delay with exponential backoff
      const delayMs = calculateDelay(attempt, baseDelayMs, maxDelayMs);

      log.warn(`Retrying ${context} after transient failure`, {
        attempt: attempt + 1,
        maxAttempts,
        delayMs,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      // Call retry callback if provided
      if (onRetry) {
        onRetry(attempt + 1, error, delayMs);
      }

      // Wait before retrying
      await sleep(delayMs);
    }
  }

  // This should never be reached, but TypeScript needs it
  throw lastError;
}

/**
 * Create a retryable version of a function
 *
 * @example
 * ```typescript
 * const retryableFetch = makeRetryable(
 *   (url: string) => fetch(url),
 *   { context: 'HTTP fetch' }
 * );
 * const response = await retryableFetch('https://api.example.com');
 * ```
 */
export function makeRetryable<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  options: RetryOptions = {}
): (...args: TArgs) => Promise<TResult> {
  return (...args: TArgs) => withRetry(() => fn(...args), options);
}
