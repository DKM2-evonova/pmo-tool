/**
 * Embedding Service for Semantic Matching
 * Uses OpenAI text-embedding-3-small by default
 */

import OpenAI from 'openai';
import { loggers } from '@/lib/logger';

const log = loggers.embedding;
const EMBEDDING_DIMENSIONS = 1536;

let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    if (!process.env.OPENAI_API_KEY) {
      log.error('OpenAI API key not configured');
    }
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openaiClient;
}

/**
 * Generate embedding for a single text
 */
export async function generateEmbedding(text: string): Promise<number[]> {
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

    return response.data[0].embedding;
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
 * Generate embeddings for multiple texts
 */
export async function generateEmbeddings(
  texts: string[]
): Promise<number[][]> {
  if (texts.length === 0) {
    log.debug('No texts provided for batch embedding');
    return [];
  }

  const startTime = Date.now();
  const openai = getOpenAIClient();
  const totalChars = texts.reduce((sum, t) => sum + t.length, 0);
  
  log.debug('Generating batch embeddings', { 
    count: texts.length,
    totalChars,
  });

  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: texts,
      dimensions: EMBEDDING_DIMENSIONS,
    });

    const durationMs = Date.now() - startTime;
    log.info('Batch embeddings generated', { 
      count: texts.length,
      totalChars,
      durationMs,
    });

    return response.data.map((d) => d.embedding);
  } catch (error) {
    const durationMs = Date.now() - startTime;
    log.error('Batch embedding generation failed', {
      count: texts.length,
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

