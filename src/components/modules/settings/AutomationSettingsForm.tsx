"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { UnsavedChangesGuard } from "@/components/workspace/UnsavedChangesGuard";
import type { AutomationSettingsDto } from "@/lib/settings/automation-policy";
import { AutomationSettingsFields, type AutomationSettingsFormValue } from "./AutomationSettingsFields";

function formValue(settings: AutomationSettingsDto): AutomationSettingsFormValue {
  return { ...settings, webhookVerifyToken: "" };
}

function comparable(value: AutomationSettingsFormValue) {
  return JSON.stringify(value);
}

export function AutomationSettingsForm({ initialSettings }: { initialSettings: AutomationSettingsDto }) {
  const [baseline, setBaseline] = useState(() => formValue(initialSettings));
  const [value, setValue] = useState(() => formValue(initialSettings));
  const [hasWebhookVerifyToken, setHasWebhookVerifyToken] = useState(initialSettings.hasWebhookVerifyToken);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const dirty = useMemo(() => comparable(value) !== comparable(baseline), [baseline, value]);

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const payload = {
        webhookMode: value.webhookMode,
        autoReplyComments: value.autoReplyComments,
        autoReplyMessages: value.autoReplyMessages,
        leadHandoffMode: value.leadHandoffMode,
        leadHandoffLink: value.leadHandoffLink,
        automationLevel: value.automationLevel,
        zaloApprovalRecipient: value.zaloApprovalRecipient,
        ...(value.webhookVerifyToken.trim() ? { webhookVerifyToken: value.webhookVerifyToken } : {}),
      };
      const response = await fetch("/api/settings/automation", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        setMessage({ type: "error", text: result.error ?? "Không thể lưu cấu hình tự động hóa" });
        return;
      }
      const next = formValue(result.data as AutomationSettingsDto);
      setValue(next);
      setBaseline(next);
      setHasWebhookVerifyToken(Boolean(result.data.hasWebhookVerifyToken));
      setMessage({ type: "success", text: "Đã lưu cấu hình tự động hóa." });
    } catch {
      setMessage({ type: "error", text: "Không thể kết nối máy chủ." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-4">
      <UnsavedChangesGuard active={dirty} />
      <AutomationSettingsFields
        value={value}
        hasWebhookVerifyToken={hasWebhookVerifyToken}
        disabled={saving}
        onChange={(next) => {
          setValue(next);
          setMessage(null);
        }}
      />
      {message ? (
        <p role="status" className={`text-sm ${message.type === "success" ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>
          {message.text}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={save} loading={saving} disabled={!dirty}>
          Lưu cấu hình tự động hóa
        </Button>
        {dirty ? <span className="text-xs font-semibold text-[var(--warning)]">Có thay đổi chưa lưu</span> : null}
      </div>
    </div>
  );
}
