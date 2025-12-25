/**
 * Application Configuration
 * Centralized configuration for all configurable constants
 *
 * These values can be overridden via environment variables where noted.
 */

// =============================================================================
// File Processing Configuration
// =============================================================================

/**
 * Maximum file size for upload processing (in bytes)
 * Default: 50MB
 */
export const FILE_MAX_SIZE_BYTES = parseInt(
  process.env.FILE_MAX_SIZE_MB || '50',
  10
) * 1024 * 1024;

/**
 * Minimum character threshold for meaningful text extraction
 * Files with less than this many characters are considered empty/invalid
 */
export const FILE_MIN_TEXT_CHARS = 10;

/**
 * Minimum character threshold for meaningful transcript content
 */
export const TRANSCRIPT_MIN_CHARS = 50;

// =============================================================================
// Embedding Cache Configuration
// =============================================================================

/**
 * Maximum number of embeddings to cache
 * Uses LRU eviction when limit is reached
 */
export const EMBEDDING_CACHE_MAX_SIZE = parseInt(
  process.env.EMBEDDING_CACHE_MAX_SIZE || '500',
  10
);

/**
 * Embedding cache TTL in milliseconds
 * Default: 30 minutes
 */
export const EMBEDDING_CACHE_TTL_MS = parseInt(
  process.env.EMBEDDING_CACHE_TTL_MINUTES || '30',
  10
) * 60 * 1000;

// =============================================================================
// Google Drive Configuration
// =============================================================================

/**
 * Default webhook channel expiration time in milliseconds
 * Google Drive webhooks can be set for up to 24 hours
 * Default: 24 hours
 */
export const DRIVE_WEBHOOK_EXPIRATION_MS = parseInt(
  process.env.DRIVE_WEBHOOK_EXPIRATION_HOURS || '24',
  10
) * 60 * 60 * 1000;

/**
 * Buffer time before token expiration to trigger refresh (milliseconds)
 * Default: 5 minutes
 */
export const TOKEN_REFRESH_BUFFER_MS = parseInt(
  process.env.TOKEN_REFRESH_BUFFER_MINUTES || '5',
  10
) * 60 * 1000;

// =============================================================================
// Retry Configuration
// =============================================================================

/**
 * Maximum number of retry attempts for transient failures
 */
export const RETRY_MAX_ATTEMPTS = parseInt(
  process.env.RETRY_MAX_ATTEMPTS || '3',
  10
);

/**
 * Base delay between retries in milliseconds
 * Uses exponential backoff: delay = baseDelay * 2^attempt
 */
export const RETRY_BASE_DELAY_MS = parseInt(
  process.env.RETRY_BASE_DELAY_MS || '1000',
  10
);

/**
 * Maximum delay between retries in milliseconds
 */
export const RETRY_MAX_DELAY_MS = parseInt(
  process.env.RETRY_MAX_DELAY_MS || '10000',
  10
);

// =============================================================================
// API Rate Limiting Configuration
// =============================================================================

/**
 * Request timeout for external API calls (milliseconds)
 * Default: 30 seconds
 */
export const API_REQUEST_TIMEOUT_MS = parseInt(
  process.env.API_REQUEST_TIMEOUT_MS || '30000',
  10
);

// =============================================================================
// Content Fingerprint Configuration
// =============================================================================

/**
 * Number of characters to use for content fingerprint generation
 */
export const FINGERPRINT_SAMPLE_SIZE = 2000;
