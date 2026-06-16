"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { InstagramLogo, CheckCircle, XCircle, ArrowsClockwise, Link, LinkBreak } from "@phosphor-icons/react";

interface FbPageWithIg {
  id: string;
  pageName: string;
  fbPageId: string;
  igAccountId: string | null;
  igUsername: string | null;
  isActive: boolean;
}

export function InstagramSettings() {
  const [pages, setPages] = useState<FbPageWithIg[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [msg, setMsg] = useState("");

  const load = async () => {
    setLoading(true);
    const res = await fetch("/api/instagram");
    const json = await res.json();
    if (json.success) setPages(json.data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const connect = async (pageId: string) => {
    setConnecting(pageId);
    setMsg("");
    const res = await fetch("/api/instagram", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "connect", facebookPageId: pageId }),
    });
    const json = await res.json();
    if (json.success) {
      setMsg(`✓ Đã kết nối @${json.data.username}`);
      load();
    } else {
      setMsg(`✗ ${json.message ?? json.error}`);
    }
    setConnecting(null);
  };

  const disconnect = async (pageId: string) => {
    await fetch("/api/instagram", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "disconnect", facebookPageId: pageId }),
    });
    load();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <InstagramLogo size={16} weight="fill" style={{ color: "#E1306C" }} />
          Instagram Business
        </CardTitle>
      </CardHeader>

      <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>
        Instagram Business Account được khám phá tự động từ Facebook Page đã kết nối. Yêu cầu: trang Facebook phải được link với Instagram Business trong Facebook Business Manager.
      </p>

      {loading ? (
        <div className="space-y-2">{[1, 2].map((i) => <div key={i} className="skeleton h-14 rounded-xl" />)}</div>
      ) : pages.length === 0 ? (
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>Chưa có Facebook Page nào. Thêm Facebook Page trước.</p>
      ) : (
        <div className="space-y-2">
          {pages.map((page) => (
            <div
              key={page.id}
              className="flex items-center justify-between gap-3 p-3 rounded-xl border"
              style={{ borderColor: "var(--border)", background: "var(--bg-subtle)" }}
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate" style={{ color: "var(--text)" }}>{page.pageName}</p>
                {page.igAccountId ? (
                  <div className="flex items-center gap-1 mt-0.5">
                    <CheckCircle size={12} weight="fill" style={{ color: "var(--success)" }} />
                    <p className="text-[11px]" style={{ color: "var(--success)" }}>@{page.igUsername ?? page.igAccountId}</p>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 mt-0.5">
                    <XCircle size={12} weight="fill" style={{ color: "var(--text-muted)" }} />
                    <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>Chưa kết nối Instagram</p>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {page.igAccountId ? (
                  <>
                    <Button variant="ghost" size="sm" onClick={() => connect(page.id)} loading={connecting === page.id}>
                      <ArrowsClockwise size={12} /> Đồng bộ
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => disconnect(page.id)}>
                      <LinkBreak size={12} /> Gỡ
                    </Button>
                  </>
                ) : (
                  <Button size="sm" onClick={() => connect(page.id)} loading={connecting === page.id}>
                    <Link size={12} /> Kết nối IG
                  </Button>
                )}
              </div>
            </div>
          ))}
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
