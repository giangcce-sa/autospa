import { env } from "./env.js";

export type ClientId = "claude-code" | "cursor" | "n8n" | "ai-spa";

export type ClientPolicy = {
  clientId: ClientId;
  apiKey?: string;
  allowedModels: string[];
  rateLimitPerMinute: number;
  maxInputCharacters: number;
  allowTools: boolean;
  logPrompts: boolean;
};

export const clientPolicies: ClientPolicy[] = [
  {
    clientId: "claude-code",
    apiKey: env.CLAUDE_CODE_GATEWAY_KEY,
    allowedModels: ["claude-sonnet", "gpt-4.1-mini", "kiro-pro"],
    rateLimitPerMinute: 60,
    maxInputCharacters: 120_000,
    allowTools: true,
    logPrompts: false
  },
  {
    clientId: "cursor",
    apiKey: env.CURSOR_GATEWAY_KEY,
    allowedModels: ["claude-sonnet", "gpt-4.1-mini", "kiro-pro"],
    rateLimitPerMinute: 60,
    maxInputCharacters: 120_000,
    allowTools: true,
    logPrompts: false
  },
  {
    clientId: "n8n",
    apiKey: env.N8N_GATEWAY_KEY,
    allowedModels: ["gpt-4.1-mini", "kiro-pro"],
    rateLimitPerMinute: 30,
    maxInputCharacters: 60_000,
    allowTools: true,
    logPrompts: false
  },
  {
    clientId: "ai-spa",
    apiKey: env.AI_SPA_GATEWAY_KEY,
    allowedModels: ["gpt-4.1-mini", "claude-sonnet"],
    rateLimitPerMinute: 120,
    maxInputCharacters: 30_000,
    allowTools: false,
    logPrompts: false
  }
];

export function findPolicyByApiKey(apiKey: string): ClientPolicy | undefined {
  return clientPolicies.find((policy) => policy.apiKey && policy.apiKey === apiKey);
}
