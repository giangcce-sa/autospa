"use client";

import { useMemo, useState } from "react";
import { Key, Robot } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { UnsavedChangesGuard } from "@/components/workspace/UnsavedChangesGuard";
import type { ProviderSettingsDto } from "@/lib/settings/providers-policy";

type FormValue = ProviderSettingsDto & { claudeApiKey: string; openaiApiKey: string };
type TestState = { status: "idle" | "loading" | "success" | "error"; message: string };
const idleTest = (): TestState => ({ status: "idle", message: "" });

function formValue(settings: ProviderSettingsDto): FormValue {
  return { ...settings, claudeApiKey: "", openaiApiKey: "" };
}

export function ProviderSettingsForm({ initialSettings }: { initialSettings: ProviderSettingsDto }) {
  const [baseline, setBaseline] = useState(() => formValue(initialSettings));
  const [value, setValue] = useState(() => formValue(initialSettings));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [tests, setTests] = useState({ claude: idleTest(), openai: idleTest() });
  const dirty = useMemo(() => JSON.stringify(value) !== JSON.stringify(baseline), [baseline, value]);

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/settings/providers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          claudeBaseUrl: value.claudeBaseUrl,
          openaiBaseUrl: value.openaiBaseUrl,
          openaiChatModel: value.openaiChatModel,
          ...(value.claudeApiKey ? { claudeApiKey: value.claudeApiKey } : {}),
          ...(value.openaiApiKey ? { openaiApiKey: value.openaiApiKey } : {}),
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        setMessage({ type: "error", text: result.error ?? "Không thể lưu cấu hình provider" });
        return;
      }
      const next = formValue(result.data);
      setValue(next);
      setBaseline(next);
      setMessage({ type: "success", text: "Đã lưu cấu hình provider." });
      setTests({ claude: idleTest(), openai: idleTest() });
    } catch {
      setMessage({ type: "error", text: "Không thể kết nối máy chủ." });
    } finally {
      setSaving(false);
    }
  };

  const test = async (provider: "claude" | "openai") => {
    setTests((current) => ({ ...current, [provider]: { status: "loading", message: "Đang kiểm tra..." } }));
    try {
      const response = await fetch("/api/settings/providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(provider === "claude" ? {
          provider,
          baseUrl: value.claudeBaseUrl,
          ...(value.claudeApiKey ? { apiKey: value.claudeApiKey } : {}),
        } : {
          provider,
          baseUrl: value.openaiBaseUrl,
          chatModel: value.openaiChatModel,
          ...(value.openaiApiKey ? { apiKey: value.openaiApiKey } : {}),
        }),
      });
      const result = await response.json();
      setTests((current) => ({
        ...current,
        [provider]: { status: response.ok && result.success ? "success" : "error", message: result.message ?? result.error ?? "Kiểm tra thất bại" },
      }));
    } catch {
      setTests((current) => ({ ...current, [provider]: { status: "error", message: "Không thể kết nối máy chủ" } }));
    }
  };

  return (
    <div className="max-w-3xl space-y-4">
      <UnsavedChangesGuard active={dirty} />
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2"><Robot size={17} className="text-[var(--accent)]" aria-hidden="true" /><CardTitle>Claude</CardTitle></div>
          <Badge variant={value.hasClaudeApiKey ? "success" : "neutral"}>{value.hasClaudeApiKey ? "Đã cấu hình" : "Chưa cấu hình"}</Badge>
        </CardHeader>
        <div className="space-y-4">
          <Input label="API key" type="password" value={value.claudeApiKey} onChange={(event) => setValue((current) => ({ ...current, claudeApiKey: event.target.value }))} placeholder={value.hasClaudeApiKey ? "Để trống = giữ khóa hiện tại" : "Nhập khóa truy cập"} />
          <Input label="Base URL" type="url" value={value.claudeBaseUrl} onChange={(event) => setValue((current) => ({ ...current, claudeBaseUrl: event.target.value }))} hint="Gateway tùy chỉnh phải dùng HTTPS và nằm trong AI_PROVIDER_ALLOWED_HOSTS." />
          <Button variant="secondary" onClick={() => test("claude")} loading={tests.claude.status === "loading"}>Kiểm tra Claude</Button>
          {tests.claude.status !== "idle" ? <p role="status" className={`text-sm ${tests.claude.status === "success" ? "text-[var(--success)]" : tests.claude.status === "error" ? "text-[var(--danger)]" : "text-[var(--text-muted)]"}`}>{tests.claude.message}</p> : null}
        </div>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2"><Key size={17} className="text-[var(--accent)]" aria-hidden="true" /><CardTitle>OpenAI & AI Gateway</CardTitle></div>
          <Badge variant={value.hasOpenaiApiKey ? "success" : "neutral"}>{value.hasOpenaiApiKey ? "Đã cấu hình" : "Chưa cấu hình"}</Badge>
        </CardHeader>
        <div className="space-y-4">
          <Input label="API key" type="password" value={value.openaiApiKey} onChange={(event) => setValue((current) => ({ ...current, openaiApiKey: event.target.value }))} placeholder={value.hasOpenaiApiKey ? "Để trống = giữ khóa hiện tại" : "Nhập khóa truy cập"} />
          <Input label="Base URL" type="url" value={value.openaiBaseUrl} onChange={(event) => setValue((current) => ({ ...current, openaiBaseUrl: event.target.value }))} hint="Dùng base URL hoặc endpoint chat/completions đã được allowlist." />
          <Input label="Model chat" value={value.openaiChatModel} onChange={(event) => setValue((current) => ({ ...current, openaiChatModel: event.target.value }))} />
          <Button variant="secondary" onClick={() => test("openai")} loading={tests.openai.status === "loading"}>Kiểm tra OpenAI</Button>
          {tests.openai.status !== "idle" ? <p role="status" className={`text-sm ${tests.openai.status === "success" ? "text-[var(--success)]" : tests.openai.status === "error" ? "text-[var(--danger)]" : "text-[var(--text-muted)]"}`}>{tests.openai.message}</p> : null}
        </div>
      </Card>

      {message ? <p role={message.type === "error" ? "alert" : "status"} className={`text-sm ${message.type === "success" ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>{message.text}</p> : null}
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={save} loading={saving} disabled={!dirty}>Lưu cấu hình provider</Button>
        {dirty ? <span className="text-xs font-semibold text-[var(--warning)]">Có thay đổi chưa lưu</span> : null}
      </div>
    </div>
  );
}
