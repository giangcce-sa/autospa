"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { Sparkle, Stack, Trash, CalendarBlank } from "@phosphor-icons/react";
import { formatDate } from "@/lib/utils";

interface BulkPost { id: string; caption: string; status: string; scheduledAt: string | null; }
interface Plan { id: string; name: string; month: number; year: number; posts: BulkPost[]; createdAt: string; }

const now = new Date();
const months = Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: `Tháng ${i + 1}` }));
const years = [now.getFullYear(), now.getFullYear() + 1];

export function BulkGenerator() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [form, setForm] = useState({ month: now.getMonth() + 1, year: now.getFullYear(), postsPerWeek: 3, tone: "friendly" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = () => fetch("/api/bulk").then((r) => r.json()).then((res) => res.data && setPlans(res.data));
  useEffect(() => { load(); }, []);

  const handleGenerate = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, postTypes: ["service", "tip", "promotion"] }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      load();
    } finally { setLoading(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Xóa kế hoạch này và tất cả bài viết?")) return;
    await fetch("/api/bulk", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    load();
  };

  return (
    <div className="space-y-4 max-w-4xl">
      <Card>
        <CardHeader><CardTitle>Tạo kế hoạch mới</CardTitle></CardHeader>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Select label="Tháng" value={form.month} onChange={(e) => setForm({ ...form, month: +e.target.value })}>
            {months.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </Select>
          <Select label="Năm" value={form.year} onChange={(e) => setForm({ ...form, year: +e.target.value })}>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </Select>
          <Select label="Bài/tuần" value={form.postsPerWeek} onChange={(e) => setForm({ ...form, postsPerWeek: +e.target.value })}>
            {[2, 3, 4, 5, 7].map((n) => <option key={n} value={n}>{n} bài</option>)}
          </Select>
          <Select label="Giọng văn" value={form.tone} onChange={(e) => setForm({ ...form, tone: e.target.value })}>
            <option value="friendly">Thân thiện</option>
            <option value="professional">Chuyên nghiệp</option>
            <option value="luxury">Sang trọng</option>
          </Select>
        </div>
        {error && <p className="text-xs mt-2 p-2 rounded" style={{ background: "var(--rose-light)", color: "var(--rose)" }}>{error}</p>}
        <Button onClick={handleGenerate} loading={loading} className="mt-3 w-full">
          <Sparkle size={14} weight="fill" /> Tạo kế hoạch tháng {form.month}/{form.year}
        </Button>
      </Card>

      {plans.length === 0 ? (
        <div className="text-center py-12" style={{ color: "var(--text-muted)" }}>
          <Stack size={36} className="mx-auto mb-2 opacity-20" />
          <p className="text-sm">Chưa có kế hoạch nào. Tạo kế hoạch đầu tiên!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {plans.map((plan) => {
            const published = plan.posts.filter((p) => p.status === "published").length;
            const scheduled = plan.posts.filter((p) => p.status === "scheduled").length;
            const draft = plan.posts.filter((p) => p.status === "draft").length;
            return (
              <Card key={plan.id}>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="font-semibold text-sm" style={{ color: "var(--text)" }}>{plan.name}</p>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>Tạo {formatDate(plan.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1.5 flex-wrap">
                      {published > 0 && <Badge variant="success">{published} đã đăng</Badge>}
                      {scheduled > 0 && <Badge variant="info">{scheduled} lên lịch</Badge>}
                      {draft > 0 && <Badge variant="neutral">{draft} nháp</Badge>}
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setExpanded(expanded === plan.id ? null : plan.id)}>
                      {expanded === plan.id ? "Thu gọn" : `Xem ${plan.posts.length} bài`}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(plan.id)} style={{ color: "var(--rose)" }}>
                      <Trash size={13} />
                    </Button>
                  </div>
                </div>

                {expanded === plan.id && (
                  <div className="space-y-1.5 max-h-80 overflow-y-auto">
                    {plan.posts.map((post) => (
                      <div key={post.id} className="flex items-start gap-3 p-2.5 rounded-lg" style={{ background: "var(--bg-subtle)" }}>
                        <StatusBadge status={post.status} />
                        <p className="text-xs flex-1 line-clamp-2" style={{ color: "var(--text-secondary)" }}>{post.caption}</p>
                        {post.scheduledAt && (
                          <span className="text-[10px] shrink-0 flex items-center gap-1" style={{ color: "var(--text-muted)" }}>
                            <CalendarBlank size={9} />{formatDate(post.scheduledAt)}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
