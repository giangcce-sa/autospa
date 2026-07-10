import { nanoid } from "nanoid";
import { generateApiKey, hashApiKey, isLegacyHash, parseApiKeyPrefix, verifyApiKeyHash } from "../api-keys.js";
import { getDb } from "../client.js";
import { dispatchWebhook } from "../../observability/webhook-dispatcher.js";
import { resolvePolicyForContext } from "./policies.js";
import type { ApiKeyContext, ApiKeyRecord, ClientRecord, UserRecord } from "./types.js";

function now(): string {
  return new Date().toISOString();
}

export type PublicApiKeyRecord = Omit<ApiKeyRecord, "key_hash">;

function publicKey(record: ApiKeyRecord): PublicApiKeyRecord {
  const { key_hash: _keyHash, ...rest } = record;
  return rest;
}

export function listApiKeys(): PublicApiKeyRecord[] {
  const rows = getDb().prepare("SELECT * FROM api_keys ORDER BY created_at DESC").all() as ApiKeyRecord[];
  return rows.map(publicKey);
}

export function createApiKey(input: {
  userId: string;
  clientId: string;
  name: string;
  mode?: "live" | "test";
  expiresAt?: string | null;
}): PublicApiKeyRecord & { raw_key: string } {
  const generated = generateApiKey(input.mode ?? "live");
  const record: ApiKeyRecord = {
    id: `key_${nanoid(10)}`,
    user_id: input.userId,
    client_id: input.clientId,
    name: input.name,
    key_prefix: generated.prefix,
    key_hash: generated.hash,
    status: "active",
    last_used_at: null,
    expires_at: input.expiresAt ?? null,
    created_at: now(),
    revoked_at: null
  };

  getDb()
    .prepare(
      `INSERT INTO api_keys
       (id, user_id, client_id, name, key_prefix, key_hash, status, last_used_at, expires_at, created_at, revoked_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      record.id,
      record.user_id,
      record.client_id,
      record.name,
      record.key_prefix,
      record.key_hash,
      record.status,
      record.last_used_at,
      record.expires_at,
      record.created_at,
      record.revoked_at
    );

  dispatchWebhook("key.created", {
    api_key_id: record.id,
    user_id: record.user_id,
    client_id: record.client_id,
    name: record.name,
    key_prefix: record.key_prefix
  }).catch(() => {});

  return {
    ...publicKey(record),
    raw_key: generated.rawKey
  };
}

export function revokeApiKey(id: string): PublicApiKeyRecord | undefined {
  getDb().prepare("UPDATE api_keys SET status = 'revoked', revoked_at = ? WHERE id = ?").run(now(), id);
  const record = getDb().prepare("SELECT * FROM api_keys WHERE id = ?").get(id) as ApiKeyRecord | undefined;
  if (record) {
    dispatchWebhook("key.revoked", {
      api_key_id: record.id,
      user_id: record.user_id,
      client_id: record.client_id,
      key_prefix: record.key_prefix
    }).catch(() => {});
  }
  return record ? publicKey(record) : undefined;
}

export function rotateApiKey(id: string): (PublicApiKeyRecord & { raw_key: string }) | undefined {
  const existing = getDb().prepare("SELECT * FROM api_keys WHERE id = ?").get(id) as ApiKeyRecord | undefined;
  if (!existing) return undefined;

  const generated = generateApiKey("live");
  getDb()
    .prepare("UPDATE api_keys SET key_prefix = ?, key_hash = ?, status = 'active', revoked_at = NULL WHERE id = ?")
    .run(generated.prefix, generated.hash, id);

  const updated = getDb().prepare("SELECT * FROM api_keys WHERE id = ?").get(id) as ApiKeyRecord;
  return {
    ...publicKey(updated),
    raw_key: generated.rawKey
  };
}

export function findApiKeyContext(rawKey: string): ApiKeyContext | undefined {
  return resolveApiKeyContext(rawKey, true);
}

export function inspectApiKeyContext(rawKey: string): ApiKeyContext | undefined {
  return resolveApiKeyContext(rawKey, false);
}

function resolveApiKeyContext(rawKey: string, touchLastUsed: boolean): ApiKeyContext | undefined {
  const prefix = parseApiKeyPrefix(rawKey);
  if (!prefix) return undefined;

  const apiKey = getDb().prepare("SELECT * FROM api_keys WHERE key_prefix = ?").get(prefix) as ApiKeyRecord | undefined;

  if (!apiKey || apiKey.status !== "active") return undefined;
  if (!verifyApiKeyHash(rawKey, apiKey.key_hash)) return undefined;

  if (apiKey.expires_at && new Date(apiKey.expires_at).getTime() <= Date.now()) {
    return undefined;
  }

  const user = getDb().prepare("SELECT * FROM users WHERE id = ?").get(apiKey.user_id) as UserRecord | undefined;
  const client = getDb().prepare("SELECT * FROM clients WHERE id = ?").get(apiKey.client_id) as ClientRecord | undefined;

  if (!user || !client || user.status !== "active" || client.status !== "active") {
    return undefined;
  }

  const nowStr = now();

  // Lazy-upgrade legacy SHA256 hash to scrypt on successful auth
  if (touchLastUsed && isLegacyHash(apiKey.key_hash)) {
    getDb()
      .prepare("UPDATE api_keys SET key_hash = ?, last_used_at = ? WHERE id = ?")
      .run(hashApiKey(rawKey), nowStr, apiKey.id);
  } else if (touchLastUsed) {
    getDb().prepare("UPDATE api_keys SET last_used_at = ? WHERE id = ?").run(nowStr, apiKey.id);
  }

  return {
    apiKey,
    user,
    client,
    policy: resolvePolicyForContext({ apiKeyId: apiKey.id, clientId: client.id, userId: user.id })
  };
}

export function findApiKeyContextById(apiKeyId: string): ApiKeyContext | undefined {
  const apiKey = getDb().prepare("SELECT * FROM api_keys WHERE id = ?").get(apiKeyId) as ApiKeyRecord | undefined;
  if (!apiKey || apiKey.status !== "active") return undefined;

  const user = getDb().prepare("SELECT * FROM users WHERE id = ?").get(apiKey.user_id) as UserRecord | undefined;
  const client = getDb().prepare("SELECT * FROM clients WHERE id = ?").get(apiKey.client_id) as ClientRecord | undefined;
  if (!user || !client || user.status !== "active" || client.status !== "active") return undefined;

  return {
    apiKey,
    user,
    client,
    policy: resolvePolicyForContext({ apiKeyId: apiKey.id, clientId: client.id, userId: user.id })
  };
}
