/**
 * Embedding Service for Semantic Matching
 * Uses OpenAI text-embedding-3-small by default
 */

import OpenAI from 'openai';
import { loggers } from '@/lib/logger';

const log = loggers.embedding;
const EMBEDDING_DIMENSIONS = 1536;

let openaiClient: OpenAI | null = null;

// LRU-style cache for embeddings to avoid redundant API calls
interface EmbeddingCacheEntry {
  embedding: number[];
  timestamp: number;
}

const embeddingCache = new Map<string, EmbeddingCacheEntry>();
const EMBEDDING_CACHE_MAX_SIZE = 500;
const EMBEDDING_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Generate a cache key from text (hash for long texts)
 */
function getCacheKey(text: string): string {
  // For short texts, use the text directly; for longer texts, use a simple hash
  if (text.length <= 100) {
    return text;
  }
  // Simple hash for longer texts
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return `hash:${hash}:${text.length}:${text.slice(0, 50)}`;
}

/**
 * Get embedding from cache if available
 */
function getCachedEmbedding(text: string): number[] | null {
  const key = getCacheKey(text);
  const cached = embeddingCache.get(key);

  if (cached && Date.now() - cached.timestamp < EMBEDDING_CACHE_TTL_MS) {
    log.debug('Embedding cache hit', { keyPrefix: key.slice(0, 30) });
    return cached.embedding;
  }

  if (cached) {
    // Expired, remove it
    embeddingCache.delete(key);
  }

  return null;
}

/**
 * Store embedding in cache with LRU eviction
 */
function setCachedEmbedding(text: string, embedding: number[]): void {
  const key = getCacheKey(text);

  // Evict oldest entries if at capacity
  if (embeddingCache.size >= EMBEDDING_CACHE_MAX_SIZE) {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [k, v] of embeddingCache.entries()) {
      if (v.timestamp < oldestTime) {
        oldestTime = v.timestamp;
        oldestKey = k;
      }
    }

    if (oldestKey) {
      embeddingCache.delete(oldestKey);
    }
  }

  embeddingCache.set(key, { embedding, timestamp: Date.now() });
}

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    if (!process.env.OPENAI_API_KEY) {
      log.error('OpenAI API key not configured');
      throw new Error('OpenAI API key not configured. Set OPENAI_API_KEY environment variable.');
    }
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openaiClient;
}

/**
 * Generate embedding for a single text (with caching)
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  // Check cache first
  const cached = getCachedEmbedding(text);
  if (cached) {
    return cached;
  }

  const startTime = Date.now();
  const openai = getOpenAIClient();
  const textLength = text.length;

  log.debug('Generating embedding', { textLength });

  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
      dimensions: EMBEDDING_DIMENSIONS,
    });

    const durationMs = Date.now() - startTime;
    log.debug('Embedding generated', {
      textLength,
      durationMs,
      dimensions: EMBEDDING_DIMENSIONS,
    });

    const embedding = response.data[0].embedding;
    setCachedEmbedding(text, embedding);

    return embedding;
  } catch (error) {
    const durationMs = Date.now() - startTime;
    log.error('Embedding generation failed', {
      textLength,
      durationMs,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Generate embeddings for multiple texts (with caching)
 */
export async function generateEmbeddings(
  texts: string[]
): Promise<number[][]> {
  if (texts.length === 0) {
    log.debug('No texts provided for batch embedding');
    return [];
  }

  // Check cache for each text and separate into cached vs uncached
  const results: (number[] | null)[] = texts.map(() => null);
  const uncachedIndices: number[] = [];
  const uncachedTexts: string[] = [];

  for (let i = 0; i < texts.length; i++) {
    const cached = getCachedEmbedding(texts[i]);
    if (cached) {
      results[i] = cached;
    } else {
      uncachedIndices.push(i);
      uncachedTexts.push(texts[i]);
    }
  }

  const cacheHits = texts.length - uncachedTexts.length;
  if (cacheHits > 0) {
    log.debug('Batch embedding cache hits', { cacheHits, total: texts.length });
  }

  // If all texts were cached, return immediately
  if (uncachedTexts.length === 0) {
    return results as number[][];
  }

  const startTime = Date.now();
  const openai = getOpenAIClient();
  const totalChars = uncachedTexts.reduce((sum, t) => sum + t.length, 0);

  log.debug('Generating batch embeddings', {
    count: uncachedTexts.length,
    totalChars,
    cachedCount: cacheHits,
  });

  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: uncachedTexts,
      dimensions: EMBEDDING_DIMENSIONS,
    });

    const durationMs = Date.now() - startTime;
    log.info('Batch embeddings generated', {
      count: uncachedTexts.length,
      totalChars,
      durationMs,
    });

    // Merge results and cache new embeddings
    for (let i = 0; i < uncachedIndices.length; i++) {
      const embedding = response.data[i].embedding;
      const originalIndex = uncachedIndices[i];
      results[originalIndex] = embedding;
      setCachedEmbedding(uncachedTexts[i], embedding);
    }

    return results as number[][];
  } catch (error) {
    const durationMs = Date.now() - startTime;
    log.error('Batch embedding generation failed', {
      count: uncachedTexts.length,
      totalChars,
      durationMs,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Calculate cosine similarity between two vectors
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have same length');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

