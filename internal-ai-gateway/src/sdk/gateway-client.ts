// Somail Gateway Client SDK v2.0
// Drop-in TypeScript/JavaScript client for the Somail AI Gateway

export type GatewayMessage = { role: 'system' | 'user' | 'assistant'; content: string };
export type TaskType = 'chat' | 'coding' | 'review' | 'test-generation' | 'repo-analysis' | 'spa-chat' | 'workflow';

export type ChatOptions = {
  model?: string;
  taskType?: TaskType;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
};

export type ChatResponse = {
  id: string;
  model: string;
  provider: string;
  content: string;
  usage: { input_tokens: number | null; output_tokens: number | null; source: string };
  latency_ms: number;
};

export type GatewayClientOptions = {
  baseUrl: string;
  apiKey: string;
  timeout?: number;
};

export class GatewayClient {
  private baseUrl: string;
  private apiKey: string;
  private timeout: number;

  constructor(options: GatewayClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.apiKey = options.apiKey;
    this.timeout = options.timeout ?? 120_000;
  }

  async chat(messages: GatewayMessage[], options: ChatOptions = {}): Promise<ChatResponse> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);
    try {
      const res = await fetch(this.baseUrl + '/v1/chat', {
        method: 'POST',
        signal: controller.signal,
        headers: { 'x-api-key': this.apiKey, 'content-type': 'application/json' },
        body: JSON.stringify({
          model: options.model ?? 'auto',
          task_type: options.taskType ?? 'chat',
          messages,
          temperature: options.temperature,
          max_tokens: options.maxTokens,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: { message: res.statusText } }));
        throw new Error((err as { error?: { message?: string } }).error?.message ?? res.statusText);
      }
      return res.json() as Promise<ChatResponse>;
    } finally {
      clearTimeout(timer);
    }
  }

  async *chatStream(messages: GatewayMessage[], options: Omit<ChatOptions, 'stream'> = {}): AsyncIterable<string> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);
    try {
      const res = await fetch(this.baseUrl + '/v1/chat', {
        method: 'POST',
        signal: controller.signal,
        headers: { 'x-api-key': this.apiKey, 'content-type': 'application/json' },
        body: JSON.stringify({
          model: options.model ?? 'auto',
          task_type: options.taskType ?? 'chat',
          messages,
          temperature: options.temperature,
          max_tokens: options.maxTokens,
          stream: true,
        }),
      });
      if (!res.ok || !res.body) throw new Error('Stream request failed: ' + res.status);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (raw === '[DONE]') return;
          try {
            const chunk = JSON.parse(raw) as { choices?: Array<{ delta?: { content?: string } }> };
            const content = chunk.choices?.[0]?.delta?.content;
            if (content) yield content;
          } catch {
            /* skip malformed */
          }
        }
      }
    } finally {
      clearTimeout(timer);
    }
  }

  async listModels(): Promise<Array<{ id: string; provider: string; provider_model: string }>> {
    const res = await fetch(this.baseUrl + '/v1/models', {
      headers: { 'x-api-key': this.apiKey },
    });
    const json = (await res.json()) as { data: Array<{ id: string; provider: string; provider_model: string }> };
    return json.data;
  }
}
