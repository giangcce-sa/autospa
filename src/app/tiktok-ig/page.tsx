"use client";

import { useState, useEffect, useCallback } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import {
  InstagramLogo, ArrowsClockwise, PaperPlaneTilt, Image as ImageIcon,
  CheckCircle, XCircle, Sparkle, MagicWand,
} from "@phosphor-icons/react";

function TikTokIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.17 8.17 0 004.77 1.52V6.74a4.85 4.85 0 01-1-.05z"/>
    </svg>
  );
}

interface IgPage { id: string; pageName: string; igAccountId: string | null; igUsername: string | null; }
interface TkAccount { id: string; displayName: string; avatarUrl: string | null; isActive: boolean; }
interface IgMedia { id: string; caption?: string; media_type: string; timestamp: string; like_count: number; comments_count: number; }

export default function TikTokIgPage() {
  const [igPages, setIgPages] = useState<IgPage[]>([]);
  const [tkAccounts, setTkAccounts] = useState<TkAccount[]>([]);
  const [igMedia, setIgMedia] = useState<IgMedia[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMedia, setLoadingMedia] = useState(false);

  // Repurpose state
  const [facebookCaption, setFacebookCaption] = useState("");
  const [repurposed, setRepurposed] = useState<{ instagram: string; tiktok: string; story: string } | null>(null);
  const [repurposing, setRepurposing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [ig, tk] = await Promise.all([
      fetch("/api/instagram").then((r) => r.json()),
      fetch("/api/tiktok?action=accounts").then((r) => r.json()),
    ]);
    if (ig.success) setIgPages(ig.data);
    if (tk.success) setTkAccounts(tk.data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const loadIgMedia = async (pageId: string) => {
    setLoadingMedia(true);
    const res = await fetch(`/api/instagram?action=media&facebookPageId=${pageId}`);
    const json = await res.json();
    if (json.success) setIgMedia(json.data);
    setLoadingMedia(false);
  };

  const repurpose = async () => {
    if (!facebookCaption.trim()) return;
    setRepurposing(true);
    setRepurposed(null);
    const res = await fetch("/api/repurpose", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ caption: facebookCaption, platform: "facebook" }),
    });
    const json = await res.json();
    if (json.success) {
      setRepurposed({ instagram: json.data.facebook, tiktok: json.data.tiktok, story: json.data.story });
    }
    setRepurposing(false);
  };

  const connectedIgPages = igPages.filter((p) => p.igAccountId);
  const activeAccounts = tkAccounts.filter((a) => a.isActive);

  return (
    <>
      <PageHeader
        title="TikTok & Instagram"
        description="Quản lý tài khoản, xem media, và tối ưu content cho từng nền tảng"
      />

      <div className="space-y-4 max-w-5xl">
        {/* Connection status */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Instagram */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <InstagramLogo size={16} weight="fill" style={{ color: "#E1306C" }} />
                Instagram Business
              </CardTitle>
            </CardHeader>
            {loading ? <div className="skeleton h-12 rounded-xl" /> : (
              <div className="space-y-2">
                {connectedIgPages.length === 0 ? (
                  <div className="flex items-center gap-2">
                    <XCircle size={14} weight="fill" style={{ color: "var(--danger)" }} />
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>Chưa kết nối — vào Cài đặt → Instagram</span>
                  </div>
                ) : connectedIgPages.map((p) => (
                  <div key={p.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle size={14} weight="fill" style={{ color: "var(--success)" }} />
                      <div>
                        <p className="text-xs font-semibold" style={{ color: "var(--text)" }}>@{p.igUsername}</p>
                        <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Từ: {p.pageName}</p>
                      </div>
                    </div>
                    <Button size="sm" variant="secondary" loading={loadingMedia} onClick={() => loadIgMedia(p.id)}>
                      <ArrowsClockwise size={11} /> Xem media
                    </Button>
                  </div>
                ))}
                {connectedIgPages.length === 0 && (
                  <a href="/settings" className="text-xs underline" style={{ color: "var(--accent)" }}>
                    Kết nối Instagram →
                  </a>
                )}
              </div>
            )}
          </Card>

          {/* TikTok */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span><TikTokIcon size={16} /></span>
                TikTok for Business
              </CardTitle>
            </CardHeader>
            {loading ? <div className="skeleton h-12 rounded-xl" /> : (
              <div className="space-y-2">
                {activeAccounts.length === 0 ? (
                  <div className="flex items-center gap-2">
                    <XCircle size={14} weight="fill" style={{ color: "var(--danger)" }} />
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>Chưa kết nối — vào Cài đặt → TikTok</span>
                  </div>
                ) : activeAccounts.map((a) => (
                  <div key={a.id} className="flex items-center gap-2">
                    {a.avatarUrl && <img src={a.avatarUrl} alt="" className="w-7 h-7 rounded-full" />}
                    <div>
                      <p className="text-xs font-semibold" style={{ color: "var(--text)" }}>{a.displayName}</p>
                      <div className="flex items-center gap-1">
                        <CheckCircle size={11} weight="fill" style={{ color: "var(--success)" }} />
                        <p className="text-[10px]" style={{ color: "var(--success)" }}>Đang hoạt động</p>
                      </div>
                    </div>
                  </div>
                ))}
                {activeAccounts.length === 0 && (
                  <a href="/settings" className="text-xs underline" style={{ color: "var(--accent)" }}>
                    Kết nối TikTok →
                  </a>
                )}
              </div>
            )}
          </Card>
        </div>

        {/* AI Caption Repurpose */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MagicWand size={14} weight="fill" style={{ color: "var(--premium)" }} />
              AI Repurpose Caption — Facebook → Instagram & TikTok
            </CardTitle>
          </CardHeader>

          <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>
            Paste caption Facebook → AI tự điều chỉnh tone/hashtag/format phù hợp từng nền tảng
          </p>

          <Textarea
            value={facebookCaption}
            onChange={(e) => setFacebookCaption(e.target.value)}
            placeholder="Paste caption Facebook gốc vào đây..."
            rows={4}
            className="mb-2"
          />

          <Button onClick={repurpose} loading={repurposing} disabled={!facebookCaption.trim()}>
            <Sparkle size={13} weight="fill" /> Tạo phiên bản cho IG & TikTok
          </Button>

          {repurposed && (
            <div className="mt-4 space-y-3">
              {[
                { key: "instagram" as const, label: "Instagram", icon: InstagramLogo, color: "#E1306C" },
                { key: "tiktok" as const, label: "TikTok Script", icon: TikTokIcon, color: "#000" },
                { key: "story" as const, label: "Story / Reel", icon: ImageIcon, color: "var(--amber)" },
              ].map(({ key, label, icon: Icon, color }) => (
                <div key={key} className="rounded-xl border p-3" style={{ borderColor: "var(--border)" }}>
                  <div className="flex items-center gap-2 mb-2">
                    <Icon size={13} style={{ color }} />
                    <p className="text-[11px] font-semibold" style={{ color: "var(--text)" }}>{label}</p>
                  </div>
                  <div className="text-xs whitespace-pre-wrap leading-relaxed p-2 rounded-lg" style={{ background: "var(--bg-subtle)", color: "var(--text)" }}>
                    {repurposed[key]}
                  </div>
                  <button
                    onClick={() => navigator.clipboard.writeText(repurposed[key])}
                    className="mt-1.5 text-[10px] underline"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Copy
                  </button>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Instagram media grid */}
        {igMedia.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <InstagramLogo size={14} weight="fill" style={{ color: "#E1306C" }} />
                Instagram Media gần đây
              </CardTitle>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead>
                  <tr style={{ color: "var(--text-muted)" }}>
                    <th className="text-left pb-2 font-semibold">Caption</th>
                    <th className="text-right pb-2 font-semibold">Likes</th>
                    <th className="text-right pb-2 font-semibold">Comments</th>
                    <th className="text-right pb-2 font-semibold">Ngày</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: "var(--border)" }}>
                  {igMedia.map((m) => (
                    <tr key={m.id}>
                      <td className="py-1.5 pr-3 max-w-[300px]">
                        <p className="truncate" style={{ color: "var(--text)" }}>{m.caption?.slice(0, 80) ?? "(no caption)"}</p>
                        <span className="text-[9px]" style={{ color: "var(--text-muted)" }}>{m.media_type}</span>
                      </td>
                      <td className="py-1.5 text-right tabular-nums" style={{ color: "var(--text)" }}>{m.like_count}</td>
                      <td className="py-1.5 text-right tabular-nums" style={{ color: "var(--text)" }}>{m.comments_count}</td>
                      <td className="py-1.5 text-right tabular-nums" style={{ color: "var(--text-muted)" }}>
                        {new Date(m.timestamp).toLocaleDateString("vi-VN")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* Quick links */}
        <div className="flex gap-2 flex-wrap">
          <a href="/settings"><Button variant="secondary" size="sm">Cấu hình tài khoản</Button></a>
          <a href="/publish"><Button variant="secondary" size="sm"><PaperPlaneTilt size={12} /> Đăng đa nền tảng</Button></a>
          <a href="/analytics"><Button variant="secondary" size="sm">Xem analytics so sánh</Button></a>
        </div>
      </div>
    </>
  );
}
