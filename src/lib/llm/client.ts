/**
 * LLM Client Abstraction Layer
 * Supports Gemini 3 Pro Preview (primary), GPT-5.2 (fallback), and Gemini 2.0 Flash (utility)
 *
 * Updated December 2025 to use @google/genai SDK
 */

import { GoogleGenAI } from '@google/genai';
import OpenAI from 'openai';
import { loggers } from '@/lib/logger';

const log = loggers.llm;

export type LLMModel = 'gemini-3-pro-preview' | 'gpt-5.2' | 'gemini-2.0-flash';

/**
 * LLM Generation Settings
 * These settings are optimized for quality meeting analysis output.
 * Increase maxOutputTokens if output is being truncated.
 */
export const LLM_SETTINGS = {
  // Primary model (Gemini 3 Pro) settings
  gemini: {
    maxOutputTokens: 8192, // Allows complete extraction of all items with evidence
    temperature: 0.3, // Low for consistent, structured JSON output
    topP: 0.95, // Slightly reduced to focus on higher-probability tokens
    topK: 40, // Limits vocabulary for more consistent output
  },
  // Fallback model (OpenAI) settings
  openai: {
    maxTokens: 8192, // Match Gemini for consistency
    temperature: 0.3, // Low for structured output
  },
  // Utility model (Gemini 2.0 Flash) settings - for JSON repair
  geminiFlash: {
    maxOutputTokens: 16384, // Large enough to handle full meeting JSON repair
    temperature: 0.1, // Very low for deterministic JSON output
  },
} as const;

interface LLMResponse {
  content: string;
  model: LLMModel;
  isFallback: boolean;
  latencyMs: number;
}

interface LLMClientConfig {
  googleApiKey?: string;
  openaiApiKey?: string;
}

export class LLMClient {
  private gemini: GoogleGenAI | null = null;
  private openai: OpenAI | null = null;

  constructor(config?: LLMClientConfig) {
    const googleKey = config?.googleApiKey || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    const openaiKey = config?.openaiApiKey || process.env.OPENAI_API_KEY;

    if (googleKey) {
      this.gemini = new GoogleGenAI({ apiKey: googleKey });
    }
    if (openaiKey) {
      this.openai = new OpenAI({ apiKey: openaiKey });
    }
  }

  /**
   * Generate content using primary model with fallback
   */
  async generate(
    prompt: string,
    systemPrompt?: string,
    options?: { jsonMode?: boolean }
  ): Promise<LLMResponse> {
    const startTime = Date.now();
    const promptLength = prompt.length;
    const systemPromptLength = systemPrompt?.length || 0;
    const totalInputChars = promptLength + systemPromptLength;
    const jsonMode = options?.jsonMode ?? false;

    log.info('LLM generation request', {
      promptLength,
      systemPromptLength,
      totalInputChars,
      jsonMode,
      hasGemini: !!this.gemini,
      hasOpenAI: !!this.openai,
    });

    // Try Gemini 3 Pro first
    try {
      if (this.gemini) {
        log.debug('Attempting Gemini generation', {
          model: 'gemini-3-pro-preview',
          maxOutputTokens: LLM_SETTINGS.gemini.maxOutputTokens,
          temperature: LLM_SETTINGS.gemini.temperature,
          jsonMode,
        });

        const fullPrompt = systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt;

        const response = await this.gemini.models.generateContent({
          model: 'gemini-3-pro-preview',
          contents: fullPrompt,
          config: {
            maxOutputTokens: LLM_SETTINGS.gemini.maxOutputTokens,
            temperature: LLM_SETTINGS.gemini.temperature,
            topP: LLM_SETTINGS.gemini.topP,
            topK: LLM_SETTINGS.gemini.topK,
            ...(jsonMode && { responseMimeType: 'application/json' }),
          },
        });

        const text = response.text || '';
        const latencyMs = Date.now() - startTime;

        log.info('Gemini generation successful', {
          model: 'gemini-3-pro-preview',
          inputChars: totalInputChars,
          outputChars: text.length,
          latencyMs,
          jsonMode,
        });

        return {
          content: text,
          model: 'gemini-3-pro-preview',
          isFallback: false,
          latencyMs,
        };
      }
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      log.warn('Gemini generation failed, attempting fallback', {
        model: 'gemini-3-pro-preview',
        latencyMs,
        error: error instanceof Error ? error.message : 'Unknown error',
        errorName: error instanceof Error ? error.name : undefined,
      });
    }

    // Fallback to GPT-5.2
    try {
      if (this.openai) {
        log.debug('Attempting OpenAI fallback', {
          model: 'gpt-5.2',
          maxTokens: LLM_SETTINGS.openai.maxTokens,
          temperature: LLM_SETTINGS.openai.temperature,
        });

        const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
        if (systemPrompt) {
          messages.push({ role: 'system', content: systemPrompt });
        }
        messages.push({ role: 'user', content: prompt });

        const response = await this.openai.chat.completions.create({
          model: 'gpt-5.2',
          messages,
          temperature: LLM_SETTINGS.openai.temperature,
          max_tokens: LLM_SETTINGS.openai.maxTokens,
          response_format: { type: 'json_object' }, // Ensures valid JSON output
        });

        const content = response.choices[0]?.message?.content || '';
        const latencyMs = Date.now() - startTime;

        log.info('OpenAI fallback successful', {
          model: 'gpt-5.2',
          inputChars: totalInputChars,
          outputChars: content.length,
          latencyMs,
          isFallback: true,
          usage: response.usage,
        });

        return {
          content,
          model: 'gpt-5.2',
          isFallback: true,
          latencyMs,
        };
      }
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      log.error('All LLM providers failed', {
        latencyMs,
        error: error instanceof Error ? error.message : 'Unknown error',
        errorName: error instanceof Error ? error.name : undefined,
      });
      throw new Error(`Both Gemini and OpenAI failed. OpenAI error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    log.error('No LLM providers configured');
    throw new Error('No LLM providers configured');
  }

  /**
   * Generate JSON using primary model with fallback
   * Uses JSON mode for guaranteed valid JSON output
   */
  async generateJSON<T>(
    prompt: string,
    systemPrompt?: string
  ): Promise<{ data: T } & LLMResponse> {
    log.debug('Generating JSON response with JSON mode enabled');
    const response = await this.generate(prompt, systemPrompt, { jsonMode: true });

    // Extract JSON from response using multiple strategies
    let jsonString = response.content.trim();
    let extractionMethod = 'direct';

    // Strategy 1: Check for markdown code blocks (some models still wrap even in JSON mode)
    const jsonMatch = response.content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonString = jsonMatch[1].trim();
      extractionMethod = 'markdown';
    } else {
      // Strategy 2: Find JSON object boundaries if content has extra text
      const firstBrace = response.content.indexOf('{');
      const lastBrace = response.content.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace > firstBrace && firstBrace !== 0) {
        jsonString = response.content.substring(firstBrace, lastBrace + 1);
        extractionMethod = 'boundaries';
      }
    }

    try {
      const data = JSON.parse(jsonString) as T;
      log.debug('JSON parsed successfully', {
        extractionMethod,
        jsonLength: jsonString.length,
      });
      return { ...response, data };
    } catch (parseError) {
      log.error('JSON parsing failed', {
        extractionMethod,
        jsonLength: jsonString.length,
        rawContentPreview: response.content.substring(0, 500),
        parseError: parseError instanceof Error ? parseError.message : 'Unknown error',
      });
      throw new Error(`Failed to parse JSON from LLM response: ${parseError instanceof Error ? parseError.message : 'Unknown parse error'}`);
    }
  }

  /**
   * Use utility model (Gemini 2.0 Flash) for JSON validation/repair
   */
  async repairJSON(
    invalidJson: string,
    validationErrors: string
  ): Promise<LLMResponse> {
    const startTime = Date.now();

    log.info('Attempting JSON repair', {
      invalidJsonLength: invalidJson.length,
      validationErrorsLength: validationErrors.length,
    });

    const prompt = `You are a JSON repair assistant. Fix the validation errors in the provided JSON.

VALIDATION ERRORS (these need to be fixed):
${validationErrors}

JSON TO FIX:
${invalidJson}

INSTRUCTIONS:
1. Fix ONLY the fields mentioned in the validation errors
2. Preserve all other data exactly as-is
3. Return ONLY the corrected JSON object - no markdown, no explanation, no code blocks
4. The response must be valid parseable JSON starting with { and ending with }

CORRECTED JSON:`;

    if (this.gemini) {
      try {
        const response = await this.gemini.models.generateContent({
          model: 'gemini-2.0-flash',
          contents: prompt,
          config: {
            maxOutputTokens: LLM_SETTINGS.geminiFlash.maxOutputTokens,
            temperature: LLM_SETTINGS.geminiFlash.temperature,
            responseMimeType: 'application/json', // Force JSON output
          },
        });

        const text = response.text || '';

        // Extract JSON using multiple strategies
        let content = text.trim();

        // Strategy 1: Check for markdown code blocks
        const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) {
          content = jsonMatch[1].trim();
        } else {
          // Strategy 2: Find JSON object boundaries
          const firstBrace = text.indexOf('{');
          const lastBrace = text.lastIndexOf('}');
          if (firstBrace !== -1 && lastBrace > firstBrace) {
            content = text.substring(firstBrace, lastBrace + 1);
          }
        }

        const latencyMs = Date.now() - startTime;

        // Validate it's actually parseable JSON before returning
        try {
          JSON.parse(content);
        } catch {
          log.error('JSON repair produced invalid JSON', {
            latencyMs,
            rawResponsePreview: text.substring(0, 500),
            extractedContentPreview: content.substring(0, 500),
          });
          throw new Error('JSON repair produced invalid JSON output');
        }

        log.info('JSON repair completed', {
          inputLength: invalidJson.length,
          outputLength: content.length,
          latencyMs,
        });

        return {
          content,
          model: 'gemini-2.0-flash',
          isFallback: false,
          latencyMs,
        };
      } catch (error) {
        const latencyMs = Date.now() - startTime;
        log.error('JSON repair failed', {
          latencyMs,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
      }
    }

    log.error('JSON repair unavailable - Gemini Flash not configured');
    throw new Error('Gemini 2.0 Flash not configured for JSON repair functionality');
  }
}

// Singleton instance
let llmClient: LLMClient | null = null;

export function getLLMClient(): LLMClient {
  if (!llmClient) {
    llmClient = new LLMClient();
  }
  return llmClient;
}
