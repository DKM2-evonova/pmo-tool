import { NextResponse } from 'next/server';
import { ApiErrors } from './responses';

/**
 * Simple in-memory rate limiter
 * For production, consider using Redis or a distributed rate limiting solution
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// In-memory store for rate limiting
// Note: This resets on server restart and doesn't work across multiple instances
const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup old entries every 5 minutes
const CLEANUP_INTERVAL = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanupExpiredEntries() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;

  lastCleanup = now;
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetTime < now) {
      rateLimitStore.delete(key);
    }
  }
}

export interface RateLimitConfig {
  /** Maximum number of requests allowed in the window */
  limit: number;
  /** Time window in milliseconds */
  windowMs: number;
  /** Key prefix for namespacing different rate limiters */
  keyPrefix?: string;
}

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetTime: number;
}

/**
 * Check if a request should be rate limited
 * @param identifier - Unique identifier for the client (e.g., user ID, IP address)
 * @param config - Rate limit configuration
 * @returns Result indicating if request is allowed and remaining quota
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
  cleanupExpiredEntries();

  const key = config.keyPrefix ? `${config.keyPrefix}:${identifier}` : identifier;
  const now = Date.now();

  const entry = rateLimitStore.get(key);

  // No entry or expired entry - allow and create new entry
  if (!entry || entry.resetTime < now) {
    const newEntry: RateLimitEntry = {
      count: 1,
      resetTime: now + config.windowMs,
    };
    rateLimitStore.set(key, newEntry);

    return {
      success: true,
      remaining: config.limit - 1,
      resetTime: newEntry.resetTime,
    };
  }

  // Entry exists and is still valid
  if (entry.count >= config.limit) {
    return {
      success: false,
      remaining: 0,
      resetTime: entry.resetTime,
    };
  }

  // Increment count
  entry.count++;
  rateLimitStore.set(key, entry);

  return {
    success: true,
    remaining: config.limit - entry.count,
    resetTime: entry.resetTime,
  };
}

/**
 * Create a rate limit response with appropriate headers
 */
export function rateLimitResponse(result: RateLimitResult): NextResponse {
  const response = ApiErrors.rateLimited();

  response.headers.set('X-RateLimit-Remaining', result.remaining.toString());
  response.headers.set('X-RateLimit-Reset', result.resetTime.toString());
  response.headers.set(
    'Retry-After',
    Math.ceil((result.resetTime - Date.now()) / 1000).toString()
  );

  return response;
}

/**
 * Rate limit middleware helper
 * Returns null if allowed, or a NextResponse if rate limited
 */
export function rateLimit(
  identifier: string,
  config: RateLimitConfig
): NextResponse | null {
  const result = checkRateLimit(identifier, config);

  if (!result.success) {
    return rateLimitResponse(result);
  }

  return null;
}

// Pre-configured rate limiters for common use cases
export const RateLimits = {
  /** Standard API rate limit: 100 requests per minute */
  standard: { limit: 100, windowMs: 60 * 1000 } as RateLimitConfig,

  /** LLM processing rate limit: 10 requests per minute (expensive operations) */
  llmProcessing: {
    limit: 10,
    windowMs: 60 * 1000,
    keyPrefix: 'llm',
  } as RateLimitConfig,

  /** File upload rate limit: 20 uploads per minute */
  fileUpload: {
    limit: 20,
    windowMs: 60 * 1000,
    keyPrefix: 'upload',
  } as RateLimitConfig,

  /** Authentication rate limit: 5 attempts per minute */
  auth: {
    limit: 5,
    windowMs: 60 * 1000,
    keyPrefix: 'auth',
  } as RateLimitConfig,

  /** Strict rate limit: 3 requests per minute (for sensitive operations) */
  strict: {
    limit: 3,
    windowMs: 60 * 1000,
    keyPrefix: 'strict',
  } as RateLimitConfig,
} as const;
