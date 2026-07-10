export type UserRole = "owner" | "admin" | "member" | "service";
export type EntityStatus = "active" | "suspended";
export type ApiKeyStatus = "active" | "revoked";
export type ClientType = "human" | "service" | "workflow" | "spa-system" | "coding-tool";

export type UserRecord = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  status: EntityStatus;
  created_at: string;
  updated_at: string;
};

export type ClientRecord = {
  id: string;
  name: string;
  type: ClientType;
  owner_user_id: string;
  status: EntityStatus;
  created_at: string;
  updated_at: string;
};

export type ApiKeyRecord = {
  id: string;
  user_id: string;
  client_id: string;
  name: string;
  key_prefix: string;
  key_hash: string;
  status: ApiKeyStatus;
  last_used_at: string | null;
  expires_at: string | null;
  created_at: string;
  revoked_at: string | null;
};

export type PolicyRecord = {
  id: string;
  scope_type: "global" | "user" | "client" | "api_key";
  scope_id: string;
  allowed_models: string;
  allowed_task_types: string;
  allowed_providers: string | null;
  allowed_cost_tiers: string | null;
  rate_limit_per_minute: number;
  daily_request_limit: number | null;
  monthly_token_limit: number | null;
  max_input_characters: number;
  allow_tools: number;
  log_prompts: number;
  created_at: string;
  updated_at: string;
};

export type ResolvedPolicy = {
  allowedModels: string[];
  allowedTaskTypes: string[];
  allowedProviders: string[];
  allowedCostTiers: string[];
  rateLimitPerMinute: number;
  dailyRequestLimit: number | null;
  monthlyTokenLimit: number | null;
  maxInputCharacters: number;
  allowTools: boolean;
  logPrompts: boolean;
  source: string;
};

export type ApiKeyContext = {
  apiKey: ApiKeyRecord;
  user: UserRecord;
  client: ClientRecord;
  policy: ResolvedPolicy;
};
