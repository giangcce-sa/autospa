// The Settings columns that must be encrypted at rest — pure, importable from tests.
// NOT the same as backup.ts's strip list: telegramChatId stays plaintext because
// the Telegram webhook routes on it by equality and the UI displays it.

export const SECRET_SETTINGS_FIELDS = [
  "claudeApiKey",
  "openaiApiKey",
  "zaloToken",
  "webhookVerifyToken",
  "spaApiKey",
  "spaWebhookSecret",
  "telegramBotToken",
  "telegramWebhookSecret",
  "runwayApiKey",
  "elevenLabsApiKey",
  "syncLabsApiKey",
] as const;

export type SecretSettingsField = (typeof SECRET_SETTINGS_FIELDS)[number];

/**
 * Returns a copy of the patch with every listed non-empty string field passed
 * through `encrypt`. Empty strings, null/undefined, and non-listed fields are
 * untouched. Encrypt is injected so this module stays pure.
 */
export function encryptSettingsSecrets<T extends Record<string, unknown>>(
  patch: T,
  encrypt: (value: string) => string
): T {
  const out: Record<string, unknown> = { ...patch };
  for (const field of SECRET_SETTINGS_FIELDS) {
    const value = out[field];
    if (typeof value === "string" && value !== "") {
      out[field] = encrypt(value);
    }
  }
  return out as T;
}
