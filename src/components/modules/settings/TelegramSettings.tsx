"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { TelegramLogo, Bell, CalendarBlank, PaperPlaneTilt, CheckCircle } from "@phosphor-icons/react";

export interface TelegramConfig {
  hasBotToken: boolean;
  telegramChatId: string;
  telegramAdminUserId: string;
  telegramAlerts: boolean;
  weeklyReportEnabled: boolean;
  weeklyReportDay: number;
  weeklyReportHour: number;
  webhookConfigured: boolean;
  webhookUrl: string | null;
  lastDelivery: { status: string; type: string; error: string | null; createdAt: string } | null;
}

const DAYS = ["Chủ nhật", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"];

const EMPTY_CONFIG: TelegramConfig = {
  hasBotToken: false, telegramChatId: "", telegramAdminUserId: "",
  telegramAlerts: true, weeklyReportEnabled: true, weeklyReportDay: 1, weeklyReportHour: 8,
  webhookConfigured: false, webhookUrl: null,
  lastDelivery: null,
};

export function TelegramSettings({ initialConfig }: { initialConfig?: TelegramConfig }) {
  const [config, setConfig] = useState<TelegramConfig>(initialConfig ?? EMPTY_CONFIG);
  const [botToken, setBotToken] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [sendingReport, setSendingReport] = useState(false);
  const [webhookBusy, setWebhookBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    if (initialConfig !== undefined) return;
    fetch("/api/telegram", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "get" }) })
      .then(r => r.json())
      .then(res => { if (res.data) setConfig(res.data); });
  }, [initialConfig]);

  const showMsg = (text: string, ok: boolean) => {
    setMsg({ text, ok });
    setTimeout(() => setMsg(null), 4000);
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/telegram", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save", telegramBotToken: botToken, ...config }),
      });
      const data = await res.json();
      showMsg(data.success ? "Đã lưu cài đặt Telegram" : data.error, data.success);
      if (data.success) {
        if (data.data) setConfig(data.data);
        setBotToken("");
      }
    } finally { setSaving(false); }
  };

  const test = async () => {
    if ((!botToken && !config.hasBotToken) || !config.telegramChatId) {
      showMsg("Nhập Bot Token và Chat ID trước", false); return;
    }
    setTesting(true);
    try {
      const res = await fetch("/api/telegram", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "test", token: botToken, chatId: config.telegramChatId }),
      });
      const data = await res.json();
      showMsg(data.message, data.success);
    } finally { setTesting(false); }
  };

  const sendTestReport = async () => {
    setSendingReport(true);
    try {
      const res = await fetch("/api/telegram", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send-test-report" }),
      });
      const data = await res.json();
      showMsg(data.message ?? (data.success ? "Đã gửi báo cáo thử!" : data.error), data.success);
    } finally { setSendingReport(false); }
  };

  const updateWebhook = async (action: "register-webhook" | "webhook-status" | "delete-webhook") => {
    setWebhookBusy(true);
    try {
      const res = await fetch("/api/telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (action === "webhook-status" && data.success) {
        const pending = Number(data.data?.pending_update_count ?? 0);
        showMsg(data.data?.last_error_message ? `Webhook lỗi: ${data.data.last_error_message}` : `Webhook hoạt động · ${pending} update đang chờ`, !data.data?.last_error_message);
      } else {
        showMsg(data.message ?? (data.success ? "Đã cập nhật webhook" : data.error), data.success);
      }
      if (data.success && action !== "webhook-status") {
        const refreshed = await fetch("/api/telegram", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "get" }),
        }).then(response => response.json());
        if (refreshed.data) setConfig(refreshed.data);
      }
    } finally {
      setWebhookBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: "#229ED920" }}>
            <TelegramLogo size={14} weight="fill" style={{ color: "#229ED9" }} />
          </div>
          <CardTitle>Telegram Bot</CardTitle>
        </div>
        {config.hasBotToken && (
          <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "var(--success-light)", color: "var(--success)" }}>
            <CheckCircle size={10} weight="fill" /> Đã lưu token
          </span>
        )}
      </CardHeader>

      {/* Setup guide */}
      <div className="rounded-xl p-3 mb-4 text-xs space-y-1" style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)" }}>
        <p className="font-semibold" style={{ color: "var(--text)" }}>Cách lấy Bot Token:</p>
        <p style={{ color: "var(--text-muted)" }}>1. Nhắn <code className="px-1 rounded" style={{ background: "var(--border)" }}>@BotFather</code> trên Telegram → /newbot</p>
        <p style={{ color: "var(--text-muted)" }}>2. Đặt tên bot → nhận token dạng <code className="px-1 rounded" style={{ background: "var(--border)" }}>123456:ABC...</code></p>
        <p style={{ color: "var(--text-muted)" }}>3. Chat ID: nhắn tin cho bot rồi vào <code className="px-1 rounded" style={{ background: "var(--border)" }}>api.telegram.org/bot{"{token}"}/getUpdates</code></p>
      </div>

      <div className="space-y-3">
        <Input
          label="Bot Token"
          placeholder={config.hasBotToken ? "Để trống = giữ token hiện tại" : "123456789:AAFxxxxxxxxxx"}
          value={botToken}
          onChange={e => setBotToken(e.target.value)}
          hint="Để trống nếu không muốn thay đổi token hiện tại"
        />
        <Input
          label="Chat ID"
          placeholder="-100xxxxxxxxx (group) hoặc số (cá nhân)"
          value={config.telegramChatId}
          onChange={e => setConfig(c => ({ ...c, telegramChatId: e.target.value }))}
        />
        <Input
          label="Admin User ID"
          placeholder="Telegram User ID được phép điều khiển"
          value={config.telegramAdminUserId}
          onChange={e => setConfig(c => ({ ...c, telegramAdminUserId: e.target.value }))}
          hint="Bắt buộc khi dùng group; tài khoản này mới được chạy lệnh và duyệt."
        />

        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={test} loading={testing}>Test kết nối</Button>
          <Button size="sm" variant="secondary" onClick={save} loading={saving}>Lưu</Button>
        </div>

        {config.hasBotToken && config.telegramChatId && (
          <div className="rounded-md border p-3 space-y-2" style={{ borderColor: "var(--border)", background: "var(--bg-subtle)" }}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold" style={{ color: "var(--text)" }}>Telegram Control Center</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                  {config.webhookConfigured ? "Webhook đã đăng ký" : "Webhook chưa đăng ký"}
                </p>
              </div>
              <span className="w-2 h-2 rounded-full" style={{ background: config.webhookConfigured ? "var(--success)" : "var(--warning)" }} />
            </div>
            <div className="flex flex-wrap gap-2">
              {!config.webhookConfigured ? (
                <Button size="sm" onClick={() => updateWebhook("register-webhook")} loading={webhookBusy}>
                  Kết nối điều khiển
                </Button>
              ) : (
                <>
                  <Button size="sm" variant="secondary" onClick={() => updateWebhook("webhook-status")} loading={webhookBusy}>
                    Kiểm tra webhook
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => { if (window.confirm("Ngắt Telegram webhook khỏi AutoSpa?")) void updateWebhook("delete-webhook"); }} loading={webhookBusy}>
                    Ngắt webhook
                  </Button>
                </>
              )}
            </div>
          </div>
        )}

        {config.lastDelivery && (
          <p className="text-xs" style={{ color: config.lastDelivery.status === "sent" ? "var(--success)" : "var(--danger)" }}>
            Lần gửi cuối: {config.lastDelivery.status === "sent" ? "thành công" : `thất bại · ${config.lastDelivery.error ?? "không rõ lỗi"}`}
          </p>
        )}

        {/* Alerts toggle */}
        <div className="pt-3 border-t space-y-3" style={{ borderColor: "var(--border)" }}>
          <p className="text-xs font-semibold" style={{ color: "var(--text)" }}>Cài đặt thông báo</p>

          <label className="flex items-center justify-between cursor-pointer">
            <div className="flex items-center gap-2">
              <Bell size={13} style={{ color: "var(--warning)" }} weight="fill" />
              <span className="text-xs" style={{ color: "var(--text)" }}>Cảnh báo tức thời (revenue drop, lead spike...)</span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={config.telegramAlerts}
              aria-label="Bật cảnh báo Telegram tức thời"
              onClick={() => setConfig(c => ({ ...c, telegramAlerts: !c.telegramAlerts }))}
              className="relative h-11 w-11 rounded-full transition-colors"
            >
              <span className="absolute left-1 top-[13px] h-[18px] w-9 rounded-full" style={{ background: config.telegramAlerts ? "var(--accent)" : "var(--border)" }} />
              <span className="absolute top-[14px] h-4 w-4 rounded-full bg-white shadow transition-transform"
                style={{ left: config.telegramAlerts ? "24px" : "5px" }} />
            </button>
          </label>

          <label className="flex items-center justify-between cursor-pointer">
            <div className="flex items-center gap-2">
              <CalendarBlank size={13} style={{ color: "var(--blue)" }} weight="fill" />
              <span className="text-xs" style={{ color: "var(--text)" }}>Báo cáo tuần tự động</span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={config.weeklyReportEnabled}
              aria-label="Bật báo cáo Telegram hàng tuần"
              onClick={() => setConfig(c => ({ ...c, weeklyReportEnabled: !c.weeklyReportEnabled }))}
              className="relative h-11 w-11 rounded-full transition-colors"
            >
              <span className="absolute left-1 top-[13px] h-[18px] w-9 rounded-full" style={{ background: config.weeklyReportEnabled ? "var(--accent)" : "var(--border)" }} />
              <span className="absolute top-[14px] h-4 w-4 rounded-full bg-white shadow transition-transform"
                style={{ left: config.weeklyReportEnabled ? "24px" : "5px" }} />
            </button>
          </label>

          {config.weeklyReportEnabled && (
            <div className="flex gap-2 items-center pl-5">
              <select
                value={config.weeklyReportDay}
                onChange={e => setConfig(c => ({ ...c, weeklyReportDay: Number(e.target.value) }))}
                className="rounded-lg px-2 py-1 text-xs outline-none"
                style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)", color: "var(--text)" }}
              >
                {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
              </select>
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>lúc</span>
              <select
                value={config.weeklyReportHour}
                onChange={e => setConfig(c => ({ ...c, weeklyReportHour: Number(e.target.value) }))}
                className="rounded-lg px-2 py-1 text-xs outline-none"
                style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)", color: "var(--text)" }}
              >
                {Array.from({ length: 24 }, (_, i) => <option key={i} value={i}>{`${i}:00`}</option>)}
              </select>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button size="sm" onClick={save} loading={saving}>Lưu cài đặt</Button>
          {config.hasBotToken && (
            <Button size="sm" variant="secondary" onClick={sendTestReport} loading={sendingReport}>
              <PaperPlaneTilt size={12} /> Gửi báo cáo thử
            </Button>
          )}
        </div>

        {msg && (
          <p className="text-xs font-medium" style={{ color: msg.ok ? "var(--success)" : "var(--danger)" }}>
            {msg.text}
          </p>
        )}
      </div>
    </Card>
  );
}
