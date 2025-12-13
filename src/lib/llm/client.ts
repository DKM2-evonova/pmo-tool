/**
 * LLM Client Abstraction Layer
 * Supports Gemini 3 Pro Preview (primary), GPT-5.2 (fallback), and Gemini 2.5 Flash (utility)
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';

export type LLMModel = 'gemini-3-pro-preview' | 'gpt-5.2' | 'gemini-2.5-flash';

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

    // Try Gemini first
    try {
      if (this.gemini) {
        const model = this.gemini.getGenerativeModel({ model: 'gemini-3-pro-preview' });
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

        return {
          content: text,
          model: 'gemini-3-pro-preview',
          isFallback: false,
          latencyMs: Date.now() - startTime,
        };
      }
    } catch (error) {
      console.error('Gemini failed, trying fallback:', error);
    }

    // Fallback to GPT-5.2
    try {
      if (this.openai) {
        const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
        if (systemPrompt) {
          messages.push({ role: 'system', content: systemPrompt });
        }
        messages.push({ role: 'user', content: prompt });

        const response = await this.openai.chat.completions.create({
          model: 'gpt-5.2',
          messages,
          temperature: 0.3,
        });

        return {
          content: response.choices[0]?.message?.content || '',
          model: 'gpt-5.2',
          isFallback: true,
          latencyMs: Date.now() - startTime,
        };
      }
    } catch (error) {
      console.error('GPT-5.2 fallback failed:', error);
      throw error;
    }

    throw new Error('No LLM providers configured');
  }

  /**
   * Generate JSON using primary model with fallback
   */
  async generateJSON<T>(
    prompt: string,
    systemPrompt?: string
  ): Promise<{ data: T } & LLMResponse> {
    const response = await this.generate(prompt, systemPrompt);

    // Extract JSON from response
    const jsonMatch = response.content.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonString = jsonMatch ? jsonMatch[1].trim() : response.content.trim();

    try {
      const data = JSON.parse(jsonString) as T;
      return { ...response, data };
    } catch {
      throw new Error('Failed to parse JSON from LLM response');
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

    const prompt = `Fix this invalid JSON to match the schema. Return ONLY valid JSON, no explanation.

Schema:
${schema}

Invalid JSON:
${invalidJson}

Fixed JSON:`;

    if (this.gemini) {
      const model = this.gemini.getGenerativeModel({ model: 'gemini-2.5-flash' });
      const result = await model.generateContent(prompt);
      const text = result.response.text();

      // Extract JSON
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      const content = jsonMatch ? jsonMatch[1].trim() : text.trim();

      return {
        content,
        model: 'gemini-2.5-flash',
        isFallback: false,
        latencyMs: Date.now() - startTime,
      };
    }

    throw new Error('Gemini 2.5 Flash not configured');
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

