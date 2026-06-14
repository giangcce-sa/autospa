"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Megaphone, CheckCircle, Image as ImageIcon, CaretDown } from "@phosphor-icons/react";

interface DraftPost {
  id: string;
  caption: string;
  hashtags: string | null;
  imageUrl: string | null;
  service?: { name: string } | null;
  createdAt: string;
}

interface Props {
  facebookPageId?: string;
  initialPostId?: string;
}

export function CreateAd({ facebookPageId, initialPostId }: Props) {
  const [posts, setPosts] = useState<DraftPost[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [selectedPost, setSelectedPost] = useState<DraftPost | null>(null);

  const [name, setName] = useState("");
  const [ageMin, setAgeMin] = useState(18);
  const [ageMax, setAgeMax] = useState(55);
  const [gender, setGender] = useState<"all" | "male" | "female">("all");
  const [budgetVnd, setBudgetVnd] = useState("100000");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [objective, setObjective] = useState("OUTCOME_AWARENESS");

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ campaignId: string; adId: string } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/content/list")
      .then((r) => r.json())
      .then((res) => {
        const list: DraftPost[] = res.data ?? [];
        setPosts(list);
        if (initialPostId) {
          const found = list.find((p) => p.id === initialPostId);
          if (found) pickPost(found);
        }
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPostId]);

  const pickPost = (post: DraftPost) => {
    setSelectedPost(post);
    setShowPicker(false);
    const today = new Date().toISOString().slice(0, 10);
    const svcName = post.service?.name ?? "Dịch vụ";
    setName(`${svcName} · ${today}`);
  };

  const genderIds = () => {
    if (gender === "male") return [1];
    if (gender === "female") return [2];
    return [];
  };

  const handleCreate = async () => {
    if (!selectedPost) return;
    setLoading(true);
    setError("");
    setResult(null);
    const message = [selectedPost.caption, selectedPost.hashtags].filter(Boolean).join("\n\n");
    try {
      const res = await fetch("/api/facebook-ads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          facebookPageId,
          postId: selectedPost.id,
          name: name || `Quảng cáo · ${new Date().toLocaleDateString("vi-VN")}`,
          message,
          imageUrl: selectedPost.imageUrl || undefined,
          targetAgeMin: ageMin,
          targetAgeMax: ageMax,
          targetGenders: genderIds(),
          targetCountry: "VN",
          dailyBudgetVnd: Number(budgetVnd.replace(/\D/g, "")) || 100000,
          startTime: startDate ? new Date(startDate).toISOString() : undefined,
          endTime: endDate ? new Date(endDate).toISOString() : undefined,
          objective,
        }),
      });
      const data = await res.json();
      if (!data.success) { setError(data.error); return; }
      setResult(data.data);
    } finally { setLoading(false); }
  };

  return (
    <div className="space-y-4 max-w-2xl">
      {/* Post picker */}
      <Card>
        <CardHeader>
          <CardTitle>Chọn nội dung</CardTitle>
          <Button size="sm" variant="secondary" onClick={() => setShowPicker((p) => !p)}>
            Chọn bài <CaretDown size={11} />
          </Button>
        </CardHeader>

        {showPicker && (
          <div className="space-y-1.5 max-h-52 overflow-y-auto mb-3">
            {posts.length === 0 && (
              <p className="text-xs py-2" style={{ color: "var(--text-muted)" }}>Chưa có bài nháp. Tạo nội dung AI trước.</p>
            )}
            {posts.map((p) => (
              <button
                key={p.id}
                onClick={() => pickPost(p)}
                className="w-full text-left p-2.5 rounded-lg hover:opacity-80 transition-opacity"
                style={{ background: "var(--bg-subtle)" }}
              >
                <p className="text-xs font-medium line-clamp-1" style={{ color: "var(--text)" }}>{p.caption || "(Không có caption)"}</p>
                <div className="flex gap-2 mt-0.5 text-[10px]" style={{ color: "var(--text-muted)" }}>
                  {p.service?.name && <span>{p.service.name}</span>}
                  <span>{new Date(p.createdAt).toLocaleDateString("vi-VN")}</span>
                </div>
              </button>
            ))}
          </div>
        )}

        {selectedPost ? (
          <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--border)" }}>
            {selectedPost.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={selectedPost.imageUrl} alt="" className="w-full object-cover" style={{ maxHeight: 180 }}
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
            ) : (
              <div className="py-6 flex flex-col items-center gap-1" style={{ background: "var(--bg-subtle)", color: "var(--text-muted)" }}>
                <ImageIcon size={24} className="opacity-30" />
                <span className="text-xs">Không có hình</span>
              </div>
            )}
            <div className="p-3">
              <p className="text-xs leading-relaxed line-clamp-3" style={{ color: "var(--text)" }}>{selectedPost.caption}</p>
              {selectedPost.hashtags && (
                <p className="text-xs mt-1" style={{ color: "var(--accent)" }}>{selectedPost.hashtags}</p>
              )}
            </div>
          </div>
        ) : (
          <p className="text-xs py-2" style={{ color: "var(--text-muted)" }}>Chọn bài viết để tạo quảng cáo từ nội dung đã có.</p>
        )}
      </Card>

      {/* Campaign settings */}
      <Card>
        <CardHeader><CardTitle>Cài đặt chiến dịch</CardTitle></CardHeader>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Tên chiến dịch</label>
            <input
              className="w-full px-3 py-2 text-sm rounded-lg border outline-none"
              style={{ background: "var(--bg-card)", borderColor: "var(--border)", color: "var(--text)" }}
              placeholder="VD: Chăm sóc da · Tháng 6"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Mục tiêu chiến dịch</label>
            <select
              className="w-full px-3 py-2 text-sm rounded-lg border outline-none"
              style={{ background: "var(--bg-card)", borderColor: "var(--border)", color: "var(--text)" }}
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
            >
              <option value="OUTCOME_AWARENESS">Nhận thức (Awareness)</option>
              <option value="OUTCOME_TRAFFIC">Lưu lượng (Traffic)</option>
              <option value="OUTCOME_ENGAGEMENT">Tương tác (Engagement)</option>
              <option value="OUTCOME_LEADS">Khách tiềm năng (Leads)</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Audience */}
      <Card>
        <CardHeader><CardTitle>Đối tượng</CardTitle></CardHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Tuổi tối thiểu</label>
              <input
                type="number" min={13} max={65}
                className="w-full px-3 py-2 text-sm rounded-lg border outline-none"
                style={{ background: "var(--bg-card)", borderColor: "var(--border)", color: "var(--text)" }}
                value={ageMin}
                onChange={(e) => setAgeMin(Number(e.target.value))}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Tuổi tối đa</label>
              <input
                type="number" min={13} max={65}
                className="w-full px-3 py-2 text-sm rounded-lg border outline-none"
                style={{ background: "var(--bg-card)", borderColor: "var(--border)", color: "var(--text)" }}
                value={ageMax}
                onChange={(e) => setAgeMax(Number(e.target.value))}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Giới tính</label>
            <div className="flex gap-2">
              {(["all", "female", "male"] as const).map((g) => (
                <button
                  key={g}
                  onClick={() => setGender(g)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium border transition-all"
                  style={{
                    borderColor: gender === g ? "var(--accent)" : "var(--border)",
                    background: gender === g ? "var(--accent-light)" : "var(--bg-card)",
                    color: gender === g ? "var(--accent)" : "var(--text-secondary)",
                  }}
                >
                  {g === "all" ? "Tất cả" : g === "female" ? "Nữ" : "Nam"}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* Budget */}
      <Card>
        <CardHeader><CardTitle>Ngân sách & Thời gian</CardTitle></CardHeader>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Ngân sách hàng ngày (VND)</label>
            <input
              className="w-full px-3 py-2 text-sm rounded-lg border outline-none"
              style={{ background: "var(--bg-card)", borderColor: "var(--border)", color: "var(--text)" }}
              placeholder="100000"
              value={budgetVnd}
              onChange={(e) => setBudgetVnd(e.target.value)}
            />
            <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>
              Tương đương {Number(budgetVnd.replace(/\D/g, "") || 0).toLocaleString("vi-VN")}đ/ngày
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Ngày bắt đầu (tùy chọn)</label>
              <input
                type="date"
                className="w-full px-3 py-2 text-sm rounded-lg border outline-none"
                style={{ background: "var(--bg-card)", borderColor: "var(--border)", color: "var(--text)" }}
                value={startDate}
                min={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Ngày kết thúc (tùy chọn)</label>
              <input
                type="date"
                className="w-full px-3 py-2 text-sm rounded-lg border outline-none"
                style={{ background: "var(--bg-card)", borderColor: "var(--border)", color: "var(--text)" }}
                value={endDate}
                min={startDate || new Date().toISOString().slice(0, 10)}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
        </div>
      </Card>

      {error && (
        <p className="text-xs p-3 rounded-lg" style={{ background: "var(--rose-light)", color: "var(--rose)" }}>{error}</p>
      )}

      {result && (
        <div className="flex items-start gap-2 p-3 rounded-lg" style={{ background: "var(--accent-light)" }}>
          <CheckCircle size={16} weight="fill" className="shrink-0 mt-0.5" style={{ color: "var(--accent)" }} />
          <div className="text-xs" style={{ color: "var(--accent)" }}>
            <p className="font-medium">Tạo chiến dịch thành công!</p>
            <p className="font-mono mt-0.5 opacity-80">Campaign: {result.campaignId} · Ad: {result.adId}</p>
            <p className="mt-1" style={{ color: "var(--text-muted)" }}>Kiểm tra trên Facebook Ads Manager để theo dõi hiệu suất.</p>
          </div>
        </div>
      )}

      <Button
        onClick={handleCreate}
        loading={loading}
        disabled={!selectedPost}
        className="w-full"
        size="lg"
      >
        <Megaphone size={16} weight="fill" /> Chạy quảng cáo
      </Button>
    </div>
  );
}
