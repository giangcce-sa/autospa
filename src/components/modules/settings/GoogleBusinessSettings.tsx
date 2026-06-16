"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { CheckCircle, XCircle, ArrowsClockwise, MapPin, Trash, LinkSimple } from "@phosphor-icons/react";

// Google "G" logo
function GoogleIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

interface GbpAccount {
  id: string; email: string; displayName: string | null;
  accountId: string | null; locationId: string | null; locationName: string | null;
  isActive: boolean; expiresAt: string | null;
}

interface GbpLocation { name: string; title: string; }

export function GoogleBusinessSettings() {
  const [accounts, setAccounts] = useState<GbpAccount[]>([]);
  const [locations, setLocations] = useState<GbpLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [authUrl, setAuthUrl] = useState("");
  const [discoveringLoc, setDiscoveringLoc] = useState(false);
  const [settingLoc, setSettingLoc] = useState(false);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const [ac, au] = await Promise.all([
      fetch("/api/google-business?action=accounts").then((r) => r.json()),
      fetch("/api/google-business?action=auth-url").then((r) => r.json()),
    ]);
    if (ac.success) setAccounts(ac.data);
    if (au.success) setAuthUrl(au.data.url);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const discoverLocations = async () => {
    setDiscoveringLoc(true);
    const res = await fetch("/api/google-business?action=discover-locations");
    const json = await res.json();
    if (json.success) setLocations(json.data);
    else setMsg(`✗ ${json.message ?? json.error}`);
    setDiscoveringLoc(false);
  };

  const setLocation = async (accountId: string, locationId: string, locationName: string) => {
    setSettingLoc(true);
    await fetch("/api/google-business", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "set-location", googleAccountDbId: accountId, locationId, locationName }),
    });
    setMsg(`✓ Đã chọn "${locationName}"`);
    setLocations([]);
    load();
    setSettingLoc(false);
  };

  const disconnect = async (id: string) => {
    await fetch("/api/google-business", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "disconnect", id }),
    });
    load();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GoogleIcon size={16} />
          Google Business Profile
        </CardTitle>
      </CardHeader>

      <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>
        Kết nối Google Business Profile để quản lý đánh giá và đăng cập nhật trực tiếp từ AutoSpa. Yêu cầu: tài khoản Google có quyền quản lý Google Business Profile.
      </p>

      {loading ? (
        <div className="skeleton h-14 rounded-xl mb-3" />
      ) : accounts.length > 0 ? (
        <div className="space-y-2 mb-3">
          {accounts.map((acc) => {
            const expired = acc.expiresAt && new Date(acc.expiresAt) < new Date();
            return (
              <div key={acc.id} className="rounded-xl border p-3" style={{ borderColor: "var(--border)", background: "var(--bg-subtle)" }}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <CheckCircle size={14} weight="fill" style={{ color: expired ? "var(--warning)" : "var(--success)" }} />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: "var(--text)" }}>{acc.displayName ?? acc.email}</p>
                      <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{acc.email}</p>
                    </div>
                  </div>
                  <button onClick={() => disconnect(acc.id)} style={{ color: "var(--danger)" }}>
                    <Trash size={13} />
                  </button>
                </div>

                {/* Location */}
                {acc.locationId ? (
                  <div className="mt-2 flex items-center gap-1.5 text-[11px]" style={{ color: "var(--text-muted)" }}>
                    <MapPin size={11} weight="fill" style={{ color: "var(--accent)" }} />
                    <span>{acc.locationName ?? acc.locationId}</span>
                    <button onClick={discoverLocations} className="underline ml-1" style={{ color: "var(--accent)" }}>
                      Đổi
                    </button>
                  </div>
                ) : (
                  <div className="mt-2">
                    <div className="flex items-center gap-1.5 text-[11px] mb-1.5" style={{ color: "var(--warning)" }}>
                      <XCircle size={11} />
                      <span>Chưa chọn location</span>
                    </div>
                    <Button size="sm" variant="secondary" onClick={discoverLocations} loading={discoveringLoc}>
                      <MapPin size={11} /> Khám phá locations
                    </Button>
                  </div>
                )}

                {/* Location picker */}
                {locations.length > 0 && (
                  <div className="mt-2 space-y-1">
                    <p className="text-[10px] font-semibold" style={{ color: "var(--text-muted)" }}>CHỌN LOCATION:</p>
                    {locations.map((loc) => (
                      <button
                        key={loc.name}
                        onClick={() => setLocation(acc.id, loc.name, loc.title)}
                        disabled={settingLoc}
                        className="w-full text-left text-xs px-2 py-1.5 rounded-lg hover:opacity-80 transition-opacity"
                        style={{ background: "var(--bg-card)", color: "var(--text)", border: "1px solid var(--border)" }}
                      >
                        {loc.title}
                        <span className="ml-1 text-[9px]" style={{ color: "var(--text-muted)" }}>{loc.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : null}

      {authUrl && (
        <a href={authUrl} target="_blank" rel="noopener noreferrer">
          <Button size="sm">
            <LinkSimple size={13} /> Kết nối Google Business
          </Button>
        </a>
      )}

      {msg && (
        <p className="mt-2 text-xs" style={{ color: msg.startsWith("✓") ? "var(--success)" : "var(--danger)" }}>
          {msg}
        </p>
      )}
    </Card>
  );
}
