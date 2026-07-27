"use client";

import { useEffect, useState } from "react";
import { CheckCircle, Lightbulb, ListChecks, Sparkle, Warning, XCircle } from "@phosphor-icons/react";
import { useActivePage } from "@/contexts/ActivePageContext";

interface CheckItem { label: string; pass: boolean; note: string; }
interface QualityResult { score: number; checks: CheckItem[]; suggestions: string[]; summary: string; }

/** Bands match the library's score colouring so one number reads the same everywhere. */
function band(score: number) {
  if (score >= 80) return { color: "var(--green)", light: "var(--green-light)", Icon: CheckCircle, text: "Đạt" };
  if (score >= 60) return { color: "var(--amber)", light: "var(--amber-light)", Icon: Warning, text: "Cần xem lại" };
  return { color: "var(--danger)", light: "var(--danger-light)", Icon: XCircle, text: "Nên sửa trước khi đăng" };
}

const fieldClass =
  "w-full resize-y rounded-[9px] border border-[var(--border-strong)] bg-[var(--bg)] px-3 py-2.5 text-[13.5px] leading-relaxed text-[var(--text)] outline-none transition-colors placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--brand-ring)]";

export function QualityChecker({
  facebookPageId: providedPageId,
  postId,
  initialCaption = "",
  initialHashtags = "",
}: {
  facebookPageId?: string;
  postId?: string;
  initialCaption?: string;
  initialHashtags?: string;
} = {}) {
  const { selectedPageId } = useActivePage();
  const facebookPageId = providedPageId ?? selectedPageId ?? undefined;
  const [caption, setCaption] = useState(initialCaption);
  const [hashtags, setHashtags] = useState(initialHashtags);
  const [result, setResult] = useState<QualityResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setCaption(initialCaption);
    setHashtags(initialHashtags);
    setResult(null);
    setError("");
  }, [facebookPageId, initialCaption, initialHashtags, postId]);

  const handleCheck = async () => {
    if (!caption.trim() || !facebookPageId) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/quality", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caption, hashtags, postId, facebookPageId }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Không kiểm tra được nội dung");
        return;
      }
      setResult(data.data);
    } catch {
      setError("Không kiểm tra được nội dung");
    } finally {
      setLoading(false);
    }
  };

  const failed = result?.checks.filter((check) => !check.pass).length ?? 0;

  return (
    <div className="grid max-w-6xl items-start gap-4 lg:grid-cols-2">
      <section className="rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--bg-card)] p-5 shadow-[var(--shadow-sm)]">
        <h2 className="text-[16px] font-extrabold tracking-tight">Nội dung cần kiểm tra</h2>
        <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--text-secondary)]">
          Kiểm tra trước khi đăng: từ ngữ phóng đại, ngôn ngữ y tế, ảnh trước/sau và độ dài theo từng kênh.
        </p>

        <div className="mt-4 space-y-3">
          <label className="block space-y-1.5">
            <span className="text-[12px] font-bold text-[var(--text-secondary)]">Caption</span>
            <textarea
              rows={10}
              placeholder="Dán nội dung bài viết vào đây…"
              value={caption}
              onChange={(event) => setCaption(event.target.value)}
              className={fieldClass}
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-[12px] font-bold text-[var(--text-secondary)]">Hashtags (tùy chọn)</span>
            <textarea
              rows={2}
              placeholder="#spa #chamsocda"
              value={hashtags}
              onChange={(event) => setHashtags(event.target.value)}
              className={`${fieldClass} text-[13px] text-[var(--accent)]`}
            />
          </label>
        </div>

        {error && (
          <p role="alert" className="mt-3 rounded-[9px] bg-[var(--danger-light)] px-3 py-2 text-[12.5px] font-semibold text-[var(--danger)]">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={handleCheck}
          disabled={loading || !caption.trim() || !facebookPageId}
          aria-busy={loading}
          className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-[9px] bg-[var(--accent)] px-4 text-[13px] font-bold text-[var(--accent-foreground)] transition-colors hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Sparkle size={16} weight="fill" aria-hidden="true" />
          {loading ? "Đang kiểm tra…" : "Kiểm tra chất lượng"}
        </button>
      </section>

      <div className="space-y-4">
        {result ? (
          <>
            <section className="rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--bg-card)] p-5 shadow-[var(--shadow-sm)]">
              <ScorePanel score={result.score} summary={result.summary} failed={failed} total={result.checks.length} />
            </section>

            <section className="rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--bg-card)] p-[18px] shadow-[var(--shadow-sm)]">
              <h3 className="flex items-center gap-2 text-[14px] font-bold">
                <ListChecks size={15} weight="bold" className="text-[var(--text-muted)]" aria-hidden="true" />
                Chi tiết kiểm tra
              </h3>
              <ul className="mt-2.5 space-y-2">
                {result.checks.map((check, index) => (
                  <li key={`${index}-${check.label}`} className="flex items-start gap-2">
                    {check.pass ? (
                      <CheckCircle size={15} weight="fill" className="mt-px shrink-0 text-[var(--green)]" aria-hidden="true" />
                    ) : (
                      <XCircle size={15} weight="fill" className="mt-px shrink-0 text-[var(--danger)]" aria-hidden="true" />
                    )}
                    <div className="min-w-0">
                      <p className={`text-[12.5px] font-semibold ${check.pass ? "text-[var(--text-secondary)]" : "text-[var(--text)]"}`}>
                        {check.label}
                      </p>
                      {check.note && <p className="mt-0.5 text-[11.5px] leading-relaxed text-[var(--text-muted)]">{check.note}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            {result.suggestions.length > 0 && (
              <section className="rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--bg-card)] p-[18px] shadow-[var(--shadow-sm)]">
                <h3 className="flex items-center gap-2 text-[14px] font-bold">
                  <Lightbulb size={15} weight="bold" className="text-[var(--accent)]" aria-hidden="true" />
                  Gợi ý cải thiện
                </h3>
                <ol className="mt-2.5 space-y-2">
                  {result.suggestions.map((suggestion, index) => (
                    <li key={`${index}-${suggestion}`} className="flex gap-2.5 text-[12.5px] leading-relaxed text-[var(--text-secondary)]">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--accent-light)] text-[11px] font-bold text-[var(--accent)]">
                        {index + 1}
                      </span>
                      <span>{suggestion}</span>
                    </li>
                  ))}
                </ol>
              </section>
            )}
          </>
        ) : (
          <section className="flex min-h-[16rem] flex-col items-center justify-center gap-2 rounded-[var(--radius-xl)] border border-dashed border-[var(--border-strong)] bg-[var(--bg-card)] p-8 text-center">
            <ListChecks size={28} className="text-[var(--text-muted)]" aria-hidden="true" />
            <p className="text-[13.5px] font-semibold">Kết quả kiểm tra</p>
            <p className="max-w-xs text-[12.5px] text-[var(--text-muted)]">
              Nhập caption rồi nhấn “Kiểm tra chất lượng”. Kết quả gồm điểm, từng mục kiểm tra và gợi ý sửa.
            </p>
          </section>
        )}
      </div>
    </div>
  );
}

function ScorePanel({ score, summary, failed, total }: { score: number; summary: string; failed: number; total: number }) {
  const { color, light, Icon, text } = band(score);
  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11.5px] text-[var(--text-muted)]">Điểm chất lượng</p>
          <p className="mt-0.5 flex items-baseline gap-1">
            <span className="text-[34px] font-extrabold leading-none tabular-nums tracking-tight" style={{ color }}>
              {score}
            </span>
            <span className="text-[13px] text-[var(--text-muted)]">/100</span>
          </p>
          <p className="mt-1.5 text-[12px] font-bold" style={{ color }}>{text}</p>
        </div>
        <span
          className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full"
          style={{ background: light, color }}
        >
          <Icon size={26} weight="fill" aria-hidden="true" />
        </span>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--bg-subtle)]">
        <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.max(0, score))}%`, background: color }} />
      </div>
      <p className="mt-3 text-[12.5px] leading-relaxed text-[var(--text-secondary)]">{summary}</p>
      <p className="mt-2 text-[11.5px] tabular-nums text-[var(--text-muted)]">
        {failed === 0 ? `Cả ${total} mục kiểm tra đều đạt.` : `${failed}/${total} mục chưa đạt.`}
      </p>
    </>
  );
}
