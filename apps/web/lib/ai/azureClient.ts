/**
 * AI generation client for suitability reports.
 * Uses OpenRouter (same provider as fact-find extraction).
 */

import {
  isOpenRouterConfigured,
  openRouterChatCompletion,
} from '@/lib/ai/openRouterClient';

export function isReportAiAvailable(): boolean {
  return isOpenRouterConfigured();
}

/** @deprecated Prefer isReportAiAvailable() — evaluated at module load. */
export const AI_AVAILABLE = isOpenRouterConfigured();

/** === FRONTEND ADDITION: health endpoint model label === */
export const MODEL_NAME = process.env.OPENROUTER_MODEL?.trim() || 'openrouter';
/** === END FRONTEND ADDITION === */

export interface GenerationMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * callOpenRouter — chat completion returning raw text (expected JSON).
 */
export async function callOpenRouter(
  messages: GenerationMessage[],
  maxTokens = 4096,
): Promise<string> {
  if (!isOpenRouterConfigured()) {
    throw new Error(
      'OpenRouter API key is not configured. Set OPENROUTER_API_KEY and optionally OPENROUTER_MODEL.',
    );
  }

  return openRouterChatCompletion({
    messages,
    response_format: { type: 'json_object' },
    max_tokens: maxTokens,
  });
}
