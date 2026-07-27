"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import {
  Key, Robot, CheckCircle, Lightning, Spinner,
  Archive, FloppyDisk, DownloadSimple,
  ShareNetwork, Cpu, Database,
} from "@phosphor-icons/react";
import { TelegramSettings } from "./TelegramSettings";
import { InstagramSettings } from "./InstagramSettings";
import { TikTokSettings } from "./TikTokSettings";
import { GoogleBusinessSettings } from "./GoogleBusinessSettings";
import { FacebookPageSettings } from "./FacebookPageSettings";
import { ZaloSettingsForm } from "./ZaloSettingsForm";
import { AutomationSettingsFields, type AutomationSettingsFormValue } from "./AutomationSettingsFields";
import { AdsOptimizationFields } from "./AdsOptimizationFields";

interface FormState {
  claudeApiKey: string;
  openaiApiKey: string;
  zaloToken: string;
  spaApiKey: string;
  claudeBaseUrl: string;
  openaiBaseUrl: string;
  imageModel: string;
  openaiChatModel: string;
  zaloOaId: string;
  draftRetentionDays: string;
  publishedRetentionDays: string;
  webhookVerifyToken: string;
  webhookMode: string;
  autoReplyComments: boolean;
  autoReplyMessages: boolean;
  spaApiUrl: string;
  spaWebhookSecret: string;
  leadHandoffMode: string;
  leadHandoffLink: string;
  automationLevel: string;
  zaloApprovalRecipient: string;
  adsOptimizePauseCtr: string;
  adsOptimizeScaleCtr: string;
  adsOptimizeFreqLimit: string;
  adsOptimizeScalePct: string;
  adsOptimizeMinSpend: string;
  adsOptimizeMaxBudget: string;
  adsOptimizeCooldownHrs: string;
  adsOptimizeMinRoas: string;
}

interface SavedFlags {
  claudeApiKey: boolean;
  openaiApiKey: boolean;
  zaloToken: boolean;
  spaApiKey: boolean;
  spaWebhookSecret: boolean;
  webhookVerifyToken: boolean;
}

type TestStatus = { status: "idle" | "loading" | "ok" | "fail"; message: string };
const initTest = (): TestStatus => ({ status: "idle", message: "" });

const TABS = [
  { id: "api", label: "API & Kết nối", icon: Key },
  { id: "social", label: "Mạng xã hội", icon: ShareNetwork },
  { id: "automation", label: "Tự động hóa", icon: Cpu },
  { id: "library", label: "Thư viện & Backup", icon: Database },
] as const;

type TabId = (typeof TABS)[number]["id"];
const TAB_STORAGE = "settings-tab";

function SavedBadge({ has }: { has: boolean }) {
  if (!has) return null;
  return <Badge variant="success">Đã cấu hình</Badge>;
}

function TestResult({ test }: { test: TestStatus }) {
  if (test.status === "idle") return null;
  if (test.status === "loading")
    return (
      <div className="flex items-center gap-1.5 text-xs mt-2" style={{ color: "var(--text-muted)" }}>
        <Spinner size={12} className="animate-spin" /> Đang kiểm tra...
      </div>
    );
  return (
    <div
      className="flex items-center gap-1.5 text-xs mt-2"
      style={{ color: test.status === "ok" ? "var(--accent)" : "var(--rose)" }}
    >
      {test.status === "ok" && <CheckCircle size={12} weight="fill" />}
      <span>{test.message}</span>
    </div>
  );
}

export function SettingsForm() {
  const [tab, setTab] = useState<TabId>("api");
  const [form, setForm] = useState<FormState>({
    claudeApiKey: "", openaiApiKey: "", zaloToken: "", spaApiKey: "",
    claudeBaseUrl: "https://api.anthropic.com",
    openaiBaseUrl: "https://api.openai.com/v1",
    imageModel: "dall-e-3",
    openaiChatModel: "gpt-5",
    zaloOaId: "",
    draftRetentionDays: "30",
    publishedRetentionDays: "90",
    webhookVerifyToken: "",
    webhookMode: "manual",
    autoReplyComments: false,
    autoReplyMessages: false,
    spaApiUrl: "",
    spaWebhookSecret: "",
    leadHandoffMode: "staff",
    leadHandoffLink: "",
    automationLevel: "supervised",
    zaloApprovalRecipient: "",
    adsOptimizePauseCtr: "0.5",
    adsOptimizeScaleCtr: "2.0",
    adsOptimizeFreqLimit: "3.0",
    adsOptimizeScalePct: "20",
    adsOptimizeMinSpend: "100000",
    adsOptimizeMaxBudget: "2000000",
    adsOptimizeCooldownHrs: "24",
    adsOptimizeMinRoas: "1.5",
  });
  const [saved, setSaved] = useState<SavedFlags>({
    claudeApiKey: false,
    openaiApiKey: false,
    zaloToken: false,
    spaApiKey: false,
    spaWebhookSecret: false,
    webhookVerifyToken: false,
  });
  const [loading, setLoading] = useState(false);
  const [saveOk, setSaveOk] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [tests, setTests] = useState<Record<string, TestStatus>>({
    claude: initTest(), openai: initTest(), zalo: initTest(), spa: initTest(),
  });

  useEffect(() => {
    try {
      const saved = localStorage.getItem(TAB_STORAGE) as TabId | null;
      if (saved && TABS.some((t) => t.id === saved)) setTab(saved);
    } catch { /* ignore */ }

    fetch("/api/settings").then((r) => r.json()).then((res) => {
      if (!res.data) return;
      const d = res.data;
      setSaved({
        claudeApiKey: !!d.claudeApiKey,
        openaiApiKey: !!d.openaiApiKey,
        zaloToken: !!d.zaloToken,
        spaApiKey: !!d.hasSpaApiKey,
        spaWebhookSecret: !!d.hasSpaWebhookSecret,
        webhookVerifyToken: !!d.hasWebhookVerifyToken,
      });
      setForm((prev) => ({
        ...prev,
        claudeBaseUrl: d.claudeBaseUrl ?? "https://api.anthropic.com",
        openaiBaseUrl: d.openaiBaseUrl ?? "https://api.openai.com/v1",
        imageModel: d.imageModel ?? "dall-e-3",
        openaiChatModel: d.openaiChatModel ?? "gpt-5",
        zaloOaId: d.zaloOaId ?? "",
        draftRetentionDays: String(d.draftRetentionDays ?? 30),
        publishedRetentionDays: String(d.publishedRetentionDays ?? 90),
        webhookVerifyToken: "",
        webhookMode: d.webhookMode ?? "manual",
        autoReplyComments: d.autoReplyComments ?? false,
        autoReplyMessages: d.autoReplyMessages ?? false,
        spaApiUrl: d.spaApiUrl ?? "",
        spaWebhookSecret: "",
        leadHandoffMode: d.leadHandoffMode ?? "staff",
        leadHandoffLink: d.leadHandoffLink ?? "",
        automationLevel: d.automationLevel ?? "supervised",
        zaloApprovalRecipient: d.zaloApprovalRecipient ?? "",
        adsOptimizePauseCtr: String(d.adsOptimizePauseCtr ?? 0.5),
        adsOptimizeScaleCtr: String(d.adsOptimizeScaleCtr ?? 2.0),
        adsOptimizeFreqLimit: String(d.adsOptimizeFreqLimit ?? 3.0),
        adsOptimizeScalePct: String(d.adsOptimizeScalePct ?? 20),
        adsOptimizeMinSpend: String(d.adsOptimizeMinSpend ?? 100000),
        adsOptimizeMaxBudget: String(d.adsOptimizeMaxBudget ?? 2000000),
        adsOptimizeCooldownHrs: String(d.adsOptimizeCooldownHrs ?? 24),
        adsOptimizeMinRoas: String(d.adsOptimizeMinRoas ?? 1.5),
      }));
    });
  }, []);

  const switchTab = (id: TabId) => {
    setTab(id);
    try { localStorage.setItem(TAB_STORAGE, id); } catch { /* ignore */ }
  };

  const handleSave = async () => {
    setLoading(true);
    setSaveError(null);
    try {
      const body: Record<string, string | number | boolean> = {};
      if (tab === "api") {
        Object.assign(body, {
          claudeBaseUrl: form.claudeBaseUrl,
          openaiBaseUrl: form.openaiBaseUrl,
          imageModel: form.imageModel,
          openaiChatModel: form.openaiChatModel,
          spaApiUrl: form.spaApiUrl,
        });
        if (form.claudeApiKey.trim()) body.claudeApiKey = form.claudeApiKey.trim();
        if (form.openaiApiKey.trim()) body.openaiApiKey = form.openaiApiKey.trim();
        if (form.spaApiKey.trim()) body.spaApiKey = form.spaApiKey.trim();
        if (form.spaWebhookSecret.trim()) body.spaWebhookSecret = form.spaWebhookSecret.trim();
      }
      if (tab === "automation") {
        Object.assign(body, {
          webhookMode: form.webhookMode,
          autoReplyComments: form.autoReplyComments,
          autoReplyMessages: form.autoReplyMessages,
          leadHandoffMode: form.leadHandoffMode,
          leadHandoffLink: form.leadHandoffLink,
          automationLevel: form.automationLevel,
          zaloApprovalRecipient: form.zaloApprovalRecipient,
          adsOptimizePauseCtr: Number(form.adsOptimizePauseCtr) || 0.5,
          adsOptimizeScaleCtr: Number(form.adsOptimizeScaleCtr) || 2.0,
          adsOptimizeFreqLimit: Number(form.adsOptimizeFreqLimit) || 3.0,
          adsOptimizeScalePct: Number(form.adsOptimizeScalePct) || 20,
          adsOptimizeMinSpend: Number(form.adsOptimizeMinSpend) || 100000,
          adsOptimizeMaxBudget: Number(form.adsOptimizeMaxBudget) || 2000000,
          adsOptimizeCooldownHrs: Number(form.adsOptimizeCooldownHrs) || 24,
          adsOptimizeMinRoas: Number(form.adsOptimizeMinRoas) || 1.5,
        });
        if (form.webhookVerifyToken.trim()) body.webhookVerifyToken = form.webhookVerifyToken.trim();
      }
      if (tab === "library") {
        Object.assign(body, {
          draftRetentionDays: Number(form.draftRetentionDays) || 0,
          publishedRetentionDays: Number(form.publishedRetentionDays) || 0,
        });
      }

      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await res.json().catch(() => null) as { success?: boolean; error?: string } | null;
      if (!res.ok || !result?.success) {
        setSaveError(result?.error ?? "Không thể lưu cài đặt");
        return;
      }

      setSaved((prev) => ({
        claudeApiKey: prev.claudeApiKey || (tab === "api" && !!form.claudeApiKey.trim()),
        openaiApiKey: prev.openaiApiKey || (tab === "api" && !!form.openaiApiKey.trim()),
        zaloToken: prev.zaloToken,
        spaApiKey: prev.spaApiKey || (tab === "api" && !!form.spaApiKey.trim()),
        spaWebhookSecret: prev.spaWebhookSecret || (tab === "api" && !!form.spaWebhookSecret.trim()),
        webhookVerifyToken: prev.webhookVerifyToken || (tab === "automation" && !!form.webhookVerifyToken.trim()),
      }));
      setForm((prev) => ({
        ...prev,
        ...(tab === "api" ? {
          claudeApiKey: "",
          openaiApiKey: "",
          spaApiKey: "",
          spaWebhookSecret: "",
        } : {}),
        ...(tab === "automation" ? { webhookVerifyToken: "" } : {}),
      }));
      setTests({ claude: initTest(), openai: initTest(), zalo: initTest(), spa: initTest() });
      setSaveOk(true);
      setTimeout(() => setSaveOk(false), 3000);
    } catch {
      setSaveError("Không thể kết nối máy chủ");
    } finally { setLoading(false); }
  };

  const testConnection = async (service: string) => {
    setTests((prev) => ({ ...prev, [service]: { status: "loading", message: "" } }));
    const payload: Record<string, string> = { action: "test", service };
    if (service === "spa") { payload.spaApiUrl = form.spaApiUrl; payload.apiKey = form.spaApiKey; }
    if (service === "claude") { payload.apiKey = form.claudeApiKey; payload.baseUrl = form.claudeBaseUrl; }
    if (service === "openai") { payload.apiKey = form.openaiApiKey; payload.openaiBaseUrl = form.openaiBaseUrl; }
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await res.json();
      setTests((prev) => ({ ...prev, [service]: { status: result.success ? "ok" : "fail", message: result.message } }));
    } catch {
      setTests((prev) => ({ ...prev, [service]: { status: "fail", message: "Lỗi kết nối" } }));
    }
  };

  const f = form;
  const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  return (
    <div className="max-w-2xl space-y-4">
      {/* Tab bar */}
      <div
        className="flex gap-1 p-1 rounded-xl"
        style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)" }}
      >
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => switchTab(t.id)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-medium transition-all"
              style={
                active
                  ? { background: "var(--bg-card)", color: "var(--accent)", boxShadow: "var(--shadow-sm)" }
                  : { color: "var(--text-muted)" }
              }
            >
              <Icon size={13} weight={active ? "fill" : "regular"} />
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* ── Tab: API & Kết nối ── */}
      {tab === "api" && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Robot size={16} style={{ color: "var(--accent)" }} />
                <CardTitle>Claude API</CardTitle>
                <SavedBadge has={saved.claudeApiKey} />
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="info">AI sinh nội dung</Badge>
                <Button size="sm" variant="secondary" loading={tests.claude.status === "loading"} onClick={() => testConnection("claude")}>
                  Test kết nối
                </Button>
              </div>
            </CardHeader>
            <div className="space-y-3">
              <Input
                label="API Key"
                type="password"
                placeholder={saved.claudeApiKey ? "Để trống = giữ nguyên key cũ" : "sk-ant-..."}
                value={f.claudeApiKey}
                onChange={set("claudeApiKey")}
                hint="Lấy tại console.anthropic.com hoặc provider (Kiro, shopaikey...)"
              />
              <Input
                label="Base URL"
                placeholder="https://api.anthropic.com"
                value={f.claudeBaseUrl}
                onChange={set("claudeBaseUrl")}
                hint="Thay đổi nếu dùng provider khác thay vì Anthropic trực tiếp"
              />
            </div>
            <TestResult test={tests.claude} />
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Key size={16} style={{ color: "var(--accent)" }} />
                <CardTitle>OpenAI API</CardTitle>
                <SavedBadge has={saved.openaiApiKey} />
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="info">Tạo ảnh + AI Council</Badge>
                <Button size="sm" variant="secondary" loading={tests.openai.status === "loading"} onClick={() => testConnection("openai")}>
                  Test kết nối
                </Button>
              </div>
            </CardHeader>
            <div className="space-y-3">
              <Input
                label="API Key"
                type="password"
                placeholder={saved.openaiApiKey ? "Để trống = giữ nguyên key cũ" : "sk-..."}
                value={f.openaiApiKey}
                onChange={set("openaiApiKey")}
                hint="Lấy tại platform.openai.com hoặc provider (shopaikey...)"
              />
              <Input
                label="Base URL"
                placeholder="https://api.openai.com/v1"
                value={f.openaiBaseUrl}
                onChange={set("openaiBaseUrl")}
                hint="9router: nhập full endpoint http://localhost:20128/v1/images/generations hoặc base http://localhost:20128/v1"
              />
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Model tạo ảnh"
                  placeholder="dall-e-3"
                  value={f.imageModel}
                  onChange={set("imageModel")}
                  hint="dall-e-3 · dall-e-2 · cx/gpt-5.5-image"
                />
                <Input
                  label="Model chat (AI Council)"
                  placeholder="gpt-5"
                  value={f.openaiChatModel}
                  onChange={set("openaiChatModel")}
                  hint="gpt-5 · gpt-4o · gpt-4-turbo"
                />
              </div>
            </div>
            <TestResult test={tests.openai} />
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Lightning size={16} style={{ color: "var(--accent)" }} />
                <CardTitle>Kết nối Phần mềm Spa</CardTitle>
                <SavedBadge has={saved.spaApiKey} />
              </div>
              <Button size="sm" variant="secondary" loading={tests.spa.status === "loading"} onClick={() => testConnection("spa")}>
                Test kết nối
              </Button>
            </CardHeader>
            <div className="space-y-3">
              <Input label="Spa API URL" placeholder="https://api.yourspa.com" value={form.spaApiUrl} onChange={set("spaApiUrl")} hint="Base URL của phần mềm spa. Cần endpoint: GET /revenue/today, POST /leads" />
              <Input label="Spa API Key" type="password" placeholder={saved.spaApiKey ? "Để trống = giữ nguyên key cũ" : "Bearer token..."} value={form.spaApiKey} onChange={set("spaApiKey")} />
              <Input label="Webhook Secret" type="password" placeholder={saved.spaWebhookSecret ? "Để trống = giữ nguyên secret cũ" : "Secret để verify webhook từ spa gửi về"} value={form.spaWebhookSecret} onChange={set("spaWebhookSecret")} hint="Spa software sẽ gửi webhook đến /api/spa khi có booking/payment mới" />
            </div>
            <TestResult test={tests.spa} />
          </Card>
        </div>
      )}

      {/* ── Tab: Mạng xã hội ── */}
      {tab === "social" && (
        <div className="space-y-4">
          <FacebookPageSettings />
          <InstagramSettings />
          <ZaloSettingsForm key={`${form.zaloOaId}:${saved.zaloToken}`} initialSettings={{ zaloOaId: form.zaloOaId, hasZaloToken: saved.zaloToken }} />
          <TikTokSettings />
          <GoogleBusinessSettings />
          <TelegramSettings />
        </div>
      )}

      {/* ── Tab: Tự động hóa ── */}
      {tab === "automation" && (
        <div className="space-y-4">
          <AutomationSettingsFields
            value={{
              webhookMode: form.webhookMode as AutomationSettingsFormValue["webhookMode"],
              autoReplyComments: form.autoReplyComments,
              autoReplyMessages: form.autoReplyMessages,
              webhookVerifyToken: form.webhookVerifyToken,
              leadHandoffMode: form.leadHandoffMode as AutomationSettingsFormValue["leadHandoffMode"],
              leadHandoffLink: form.leadHandoffLink,
              automationLevel: form.automationLevel as AutomationSettingsFormValue["automationLevel"],
              zaloApprovalRecipient: form.zaloApprovalRecipient,
            }}
            hasWebhookVerifyToken={saved.webhookVerifyToken}
            onChange={(value) => setForm((current) => ({ ...current, ...value }))}
          />

          <AdsOptimizationFields
            value={{
              adsOptimizePauseCtr: Number(form.adsOptimizePauseCtr),
              adsOptimizeScaleCtr: Number(form.adsOptimizeScaleCtr),
              adsOptimizeFreqLimit: Number(form.adsOptimizeFreqLimit),
              adsOptimizeScalePct: Number(form.adsOptimizeScalePct),
              adsOptimizeMinSpend: Number(form.adsOptimizeMinSpend),
              adsOptimizeMaxBudget: Number(form.adsOptimizeMaxBudget),
              adsOptimizeCooldownHrs: Number(form.adsOptimizeCooldownHrs),
              adsOptimizeMinRoas: Number(form.adsOptimizeMinRoas),
            }}
            onChange={(value) => setForm((current) => ({
              ...current,
              adsOptimizePauseCtr: String(value.adsOptimizePauseCtr),
              adsOptimizeScaleCtr: String(value.adsOptimizeScaleCtr),
              adsOptimizeFreqLimit: String(value.adsOptimizeFreqLimit),
              adsOptimizeScalePct: String(value.adsOptimizeScalePct),
              adsOptimizeMinSpend: String(value.adsOptimizeMinSpend),
              adsOptimizeMaxBudget: String(value.adsOptimizeMaxBudget),
              adsOptimizeCooldownHrs: String(value.adsOptimizeCooldownHrs),
              adsOptimizeMinRoas: String(value.adsOptimizeMinRoas),
            }))}
          />
        </div>
      )}

      {/* ── Tab: Thư viện & Backup ── */}
      {tab === "library" && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Archive size={16} style={{ color: "var(--accent)" }} />
                <CardTitle>Thư viện bài viết</CardTitle>
              </div>
              <Badge variant="neutral">Tự dọn dẹp</Badge>
            </CardHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Giữ bài nháp (ngày)</label>
                  <input type="number" min="0" className="w-full px-3 py-2 text-sm rounded-lg border outline-none" style={{ background: "var(--bg-card)", borderColor: "var(--border)", color: "var(--text)" }} value={f.draftRetentionDays} onChange={set("draftRetentionDays")} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Giữ bài đã đăng (ngày)</label>
                  <input type="number" min="0" className="w-full px-3 py-2 text-sm rounded-lg border outline-none" style={{ background: "var(--bg-card)", borderColor: "var(--border)", color: "var(--text)" }} value={f.publishedRetentionDays} onChange={set("publishedRetentionDays")} />
                </div>
              </div>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                Bài nháp/đã đăng cũ hơn số ngày trên sẽ tự xóa mỗi khi mở Thư viện. Nhập <strong>0</strong> để giữ mãi mãi.
              </p>
            </div>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <FloppyDisk size={16} style={{ color: "var(--accent)" }} weight="fill" />
                <CardTitle>Backup dữ liệu</CardTitle>
              </div>
            </CardHeader>
            <div className="space-y-3 text-xs">
              <p style={{ color: "var(--text-secondary)" }}>
                Tự động: Neon Postgres có Point-in-Time Recovery 7 ngày. Mỗi Chủ nhật 3h sáng, Zalo nhắc tải backup tuần này.
              </p>
              <p style={{ color: "var(--text-secondary)" }}>
                Manual download: tải file JSON gzipped chứa toàn bộ data — settings, posts, customers, leads, memory, mọi thứ.
              </p>
              <a
                href="/api/backup"
                download
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-opacity hover:opacity-80"
                style={{ background: "linear-gradient(135deg, var(--accent) 0%, var(--accent-hover) 100%)", color: "white", boxShadow: "0 1px 6px color-mix(in srgb, var(--accent) 24%, transparent)" }}
              >
                <DownloadSimple size={13} weight="bold" /> Download backup ngay
              </a>
              <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                Tip: Giữ ít nhất 4 backup gần nhất (1 tháng). Upload lên Google Drive / iCloud / external drive là an toàn nhất.
              </p>
            </div>
          </Card>
        </div>
      )}

      {tab !== "social" ? (
        <>
          {saveError ? <p role="alert" className="text-sm text-[var(--danger)]">{saveError}</p> : null}
          <Button onClick={handleSave} loading={loading} size="lg" className="w-full">
            {saveOk ? <><CheckCircle size={14} weight="fill" /> Đã lưu!</> : "Lưu cài đặt"}
          </Button>
        </>
      ) : null}
    </div>
  );
}
