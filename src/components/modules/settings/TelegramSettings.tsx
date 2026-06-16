"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { TelegramLogo, Bell, CalendarBlank, PaperPlaneTilt, CheckCircle } from "@phosphor-icons/react";

interface TelegramConfig {
  hasBotToken: boolean;
  botTokenMasked: string | null;
  telegramChatId: string;
  telegramAlerts: boolean;
  weeklyReportEnabled: boolean;
  weeklyReportDay: number;
  weeklyReportHour: number;
}

const DAYS = ["Chủ nhật", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"];

export function TelegramSettings() {
  const [config, setConfig] = useState<TelegramConfig>({
    hasBotToken: false, botTokenMasked: null, telegramChatId: "",
    telegramAlerts: true, weeklyReportEnabled: true, weeklyReportDay: 1, weeklyReportHour: 8,
  });
  const [botToken, setBotToken] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [sendingReport, setSendingReport] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    fetch("/api/telegram", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "get" }) })
      .then(r => r.json())
      .then(res => { if (res.data) setConfig(res.data); });
  }, []);

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
      if (data.success) setBotToken("");
    } finally { setSaving(false); }
  };

  const test = async () => {
    const tokenToTest = botToken || config.botTokenMasked || "";
    if (!tokenToTest || !config.telegramChatId) {
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
            <CheckCircle size={10} weight="fill" /> Đã kết nối
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
          placeholder={config.botTokenMasked ?? "123456789:AAFxxxxxxxxxx"}
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

        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={test} loading={testing}>Test kết nối</Button>
          <Button size="sm" variant="secondary" onClick={save} loading={saving}>Lưu</Button>
        </div>

        {/* Alerts toggle */}
        <div className="pt-3 border-t space-y-3" style={{ borderColor: "var(--border)" }}>
          <p className="text-xs font-semibold" style={{ color: "var(--text)" }}>Cài đặt thông báo</p>

          <label className="flex items-center justify-between cursor-pointer">
            <div className="flex items-center gap-2">
              <Bell size={13} style={{ color: "var(--warning)" }} weight="fill" />
              <span className="text-xs" style={{ color: "var(--text)" }}>Cảnh báo tức thời (revenue drop, lead spike...)</span>
            </div>
            <div
              onClick={() => setConfig(c => ({ ...c, telegramAlerts: !c.telegramAlerts }))}
              className="w-9 h-5 rounded-full transition-colors cursor-pointer relative"
              style={{ background: config.telegramAlerts ? "var(--accent)" : "var(--border)" }}
            >
              <div className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform"
                style={{ left: config.telegramAlerts ? "calc(100% - 18px)" : "2px" }} />
            </div>
          </label>

          <label className="flex items-center justify-between cursor-pointer">
            <div className="flex items-center gap-2">
              <CalendarBlank size={13} style={{ color: "var(--blue)" }} weight="fill" />
              <span className="text-xs" style={{ color: "var(--text)" }}>Báo cáo tuần tự động</span>
            </div>
            <div
              onClick={() => setConfig(c => ({ ...c, weeklyReportEnabled: !c.weeklyReportEnabled }))}
              className="w-9 h-5 rounded-full transition-colors cursor-pointer relative"
              style={{ background: config.weeklyReportEnabled ? "var(--accent)" : "var(--border)" }}
            >
              <div className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform"
                style={{ left: config.weeklyReportEnabled ? "calc(100% - 18px)" : "2px" }} />
            </div>
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
