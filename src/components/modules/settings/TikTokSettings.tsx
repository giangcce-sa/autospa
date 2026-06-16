"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { CheckCircle, Trash, LinkSimple, User } from "@phosphor-icons/react";

// TikTok logo SVG (no phosphor icon available)
function TikTokIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.17 8.17 0 004.77 1.52V6.74a4.85 4.85 0 01-1-.05z"/>
    </svg>
  );
}

interface TikTokAccount {
  id: string;
  openId: string;
  displayName: string;
  avatarUrl: string | null;
  isActive: boolean;
  expiresAt: string | null;
}

export function TikTokSettings() {
  const [accounts, setAccounts] = useState<TikTokAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [authUrl, setAuthUrl] = useState("");
  const [showManual, setShowManual] = useState(false);
  const [manual, setManual] = useState({ accessToken: "", openId: "", displayName: "" });
  const [connecting, setConnecting] = useState(false);
  const [msg, setMsg] = useState("");

  const load = async () => {
    setLoading(true);
    const res = await fetch("/api/tiktok?action=accounts");
    const json = await res.json();
    if (json.success) setAccounts(json.data);
    setLoading(false);
  };

  const loadAuthUrl = async () => {
    const res = await fetch("/api/tiktok?action=auth-url");
    const json = await res.json();
    if (json.success) setAuthUrl(json.data.url);
  };

  useEffect(() => {
    load();
    loadAuthUrl();
  }, []);

  const manualConnect = async () => {
    if (!manual.accessToken || !manual.openId) { setMsg("Cần nhập Access Token và Open ID"); return; }
    setConnecting(true);
    setMsg("");
    const res = await fetch("/api/tiktok", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "manual-connect", ...manual }),
    });
    const json = await res.json();
    if (json.success) {
      setMsg(`✓ Đã kết nối @${json.data.displayName}`);
      setShowManual(false);
      setManual({ accessToken: "", openId: "", displayName: "" });
      load();
    } else {
      setMsg(`✗ ${json.error}`);
    }
    setConnecting(false);
  };

  const disconnect = async (id: string) => {
    await fetch("/api/tiktok", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "disconnect", id }),
    });
    load();
  };

  const toggle = async (id: string, isActive: boolean) => {
    await fetch("/api/tiktok", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "toggle-active", id, isActive }),
    });
    load();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span style={{ color: "#000" }}><TikTokIcon size={16} /></span>
          TikTok for Business
        </CardTitle>
      </CardHeader>

      <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>
        Kết nối TikTok Business Account để đăng ảnh/video từ AutoSpa. Yêu cầu: TikTok for Business account và app credentials (TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET trong .env).
      </p>

      {/* Connected accounts */}
      {loading ? (
        <div className="skeleton h-14 rounded-xl mb-3" />
      ) : accounts.length > 0 ? (
        <div className="space-y-2 mb-3">
          {accounts.map((acc) => {
            const expired = acc.expiresAt && new Date(acc.expiresAt) < new Date();
            return (
              <div key={acc.id} className="flex items-center gap-3 p-3 rounded-xl border"
                style={{ borderColor: "var(--border)", background: "var(--bg-subtle)" }}>
                {acc.avatarUrl ? (
                  <img src={acc.avatarUrl} alt="" className="w-8 h-8 rounded-full shrink-0" />
                ) : (
                  <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: "var(--bg-card)" }}>
                    <User size={14} style={{ color: "var(--text-muted)" }} />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: "var(--text)" }}>{acc.displayName}</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <CheckCircle size={12} weight="fill" style={{ color: expired ? "var(--warning)" : acc.isActive ? "var(--success)" : "var(--text-muted)" }} />
                    <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                      {expired ? "Token hết hạn" : acc.isActive ? "Đang hoạt động" : "Tắt"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => toggle(acc.id, !acc.isActive)}
                    className="text-[11px] px-2 py-0.5 rounded-full border transition-colors"
                    style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
                  >
                    {acc.isActive ? "Tắt" : "Bật"}
                  </button>
                  <button onClick={() => disconnect(acc.id)} style={{ color: "var(--danger)" }}>
                    <Trash size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {/* Connect buttons */}
      <div className="flex gap-2 flex-wrap">
        {authUrl && (
          <a href={authUrl} target="_blank" rel="noopener noreferrer">
            <Button size="sm">
              <LinkSimple size={13} /> Kết nối qua OAuth
            </Button>
          </a>
        )}
        <Button variant="secondary" size="sm" onClick={() => setShowManual((v) => !v)}>
          Nhập token thủ công
        </Button>
      </div>

      {showManual && (
        <div className="mt-3 space-y-2 p-3 rounded-xl border" style={{ borderColor: "var(--border)" }}>
          <p className="text-[11px] font-semibold" style={{ color: "var(--text-muted)" }}>
            Lấy token từ TikTok for Developers → My Apps → Access Token
          </p>
          <Input placeholder="Access Token" value={manual.accessToken} onChange={(e) => setManual((m) => ({ ...m, accessToken: e.target.value }))} />
          <Input placeholder="Open ID (user identifier)" value={manual.openId} onChange={(e) => setManual((m) => ({ ...m, openId: e.target.value }))} />
          <Input placeholder="Display Name (tùy chọn)" value={manual.displayName} onChange={(e) => setManual((m) => ({ ...m, displayName: e.target.value }))} />
          <Button size="sm" onClick={manualConnect} loading={connecting}>Xác nhận kết nối</Button>
        </div>
      )}

      {msg && (
        <p className="mt-2 text-xs" style={{ color: msg.startsWith("✓") ? "var(--success)" : "var(--danger)" }}>
          {msg}
        </p>
      )}
    </Card>
  );
}
