"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import { CheckCircle, XCircle, Warning, Sparkle } from "@phosphor-icons/react";

interface CheckItem { label: string; pass: boolean; note: string; }
interface QualityResult { score: number; checks: CheckItem[]; suggestions: string[]; summary: string; }

export function QualityChecker() {
  const [caption, setCaption] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [result, setResult] = useState<QualityResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleCheck = async () => {
    if (!caption.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/quality", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caption, hashtags }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setResult(data.data);
    } finally { setLoading(false); }
  };

  const scoreColor = result
    ? result.score >= 80 ? "var(--accent)" : result.score >= 60 ? "var(--amber)" : "var(--rose)"
    : "var(--text-muted)";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 max-w-5xl">
      <Card>
        <CardHeader><CardTitle>Nội dung cần kiểm tra</CardTitle></CardHeader>
        <div className="space-y-3">
          <Textarea
            label="Caption"
            placeholder="Paste nội dung bài viết vào đây..."
            rows={8}
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
          />
          <Textarea
            label="Hashtags (tùy chọn)"
            placeholder="#spa #lamdep ..."
            rows={2}
            value={hashtags}
            onChange={(e) => setHashtags(e.target.value)}
          />
          {error && <p className="text-xs p-2 rounded" style={{ background: "var(--rose-light)", color: "var(--rose)" }}>{error}</p>}
          <Button onClick={handleCheck} loading={loading} className="w-full">
            <Sparkle size={14} weight="fill" /> Kiểm tra chất lượng
          </Button>
        </div>
      </Card>

      <div className="space-y-3">
        {result ? (
          <>
            <Card>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs" style={{ color: "var(--text-secondary)" }}>Điểm chất lượng</p>
                  <p className="text-3xl font-bold" style={{ color: scoreColor }}>{result.score}<span className="text-sm font-normal" style={{ color: "var(--text-muted)" }}>/100</span></p>
                </div>
                <div className="w-16 h-16 rounded-full border-4 flex items-center justify-center" style={{ borderColor: scoreColor }}>
                  {result.score >= 80 ? <CheckCircle size={24} weight="fill" color={scoreColor} /> : result.score >= 60 ? <Warning size={24} weight="fill" color={scoreColor} /> : <XCircle size={24} weight="fill" color={scoreColor} />}
                </div>
              </div>
              <p className="text-xs mt-2" style={{ color: "var(--text-secondary)" }}>{result.summary}</p>
            </Card>

            <Card>
              <CardHeader><CardTitle>Chi tiết kiểm tra</CardTitle></CardHeader>
              <div className="space-y-2">
                {result.checks.map((check, i) => (
                  <div key={i} className="flex items-start gap-2">
                    {check.pass
                      ? <CheckCircle size={14} className="shrink-0 mt-0.5" weight="fill" color="var(--accent)" />
                      : <XCircle size={14} className="shrink-0 mt-0.5" weight="fill" color="var(--rose)" />}
                    <div>
                      <span className="text-xs font-medium" style={{ color: "var(--text)" }}>{check.label}</span>
                      {check.note && <p className="text-xs" style={{ color: "var(--text-muted)" }}>{check.note}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {result.suggestions.length > 0 && (
              <Card>
                <CardHeader><CardTitle>Gợi ý cải thiện</CardTitle></CardHeader>
                <ul className="space-y-1.5">
                  {result.suggestions.map((s, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
                      <span className="font-bold shrink-0" style={{ color: "var(--accent)" }}>{i + 1}.</span>
                      {s}
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </>
        ) : (
          <Card className="h-full min-h-[200px]">
            <div className="flex flex-col items-center justify-center h-full py-12 text-center">
              <CheckCircle size={32} className="mb-2 opacity-20" style={{ color: "var(--text-secondary)" }} />
              <p className="text-sm font-medium" style={{ color: "var(--text)" }}>Kết quả kiểm tra</p>
              <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Nhập nội dung và nhấn Kiểm tra</p>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
