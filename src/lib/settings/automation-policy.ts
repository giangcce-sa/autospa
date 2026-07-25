import { z } from "zod";
import { getSecretReplacement } from "../settings-secrets.ts";

export const AUTOMATION_SETTINGS_DEFAULTS = {
  webhookMode: "manual",
  autoReplyComments: false,
  autoReplyMessages: false,
  leadHandoffMode: "staff",
  leadHandoffLink: null,
  automationLevel: "supervised",
  zaloApprovalRecipient: null,
} as const;

const stringField = z.string().trim().max(500);
const nullableStringField = stringField.transform((value) => value || null);
const leadHandoffLinkField = nullableStringField.refine((value) => {
  if (value === null) return true;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}, { message: "Link đặt lịch phải là URL HTTP hoặc HTTPS hợp lệ" });

const automationPatchSchema = z.object({
  webhookVerifyToken: stringField.optional(),
  webhookMode: z.enum(["manual", "auto"]).optional(),
  autoReplyComments: z.boolean().optional(),
  autoReplyMessages: z.boolean().optional(),
  leadHandoffMode: z.enum(["link", "api", "staff"]).optional(),
  leadHandoffLink: leadHandoffLinkField.optional(),
  automationLevel: z.enum(["supervised", "semi", "full"]).optional(),
  zaloApprovalRecipient: nullableStringField.optional(),
});

const canonicalAutomationSchema = automationPatchSchema.strict();

export type AutomationSettingsPatch = {
  webhookVerifyToken?: string;
  webhookMode?: "manual" | "auto";
  autoReplyComments?: boolean;
  autoReplyMessages?: boolean;
  leadHandoffMode?: "link" | "api" | "staff";
  leadHandoffLink?: string | null;
  automationLevel?: "supervised" | "semi" | "full";
  zaloApprovalRecipient?: string | null;
};

export interface AutomationSettingsDto {
  webhookMode: "manual" | "auto";
  autoReplyComments: boolean;
  autoReplyMessages: boolean;
  leadHandoffMode: "link" | "api" | "staff";
  leadHandoffLink: string;
  automationLevel: "supervised" | "semi" | "full";
  zaloApprovalRecipient: string;
  hasWebhookVerifyToken: boolean;
}

function toPatch(value: z.infer<typeof automationPatchSchema>): AutomationSettingsPatch {
  const { webhookVerifyToken, ...fields } = value;
  const replacement = getSecretReplacement(webhookVerifyToken);
  return replacement ? { ...fields, webhookVerifyToken: replacement } : fields;
}

export function parseAutomationSettingsPatch(input: unknown): AutomationSettingsPatch {
  const value = input && typeof input === "object" ? input : {};
  return toPatch(automationPatchSchema.parse(value));
}

export function parseCanonicalAutomationRequest(input: unknown): AutomationSettingsPatch {
  const patch = toPatch(canonicalAutomationSchema.parse(input));
  if (Object.keys(patch).length === 0) {
    throw new z.ZodError([{
      code: "custom",
      path: [],
      message: "Không có cấu hình tự động hóa để cập nhật",
    }]);
  }
  return patch;
}

export function toAutomationSettingsDto(settings: {
  webhookVerifyToken?: string | null;
  webhookMode?: string | null;
  autoReplyComments?: boolean | null;
  autoReplyMessages?: boolean | null;
  leadHandoffMode?: string | null;
  leadHandoffLink?: string | null;
  automationLevel?: string | null;
  zaloApprovalRecipient?: string | null;
} | null | undefined): AutomationSettingsDto {
  const webhookMode = settings?.webhookMode === "auto" ? "auto" : "manual";
  const leadHandoffMode = ["link", "api", "staff"].includes(settings?.leadHandoffMode ?? "")
    ? settings!.leadHandoffMode as AutomationSettingsDto["leadHandoffMode"]
    : AUTOMATION_SETTINGS_DEFAULTS.leadHandoffMode;
  const automationLevel = ["supervised", "semi", "full"].includes(settings?.automationLevel ?? "")
    ? settings!.automationLevel as AutomationSettingsDto["automationLevel"]
    : AUTOMATION_SETTINGS_DEFAULTS.automationLevel;

  return {
    webhookMode,
    autoReplyComments: settings?.autoReplyComments ?? AUTOMATION_SETTINGS_DEFAULTS.autoReplyComments,
    autoReplyMessages: settings?.autoReplyMessages ?? AUTOMATION_SETTINGS_DEFAULTS.autoReplyMessages,
    leadHandoffMode,
    leadHandoffLink: settings?.leadHandoffLink ?? "",
    automationLevel,
    zaloApprovalRecipient: settings?.zaloApprovalRecipient ?? "",
    hasWebhookVerifyToken: Boolean(settings?.webhookVerifyToken),
  };
}
