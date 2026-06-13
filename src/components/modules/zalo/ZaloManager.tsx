"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Lightning, CheckCircle, PaperPlaneTilt } from "@phosphor-icons/react";

export function ZaloManager() {
  const [caption, setCaption] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [connected, setConnected] = useState<boolean | null>(null);

  const testConnection = async () => {
    const res = await fetch("/api/zalo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "test-connection" }) });
    const data = await res.json();
    setConnected(data.success);
  };

  const handlePost = async () => {
    if (!caption.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/zalo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caption, hashtags }),
      });
      const data = await res.json();
      setResult({ success: data.success, message: data.success ? "Đăng bài thành công!" : data.error });
    } finally { setLoading(false); }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 max-w-4xl">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Lightning size={16} style={{ color: "#0068FF" }} weight="fill" />
            <CardTitle>Đăng lên Zalo OA</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            {connected !== null && (
              <Badge variant={connected ? "success" : "danger"}>{connected ? "Đã kết nối" : "Chưa kết nối"}</Badge>
            )}
            <Button size="sm" variant="secondary" onClick={testConnection}>Test kết nối</Button>
          </div>
        </CardHeader>
        <div className="space-y-3">
          <Textarea label="Nội dung" placeholder="Nội dung bài đăng Zalo..." rows={6} value={caption} onChange={(e) => setCaption(e.target.value)} />
          <Textarea label="Hashtag (tùy chọn)" rows={2} placeholder="#spa #lamdep" value={hashtags} onChange={(e) => setHashtags(e.target.value)} />
          {result && (
            <div className="flex items-center gap-2 p-2 rounded" style={{ background: result.success ? "var(--accent-light)" : "var(--rose-light)", color: result.success ? "var(--accent)" : "var(--rose)" }}>
              {result.success && <CheckCircle size={13} weight="fill" />}
              <span className="text-xs">{result.message}</span>
            </div>
          )}
          <Button onClick={handlePost} loading={loading} className="w-full">
            <PaperPlaneTilt size={14} weight="fill" /> Đăng lên Zalo OA
          </Button>
        </div>
      </Card>

      <Card>
        <CardHeader><CardTitle>Hướng dẫn cấu hình</CardTitle></CardHeader>
        <div className="space-y-3 text-xs" style={{ color: "var(--text-secondary)" }}>
          <div className="p-3 rounded-lg space-y-2" style={{ background: "var(--bg-subtle)" }}>
            <p className="font-semibold" style={{ color: "var(--text)" }}>Bước 1: Tạo Zalo OA</p>
            <p>Truy cập oa.zalo.me và tạo Official Account cho spa.</p>
          </div>
          <div className="p-3 rounded-lg space-y-2" style={{ background: "var(--bg-subtle)" }}>
            <p className="font-semibold" style={{ color: "var(--text)" }}>Bước 2: Lấy Access Token</p>
            <p>Vào oa.zalo.me &gt; Ứng dụng &gt; Tạo ứng dụng &gt; Lấy Access Token từ API Explorer.</p>
          </div>
          <div className="p-3 rounded-lg space-y-2" style={{ background: "var(--bg-subtle)" }}>
            <p className="font-semibold" style={{ color: "var(--text)" }}>Bước 3: Cấu hình trong Cài đặt</p>
            <p>Vào trang Cài đặt &gt; điền Zalo Token và OA ID vào ô tương ứng.</p>
          </div>
          <p className="text-[10px] p-2 rounded" style={{ background: "var(--amber-light)", color: "var(--amber)" }}>
            Lưu ý: Zalo OA API hiện tại chủ yếu hỗ trợ gửi tin nhắn CS. Đăng bài lên feed OA cần quyền đặc biệt từ Zalo.
          </p>
        </div>
      </Card>
    </div>
  );
}
