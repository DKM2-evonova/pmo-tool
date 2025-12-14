/**
 * LLM Client Abstraction Layer
 * Supports Gemini 3 Pro Preview (primary), GPT-5.2 (fallback), and Gemini 2.5 Flash (utility)
 */

import { GoogleGenerativeAI, GenerationConfig } from '@google/generative-ai';
import OpenAI from 'openai';
import { loggers } from '@/lib/logger';

const log = loggers.llm;

export type LLMModel = 'gemini-3-pro-preview' | 'gpt-5.2' | 'gemini-2.5-flash';

/**
 * LLM Generation Settings
 * These settings are optimized for quality meeting analysis output.
 * Increase maxOutputTokens if output is being truncated.
 */
export const LLM_SETTINGS = {
  // Primary model (Gemini) settings
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
  // Utility model (Gemini Flash) settings - for JSON repair
  geminiFlash: {
    maxOutputTokens: 4096, // Sufficient for JSON repair tasks
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
  private gemini: GoogleGenerativeAI | null = null;
  private openai: OpenAI | null = null;

  constructor(config?: LLMClientConfig) {
    const googleKey = config?.googleApiKey || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    const openaiKey = config?.openaiApiKey || process.env.OPENAI_API_KEY;

    if (googleKey) {
      this.gemini = new GoogleGenerativeAI(googleKey);
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
    systemPrompt?: string
  ): Promise<LLMResponse> {
    const startTime = Date.now();
    const promptLength = prompt.length;
    const systemPromptLength = systemPrompt?.length || 0;
    const totalInputChars = promptLength + systemPromptLength;
    
    log.info('LLM generation request', {
      promptLength,
      systemPromptLength,
      totalInputChars,
      hasGemini: !!this.gemini,
      hasOpenAI: !!this.openai,
    });

    // Try Gemini first
    try {
      if (this.gemini) {
        log.debug('Attempting Gemini generation', {
          model: 'gemini-3-pro-preview',
          maxOutputTokens: LLM_SETTINGS.gemini.maxOutputTokens,
          temperature: LLM_SETTINGS.gemini.temperature,
        });
        
        const generationConfig: GenerationConfig = {
          maxOutputTokens: LLM_SETTINGS.gemini.maxOutputTokens,
          temperature: LLM_SETTINGS.gemini.temperature,
          topP: LLM_SETTINGS.gemini.topP,
          topK: LLM_SETTINGS.gemini.topK,
        };
        
        const model = this.gemini.getGenerativeModel({ 
          model: 'gemini-3-pro-preview',
          generationConfig,
        });
        const result = await model.generateContent({
          contents: [
            {
              role: 'user',
              parts: [
                { text: systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt },
              ],
            },
          ],
        });
        const response = result.response;
        const text = response.text();
        const latencyMs = Date.now() - startTime;

        log.info('Gemini generation successful', {
          model: 'gemini-3-pro-preview',
          inputChars: totalInputChars,
          outputChars: text.length,
          latencyMs,
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
   */
  async generateJSON<T>(
    prompt: string,
    systemPrompt?: string
  ): Promise<{ data: T } & LLMResponse> {
    log.debug('Generating JSON response');
    const response = await this.generate(prompt, systemPrompt);

    // Extract JSON from response
    const jsonMatch = response.content.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonString = jsonMatch ? jsonMatch[1].trim() : response.content.trim();
    const wasWrapped = !!jsonMatch;

    try {
      const data = JSON.parse(jsonString) as T;
      log.debug('JSON parsed successfully', {
        wasWrapped,
        jsonLength: jsonString.length,
      });
      return { ...response, data };
    } catch (parseError) {
      log.error('JSON parsing failed', {
        wasWrapped,
        jsonLength: jsonString.length,
        rawContentPreview: response.content.substring(0, 200),
        parseError: parseError instanceof Error ? parseError.message : 'Unknown error',
      });
      throw new Error(`Failed to parse JSON from LLM response: ${parseError instanceof Error ? parseError.message : 'Unknown parse error'}`);
    }
  }

  /**
   * Use utility model (Gemini 2.5 Flash) for JSON validation/repair
   */
  async repairJSON(
    invalidJson: string,
    schema: string
  ): Promise<LLMResponse> {
    const startTime = Date.now();
    
    log.info('Attempting JSON repair', {
      invalidJsonLength: invalidJson.length,
      schemaLength: schema.length,
    });

    const prompt = `Fix this invalid JSON to match the schema. Return ONLY valid JSON, no explanation.

Schema:
${schema}

Invalid JSON:
${invalidJson}

Fixed JSON:`;

    if (this.gemini) {
      const generationConfig: GenerationConfig = {
        maxOutputTokens: LLM_SETTINGS.geminiFlash.maxOutputTokens,
        temperature: LLM_SETTINGS.geminiFlash.temperature,
      };
      
      const model = this.gemini.getGenerativeModel({ 
        model: 'gemini-2.5-flash',
        generationConfig,
      });
      
      try {
        const result = await model.generateContent(prompt);
        const text = result.response.text();

        // Extract JSON
        const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
        const content = jsonMatch ? jsonMatch[1].trim() : text.trim();
        const latencyMs = Date.now() - startTime;

        log.info('JSON repair completed', {
          inputLength: invalidJson.length,
          outputLength: content.length,
          latencyMs,
        });

        return {
          content,
          model: 'gemini-2.5-flash',
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
    throw new Error('Gemini 2.5 Flash not configured for JSON repair functionality');
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

