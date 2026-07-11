/**
 * OpenRouter chat completions client.
 * Used for fact-find document extraction and other AI features.
 */

export type OpenRouterMessageContent =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }
  | { type: 'file'; file: { filename: string; file_data: string } };

export interface OpenRouterChatRequest {
  model: string;
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string | OpenRouterMessageContent[];
  }>;
  response_format?: { type: 'json_object' };
  temperature?: number;
  max_tokens?: number;
  plugins?: Array<{ id: string; pdf?: { engine: string } }>;
}

export interface OpenRouterChatResponse {
  choices: Array<{
    message: { content: string | null };
  }>;
  error?: { message: string };
}

function getOpenRouterConfig() {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  const model = process.env.OPENROUTER_MODEL?.trim() || 'google/gemini-2.5-flash';
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is not configured');
  }
  return { apiKey, model };
}

export function isOpenRouterConfigured(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY?.trim());
}

export async function openRouterChatCompletion(
  request: Omit<OpenRouterChatRequest, 'model'> & { model?: string },
): Promise<string> {
  const { apiKey, model: defaultModel } = getOpenRouterConfig();
  const model = request.model ?? defaultModel;

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001',
      'X-Title': 'KO Broker Platform',
    },
    body: JSON.stringify({
      ...request,
      model,
    }),
  });

  const payload = (await response.json()) as OpenRouterChatResponse;

  if (!response.ok) {
    const message =
      payload.error?.message ||
      (typeof payload === 'object' && payload !== null && 'error' in payload
        ? String((payload as { error?: unknown }).error)
        : `OpenRouter request failed (${response.status})`);
    throw new Error(message);
  }

  const content = payload.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('OpenRouter returned an empty response');
  }

  return content;
}
