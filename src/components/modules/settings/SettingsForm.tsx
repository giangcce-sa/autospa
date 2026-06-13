"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Key, Robot, FacebookLogo, CheckCircle, Lightning, Spinner, Archive, Globe, Copy, Plus, Trash } from "@phosphor-icons/react";

// Non-secret fields pre-filled normally.
// Secret fields (keys/tokens) are NEVER pre-filled — empty = keep existing value in DB.
interface FormState {
  // secrets — always start empty
  claudeApiKey: string;
  openaiApiKey: string;
  zaloToken: string;
  // non-secrets — pre-filled from DB
  claudeBaseUrl: string;
  openaiBaseUrl: string;
  imageModel: string;
  zaloOaId: string;
  draftRetentionDays: string;
  publishedRetentionDays: string;
  webhookVerifyToken: string;
  autoReplyComments: boolean;
  autoReplyMessages: boolean;
}

// Which secrets already have a saved value in DB
interface SavedFlags {
  claudeApiKey: boolean;
  openaiApiKey: boolean;
  zaloToken: boolean;
}

interface FbPage {
  id: string;
  fbPageId: string;
  pageName: string;
  isActive: boolean;
  accessTokenHint: string;
}

type TestStatus = { status: "idle" | "loading" | "ok" | "fail"; message: string };
const initTest = (): TestStatus => ({ status: "idle", message: "" });

function SavedBadge({ has }: { has: boolean }) {
  if (!has) return null;
  return <Badge variant="success">Đã cấu hình</Badge>;
}

function TestResult({ test }: { test: TestStatus }) {
  if (test.status === "idle") return null;
  if (test.status === "loading") return (
    <div className="flex items-center gap-1.5 text-xs mt-2" style={{ color: "var(--text-muted)" }}>
      <Spinner size={12} className="animate-spin" /> Đang kiểm tra...
    </div>
  );
  return (
    <div className="flex items-center gap-1.5 text-xs mt-2" style={{ color: test.status === "ok" ? "var(--accent)" : "var(--rose)" }}>
      {test.status === "ok" && <CheckCircle size={12} weight="fill" />}
      <span>{test.message}</span>
    </div>
  );
}

export function SettingsForm() {
  const [form, setForm] = useState<FormState>({
    claudeApiKey: "", openaiApiKey: "", zaloToken: "",
    claudeBaseUrl: "https://api.anthropic.com",
    openaiBaseUrl: "https://api.openai.com/v1",
    imageModel: "dall-e-3",
    zaloOaId: "",
    draftRetentionDays: "30",
    publishedRetentionDays: "90",
    webhookVerifyToken: "",
    autoReplyComments: false,
    autoReplyMessages: false,
  });
  const [saved, setSaved] = useState<SavedFlags>({
    claudeApiKey: false, openaiApiKey: false, zaloToken: false,
  });
  const [loading, setLoading] = useState(false);
  const [saveOk, setSaveOk] = useState(false);
  const [tests, setTests] = useState<Record<string, TestStatus>>({
    claude: initTest(), openai: initTest(), zalo: initTest(),
  });

  // Facebook pages state
  const [fbPages, setFbPages] = useState<FbPage[]>([]);
  const [newPage, setNewPage] = useState({ fbPageId: "", pageName: "", accessToken: "" });
  const [fbTest, setFbTest] = useState<TestStatus>(initTest());
  const [addingPage, setAddingPage] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  const loadFbPages = () =>
    fetch("/api/facebook-pages").then((r) => r.json()).then((res) => {
      if (res.data) setFbPages(res.data);
    });

  useEffect(() => {
    fetch("/api/settings").then((r) => r.json()).then((res) => {
      if (!res.data) return;
      const d = res.data;
      setSaved({
        claudeApiKey: !!d.claudeApiKey,
        openaiApiKey: !!d.openaiApiKey,
        zaloToken: !!d.zaloToken,
      });
      setForm((prev) => ({
        ...prev,
        claudeBaseUrl: d.claudeBaseUrl ?? "https://api.anthropic.com",
        openaiBaseUrl: d.openaiBaseUrl ?? "https://api.openai.com/v1",
        imageModel: d.imageModel ?? "dall-e-3",
        zaloOaId: d.zaloOaId ?? "",
        draftRetentionDays: String(d.draftRetentionDays ?? 30),
        publishedRetentionDays: String(d.publishedRetentionDays ?? 90),
        webhookVerifyToken: d.webhookVerifyToken ?? "",
        autoReplyComments: d.autoReplyComments ?? false,
        autoReplyMessages: d.autoReplyMessages ?? false,
      }));
    });
    loadFbPages();
  }, []);

  const testFbPage = async () => {
    setFbTest({ status: "loading", message: "" });
    try {
      const res = await fetch("/api/facebook-pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "test", fbPageId: newPage.fbPageId, accessToken: newPage.accessToken }),
      });
      const data = await res.json();
      setFbTest({ status: data.success ? "ok" : "fail", message: data.message });
      if (data.success && data.pageName && !newPage.pageName) {
        setNewPage((p) => ({ ...p, pageName: data.pageName }));
      }
    } catch {
      setFbTest({ status: "fail", message: "Lỗi kết nối" });
    }
  };

  const addFbPage = async () => {
    if (!newPage.fbPageId.trim() || !newPage.pageName.trim() || !newPage.accessToken.trim()) return;
    setAddingPage(true);
    try {
      await fetch("/api/facebook-pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add", ...newPage }),
      });
      setNewPage({ fbPageId: "", pageName: "", accessToken: "" });
      setFbTest(initTest());
      setShowAddForm(false);
      loadFbPages();
    } finally {
      setAddingPage(false);
    }
  };

  const toggleFbPage = async (id: string) => {
    await fetch("/api/facebook-pages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "toggle", id }),
    });
    loadFbPages();
  };

  const deleteFbPage = async (id: string) => {
    await fetch(`/api/facebook-pages?id=${id}`, { method: "DELETE" });
    loadFbPages();
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const body: Record<string, string | number | boolean> = {
        claudeBaseUrl: form.claudeBaseUrl,
        openaiBaseUrl: form.openaiBaseUrl,
        imageModel: form.imageModel,
        zaloOaId: form.zaloOaId,
        draftRetentionDays: Number(form.draftRetentionDays) || 0,
        publishedRetentionDays: Number(form.publishedRetentionDays) || 0,
        webhookVerifyToken: form.webhookVerifyToken,
        autoReplyComments: form.autoReplyComments,
        autoReplyMessages: form.autoReplyMessages,
      };
      if (form.claudeApiKey.trim()) body.claudeApiKey = form.claudeApiKey.trim();
      if (form.openaiApiKey.trim()) body.openaiApiKey = form.openaiApiKey.trim();
      if (form.zaloToken.trim()) body.zaloToken = form.zaloToken.trim();

      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setSaved((prev) => ({
          claudeApiKey: prev.claudeApiKey || !!form.claudeApiKey.trim(),
          openaiApiKey: prev.openaiApiKey || !!form.openaiApiKey.trim(),
          zaloToken: prev.zaloToken || !!form.zaloToken.trim(),
        }));
        setForm((prev) => ({ ...prev, claudeApiKey: "", openaiApiKey: "", zaloToken: "" }));
        setTests({ claude: initTest(), openai: initTest(), zalo: initTest() });
        setSaveOk(true);
        setTimeout(() => setSaveOk(false), 3000);
      }
    } finally {
      setLoading(false);
    }
  };

  const testConnection = async (service: string) => {
    setTests((prev) => ({ ...prev, [service]: { status: "loading", message: "" } }));
    const payload: Record<string, string> = { action: "test", service };
    if (service === "claude") { payload.apiKey = form.claudeApiKey; payload.baseUrl = form.claudeBaseUrl; }
    if (service === "openai") { payload.apiKey = form.openaiApiKey; payload.openaiBaseUrl = form.openaiBaseUrl; }
    if (service === "zalo") { payload.apiKey = form.zaloToken; }
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await res.json();
      setTests((prev) => ({
        ...prev,
        [service]: { status: result.success ? "ok" : "fail", message: result.message },
      }));
    } catch {
      setTests((prev) => ({ ...prev, [service]: { status: "fail", message: "Lỗi kết nối" } }));
    }
  };

  const f = form;
  const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  return (
    <div className="space-y-4 max-w-2xl">
      {/* Claude */}
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

      {/* OpenAI */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Key size={16} style={{ color: "var(--accent)" }} />
            <CardTitle>OpenAI API</CardTitle>
            <SavedBadge has={saved.openaiApiKey} />
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="info">AI tạo hình ảnh</Badge>
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
            hint="Giữ mặc định nếu dùng OpenAI trực tiếp"
          />
          <Input
            label="Model tạo ảnh"
            placeholder="dall-e-3"
            value={f.imageModel}
            onChange={set("imageModel")}
            hint="VD: dall-e-3 · dall-e-2 · cx/gpt-5.5-image · cx/gpt-5.4-image"
          />
        </div>
        <TestResult test={tests.openai} />
      </Card>

      {/* Facebook Pages (multi-page) */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <FacebookLogo size={16} style={{ color: "#1877F2" }} />
            <CardTitle>Facebook Pages</CardTitle>
            <Badge variant="neutral">{fbPages.length} page</Badge>
          </div>
          <Button size="sm" variant="secondary" onClick={() => { setShowAddForm((p) => !p); setFbTest(initTest()); }}>
            <Plus size={12} /> Thêm page
          </Button>
        </CardHeader>

        {/* Existing pages list */}
        {fbPages.length > 0 && (
          <div className="space-y-2 mb-3">
            {fbPages.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg" style={{ background: "var(--bg-subtle)" }}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate" style={{ color: "var(--text)" }}>{p.pageName}</p>
                    <Badge variant={p.isActive ? "success" : "neutral"}>{p.isActive ? "Bật" : "Tắt"}</Badge>
                  </div>
                  <p className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>ID: {p.fbPageId} · Token: {p.accessTokenHint}</p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="sm" variant="secondary" onClick={() => toggleFbPage(p.id)}>{p.isActive ? "Tắt" : "Bật"}</Button>
                  <Button size="sm" variant="danger" onClick={() => deleteFbPage(p.id)}><Trash size={11} /></Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {fbPages.length === 0 && !showAddForm && (
          <p className="text-xs text-center py-3" style={{ color: "var(--text-muted)" }}>Chưa có page nào. Nhấn "Thêm page" để kết nối Facebook.</p>
        )}

        {/* Add page form */}
        {showAddForm && (
          <div className="space-y-3 pt-3 border-t" style={{ borderColor: "var(--border)" }}>
            <p className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Thêm Facebook Page mới</p>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Page ID" placeholder="123456789" value={newPage.fbPageId} onChange={(e) => setNewPage((p) => ({ ...p, fbPageId: e.target.value }))} />
              <Input label="Tên Page" placeholder="Spa ABC" value={newPage.pageName} onChange={(e) => setNewPage((p) => ({ ...p, pageName: e.target.value }))} />
            </div>
            <Input
              label="Page Access Token"
              type="password"
              placeholder="EAAxxxx..."
              value={newPage.accessToken}
              onChange={(e) => setNewPage((p) => ({ ...p, accessToken: e.target.value }))}
              hint="Cần quyền: pages_read_engagement + pages_manage_posts + pages_messaging"
            />
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" loading={fbTest.status === "loading"} onClick={testFbPage}>Test kết nối</Button>
              <Button size="sm" loading={addingPage} onClick={addFbPage} disabled={!newPage.fbPageId || !newPage.pageName || !newPage.accessToken}>
                <Plus size={11} /> Lưu page
              </Button>
            </div>
            <TestResult test={fbTest} />
          </div>
        )}
      </Card>

      {/* Zalo */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Lightning size={16} style={{ color: "#0068FF" }} weight="fill" />
            <CardTitle>Zalo OA</CardTitle>
            <SavedBadge has={saved.zaloToken} />
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="neutral">Đăng bài Zalo</Badge>
            <Button size="sm" variant="secondary" loading={tests.zalo.status === "loading"} onClick={() => testConnection("zalo")}>
              Test kết nối
            </Button>
          </div>
        </CardHeader>
        <div className="space-y-3">
          <Input
            label="Zalo Access Token"
            type="password"
            placeholder={saved.zaloToken ? "Để trống = giữ nguyên token cũ" : "Token từ Zalo OA..."}
            value={f.zaloToken}
            onChange={set("zaloToken")}
            hint="Lấy từ oa.zalo.me > Ứng dụng > API Explorer"
          />
          <Input label="Zalo OA ID" placeholder="ID Official Account" value={f.zaloOaId} onChange={set("zaloOaId")} />
        </div>
        <TestResult test={tests.zalo} />
      </Card>

      {/* Facebook Webhook */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Globe size={16} style={{ color: "#1877F2" }} />
            <CardTitle>Facebook Webhook (tự động thật)</CardTitle>
          </div>
          <Badge variant="info">Real-time</Badge>
        </CardHeader>
        <div className="space-y-3">
          {/* Webhook URL */}
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Callback URL (dán vào Meta Developer Console)</label>
            <div className="flex gap-2 items-center">
              <code className="flex-1 text-xs px-3 py-2 rounded-lg break-all" style={{ background: "var(--bg-subtle)", color: "var(--text)" }}>
                https://yourdomain.com/api/webhook/facebook
              </code>
              <button
                onClick={() => navigator.clipboard.writeText("https://yourdomain.com/api/webhook/facebook")}
                className="shrink-0 p-2 rounded-lg" style={{ background: "var(--bg-subtle)", color: "var(--text-muted)" }}
                title="Copy">
                <Copy size={13} />
              </button>
            </div>
            <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>Thay <code>yourdomain.com</code> bằng domain thật sau khi deploy (Vercel, Railway...)</p>
          </div>

          <Input
            label="Verify Token"
            placeholder="VD: autospa_webhook_secret_2024"
            value={f.webhookVerifyToken}
            onChange={set("webhookVerifyToken")}
            hint="Tạo chuỗi bất kỳ, dán cùng chuỗi này vào ô Verify Token trong Meta Developer Console"
          />

          {/* Auto-reply toggles */}
          <div className="space-y-2">
            <label className="block text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Tự động xử lý khi nhận webhook</label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={f.autoReplyComments} onChange={(e) => setForm((p) => ({ ...p, autoReplyComments: e.target.checked }))} className="w-4 h-4 rounded" />
              <div>
                <p className="text-sm" style={{ color: "var(--text)" }}>Tự reply comment khớp quy tắc</p>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>Comment có từ khóa → gửi reply ngay, không cần duyệt</p>
              </div>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={f.autoReplyMessages} onChange={(e) => setForm((p) => ({ ...p, autoReplyMessages: e.target.checked }))} className="w-4 h-4 rounded" />
              <div>
                <p className="text-sm" style={{ color: "var(--text)" }}>Tự reply inbox bằng AI</p>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>Tin nhắn mới → Claude soạn + gửi ngay qua Messenger</p>
              </div>
            </label>
          </div>

          {/* Setup guide */}
          <div className="p-3 rounded-lg text-xs space-y-1.5" style={{ background: "var(--bg-subtle)", color: "var(--text-secondary)" }}>
            <p className="font-medium" style={{ color: "var(--text)" }}>Hướng dẫn kích hoạt:</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Deploy app lên Vercel / Railway để có URL public</li>
              <li>Vào <strong>developers.facebook.com</strong> → App → Add Product → Webhooks</li>
              <li>Chọn <strong>Page</strong> → Edit subscription</li>
              <li>Dán Callback URL + Verify Token ở trên → Verify and Save</li>
              <li>Subscribe các events: <code>feed</code> (comment), <code>messages</code> (inbox)</li>
              <li>Lưu Cài đặt tại đây → webhook bắt đầu nhận dữ liệu thật</li>
            </ol>
          </div>
        </div>
      </Card>

      {/* Library retention */}
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
              <input
                type="number"
                min="0"
                className="w-full px-3 py-2 text-sm rounded-lg border outline-none"
                style={{ background: "var(--bg-card)", borderColor: "var(--border)", color: "var(--text)" }}
                value={f.draftRetentionDays}
                onChange={set("draftRetentionDays")}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Giữ bài đã đăng (ngày)</label>
              <input
                type="number"
                min="0"
                className="w-full px-3 py-2 text-sm rounded-lg border outline-none"
                style={{ background: "var(--bg-card)", borderColor: "var(--border)", color: "var(--text)" }}
                value={f.publishedRetentionDays}
                onChange={set("publishedRetentionDays")}
              />
            </div>
          </div>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Bài nháp/đã đăng cũ hơn số ngày trên sẽ tự xóa mỗi khi mở Thư viện. Nhập <strong>0</strong> để giữ mãi mãi.
          </p>
        </div>
      </Card>

      <Button onClick={handleSave} loading={loading} size="lg" className="w-full">
        {saveOk ? <><CheckCircle size={14} weight="fill" /> Đã lưu!</> : "Lưu cài đặt"}
      </Button>
    </div>
  );
}
