"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Textarea, Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Plus, Trash, Brain, Sparkle, ThumbsUp, ChatCircle, Share, FacebookLogo, MagnifyingGlass, CheckSquare, Square } from "@phosphor-icons/react";
import { useActivePage } from "@/contexts/ActivePageContext";

interface Sample { id: string; content: string; likes: number; comments: number; shares: number; platform: string; source: string; }

interface FbPost {
  id: string;
  message?: string;
  created_time: string;
  likes?: { summary: { total_count: number } };
  comments?: { summary: { total_count: number } };
  shares?: { count: number };
}

export function StyleTraining() {
  const { pages, selectedPageId, selectedPage } = useActivePage();
  const [samples, setSamples] = useState<Sample[]>([]);
  const [profile, setProfile] = useState<string | null>(null);
  const [form, setForm] = useState({ content: "", likes: "", comments: "", shares: "" });
  const [analyzing, setAnalyzing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"manual" | "facebook">("manual");

  // Facebook scan state
  const [scanSource, setScanSource] = useState<"own" | "competitor">("own");
  const [competitorPageId, setCompetitorPageId] = useState("");
  const [scanLimit, setScanLimit] = useState("20");
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<"permission" | "invalid" | "other" | null>(null);
  const [scanErrorMsg, setScanErrorMsg] = useState("");
  const [fetchedPosts, setFetchedPosts] = useState<FbPost[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [bulkImporting, setBulkImporting] = useState(false);
  const [fbMode, setFbMode] = useState<"api" | "paste">("api");

  const load = (pageId?: string) =>
    fetch(pageId ? `/api/style-training?facebookPageId=${pageId}` : "/api/style-training").then((r) => r.json()).then((res) => {
      if (res.data) { setSamples(res.data.samples ?? []); setProfile(res.data.profile?.profile ?? null); }
    });

  useEffect(() => {
    load(selectedPageId || undefined);
  }, [selectedPageId]);

  const handleAdd = async () => {
    if (!form.content.trim()) return;
    setAdding(true);
    try {
      await fetch("/api/style-training", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add-sample", content: form.content, likes: +form.likes || 0, comments: +form.comments || 0, shares: +form.shares || 0, facebookPageId: selectedPageId }),
      });
      setForm({ content: "", likes: "", comments: "", shares: "" });
      load(selectedPageId || undefined);
    } finally { setAdding(false); }
  };

  const handleAnalyze = async () => {
    setAnalyzing(true);
    setError("");
    try {
      const res = await fetch("/api/style-training", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "analyze", facebookPageId: selectedPageId }) });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setProfile(data.data.profile);
    } finally { setAnalyzing(false); }
  };

  const handleDelete = async (id: string) => {
    await fetch("/api/style-training", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    load(selectedPageId || undefined);
  };

  const handleScan = async () => {
    setScanning(true); setScanError(null); setScanErrorMsg(""); setFetchedPosts([]); setSelected(new Set());
    try {
      const res = await fetch("/api/style-training", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "fetch-fb",
          source: scanSource,
          facebookPageId: scanSource === "own" ? selectedPageId : undefined,
          pageId: scanSource === "competitor" ? competitorPageId.trim().replace(/.*facebook\.com\//i, "").replace(/\/$/, "") : undefined,
          limit: +scanLimit || 20,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        if (data.error === "TOKEN_PERMISSION") {
          setScanError("permission");
        } else if (data.error === "TOKEN_INVALID") {
          setScanError("invalid");
        } else {
          setScanError("other");
          setScanErrorMsg(data.error);
        }
        return;
      }
      setFetchedPosts(data.data.posts);
      if (data.data.posts.length === 0) { setScanError("other"); setScanErrorMsg("Không tìm thấy bài viết nào có nội dung text."); }
    } finally { setScanning(false); }
  };

  const handleBulkPaste = async () => {
    if (!bulkText.trim()) return;
    const separator = bulkText.includes("---") ? "---" : "\n\n\n";
    const parts = bulkText.split(separator).map((p) => p.trim()).filter((p) => p.length > 20);
    if (parts.length === 0) return;
    setBulkImporting(true);
    try {
      const res = await fetch("/api/style-training", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "import-fb",
          posts: parts.map((p) => ({ message: p, likes: 0, comments: 0, shares: 0 })),
          facebookPageId: selectedPageId,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setBulkText("");
        alert(`Đã import ${data.data.count} bài vào bộ mẫu!`);
        load(selectedPageId);
      }
    } finally { setBulkImporting(false); }
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  };

  const selectAll = () => setSelected(new Set(fetchedPosts.map((p) => p.id)));
  const selectNone = () => setSelected(new Set());

  const handleImport = async () => {
    const toImport = fetchedPosts.filter((p) => selected.has(p.id) && p.message);
    if (!toImport.length) return;
    setImporting(true);
    try {
      const res = await fetch("/api/style-training", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "import-fb",
          facebookPageId: selectedPageId,
          posts: toImport.map((p) => ({
            message: p.message!,
            likes: p.likes?.summary.total_count ?? 0,
            comments: p.comments?.summary.total_count ?? 0,
            shares: p.shares?.count ?? 0,
          })),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setFetchedPosts([]); setSelected(new Set());
        alert(`Đã import ${data.data.count} bài vào bộ mẫu!`);
        load(selectedPageId);
      }
    } finally { setImporting(false); }
  };

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-4">
          {/* Tab switcher */}
          <div className="flex gap-2">
            <Button size="sm" variant={tab === "manual" ? "primary" : "secondary"} onClick={() => setTab("manual")}>
              <Plus size={12} /> Nhập thủ công
            </Button>
            <Button size="sm" variant={tab === "facebook" ? "primary" : "secondary"} onClick={() => setTab("facebook")}>
              <FacebookLogo size={12} /> Quét Facebook
            </Button>
          </div>

          {tab === "manual" && (
            <Card>
              <CardHeader><CardTitle>Thêm bài mẫu</CardTitle></CardHeader>
              <div className="space-y-3">
                <Textarea
                  label="Nội dung bài viết"
                  placeholder="Paste bài viết Facebook của bạn vào đây..."
                  rows={5}
                  value={form.content}
                  onChange={(e) => setForm({ ...form, content: e.target.value })}
                />
                <div className="grid grid-cols-3 gap-2">
                  <Input label="Like" type="number" placeholder="0" value={form.likes} onChange={(e) => setForm({ ...form, likes: e.target.value })} />
                  <Input label="Comment" type="number" placeholder="0" value={form.comments} onChange={(e) => setForm({ ...form, comments: e.target.value })} />
                  <Input label="Share" type="number" placeholder="0" value={form.shares} onChange={(e) => setForm({ ...form, shares: e.target.value })} />
                </div>
                <Button onClick={handleAdd} loading={adding} className="w-full">
                  <Plus size={14} /> Thêm bài mẫu
                </Button>
              </div>
            </Card>
          )}

          {tab === "facebook" && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <FacebookLogo size={15} style={{ color: "#1877F2" }} />
                  <CardTitle>Quét bài từ Facebook</CardTitle>
                </div>
              </CardHeader>

              <div className="flex gap-2 mb-3">
                {(["api", "paste"] as const).map((m) => (
                  <button key={m} onClick={() => { setFbMode(m); setScanError(null); }}
                    className="py-1.5 px-3 rounded-lg border text-xs font-medium transition-all"
                    style={{ borderColor: fbMode === m ? "var(--accent)" : "var(--border)", background: fbMode === m ? "var(--accent-light)" : "transparent", color: fbMode === m ? "var(--accent)" : "var(--text-secondary)" }}>
                    {m === "api" ? "🔗 Tự động qua API" : "📋 Paste thủ công"}
                  </button>
                ))}
              </div>

              {fbMode === "api" && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  {(["own", "competitor"] as const).map((s) => (
                    <button key={s} onClick={() => { setScanSource(s); setFetchedPosts([]); setScanError(null); }}
                      className="py-2 px-3 rounded-lg border-2 text-xs font-medium transition-all"
                      style={{ borderColor: scanSource === s ? "var(--accent)" : "var(--border)", background: scanSource === s ? "var(--accent-light)" : "var(--bg-card)", color: scanSource === s ? "var(--accent)" : "var(--text-secondary)" }}>
                      {s === "own" ? "🏠 Trang của tôi" : "🔍 Trang đối thủ"}
                    </button>
                  ))}
                </div>

                {scanSource === "own" && (
                  <div className="p-2.5 rounded-lg text-xs space-y-1" style={{ background: selectedPage ? "var(--accent-light)" : "var(--rose-light)", border: `1px solid ${selectedPage ? "var(--accent)" : "var(--rose)"}` }}>
                    {selectedPage ? (
                      <>
                        <p style={{ color: "var(--accent)" }}>✓ Đang dùng token của trang: {selectedPage.pageName}</p>
                        <p style={{ color: "var(--text-muted)" }}>Token từ Graph API Explorer chỉ có hiệu lực ~1 giờ. Nếu bị lỗi, vào Cài đặt → Facebook Page → cập nhật token.</p>
                      </>
                    ) : (
                      <p style={{ color: "var(--rose)" }}>Chưa cấu hình Facebook Page. Vào <strong>Cài đặt → Facebook Page</strong> để thêm.</p>
                    )}
                  </div>
                )}
                {scanSource === "competitor" && (
                  <Input
                    label="Page ID hoặc URL Facebook"
                    placeholder="VD: spaabc hoặc https://facebook.com/spaabc"
                    value={competitorPageId}
                    onChange={(e) => setCompetitorPageId(e.target.value)}
                    hint="Chỉ hoạt động nếu token có quyền Page Public Content Access."
                  />
                )}

                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Số bài quét</label>
                  <select value={scanLimit} onChange={(e) => setScanLimit(e.target.value)}
                    className="w-full text-xs rounded-lg px-3 py-2 border"
                    style={{ borderColor: "var(--border)", background: "var(--bg-card)", color: "var(--text)" }}>
                    <option value="10">10 bài</option>
                    <option value="20">20 bài</option>
                    <option value="50">50 bài</option>
                    <option value="100">100 bài</option>
                  </select>
                </div>

                <Button onClick={handleScan} loading={scanning} className="w-full">
                  <MagnifyingGlass size={13} weight="fill" /> Bắt đầu quét
                </Button>

                {scanError === "permission" && (
                  <div className="rounded-lg overflow-hidden text-xs" style={{ border: "1px solid var(--amber)", background: "var(--amber-light)" }}>
                    <div className="px-3 py-2 font-medium" style={{ color: "var(--amber)" }}>Token thiếu quyền <code>pages_read_engagement</code></div>
                    <div className="px-3 pb-3 space-y-2" style={{ color: "var(--text-secondary)" }}>
                      <p>Lấy token đúng quyền theo các bước:</p>
                      <ol className="list-decimal list-inside space-y-1">
                        <li>Vào <strong>developers.facebook.com</strong> → Graph API Explorer</li>
                        <li>Chọn App → chọn <strong>Page Access Token</strong> của trang bạn</li>
                        <li>Thêm permission: <code className="px-1 rounded" style={{ background: "var(--bg-subtle)" }}>pages_read_engagement</code></li>
                        <li>Generate token → copy vào Cài đặt → thử lại</li>
                      </ol>
                      <button onClick={() => setFbMode("paste")} className="mt-1 underline" style={{ color: "var(--accent)" }}>Hoặc dùng Paste thủ công →</button>
                    </div>
                  </div>
                )}
                {scanError === "invalid" && (
                  <div className="rounded-lg overflow-hidden text-xs" style={{ border: "1px solid var(--rose)", background: "var(--rose-light)" }}>
                    <div className="px-3 py-2 font-medium" style={{ color: "var(--rose)" }}>Token không hợp lệ hoặc đã hết hạn</div>
                    <div className="px-3 pb-3 space-y-2" style={{ color: "var(--text-secondary)" }}>
                      <ol className="list-decimal list-inside space-y-1">
                        <li>Vào <strong>developers.facebook.com/tools/explorer</strong></li>
                        <li>Chọn <strong>Page Access Token</strong> — chọn đúng trang</li>
                        <li>Tick <code className="px-1 rounded" style={{ background: "var(--bg-card)" }}>pages_read_engagement</code> → Generate</li>
                        <li>Copy token → vào <strong>Cài đặt → Facebook Page</strong> → paste → Lưu</li>
                      </ol>
                      <button onClick={() => setFbMode("paste")} className="underline" style={{ color: "var(--accent)" }}>Hoặc dùng Paste thủ công →</button>
                    </div>
                  </div>
                )}
                {scanError === "other" && (
                  <div className="p-2 rounded-lg text-xs" style={{ background: "var(--rose-light)", color: "var(--rose)" }}>{scanErrorMsg}</div>
                )}
              </div>
              )}

              {fbMode === "paste" && (
              <div className="space-y-3">
                <div className="p-2.5 rounded-lg text-xs" style={{ background: "var(--bg-subtle)", color: "var(--text-secondary)" }}>
                  <p className="font-medium mb-1" style={{ color: "var(--text)" }}>Cách dùng:</p>
                  <ol className="list-decimal list-inside space-y-1">
                    <li>Vào Facebook → mở từng bài viết → copy nội dung</li>
                    <li>Paste vào ô dưới, mỗi bài cách nhau bằng <code className="px-1 rounded" style={{ background: "var(--bg-card)" }}>---</code></li>
                    <li>Nhấn Import — có thể paste nhiều bài cùng lúc</li>
                  </ol>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Nội dung bài viết (nhiều bài, phân cách bằng ---)</label>
                  <textarea
                    rows={10}
                    placeholder={"Bài 1: Hôm nay spa mình có chương trình...\n\n---\n\nBài 2: Chăm sóc da đúng cách mùa hè..."}
                    value={bulkText}
                    onChange={(e) => setBulkText(e.target.value)}
                    className="w-full text-xs rounded-lg px-3 py-2 border resize-none"
                    style={{ borderColor: "var(--border)", background: "var(--bg-card)", color: "var(--text)" }}
                  />
                  <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>
                    {bulkText.includes("---")
                      ? `Phát hiện ${bulkText.split("---").filter((p) => p.trim().length > 20).length} bài`
                      : "Chưa có dấu --- phân cách hoặc chỉ có 1 bài"}
                  </p>
                </div>
                <Button onClick={handleBulkPaste} loading={bulkImporting} disabled={!bulkText.trim()} className="w-full">
                  <Plus size={13} /> Import tất cả bài
                </Button>
              </div>
              )}

              {fetchedPosts.length > 0 && (
                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium" style={{ color: "var(--text)" }}>Tìm thấy {fetchedPosts.length} bài — đã chọn {selected.size}</p>
                    <div className="flex gap-1">
                      <Button size="sm" variant="secondary" onClick={selectAll}>Chọn tất</Button>
                      <Button size="sm" variant="secondary" onClick={selectNone}>Bỏ chọn</Button>
                    </div>
                  </div>
                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {fetchedPosts.map((p) => (
                      <div key={p.id} onClick={() => toggleSelect(p.id)}
                        className="flex items-start gap-2 p-2.5 rounded-lg cursor-pointer transition-colors"
                        style={{ background: selected.has(p.id) ? "var(--accent-light)" : "var(--bg-subtle)", border: `1px solid ${selected.has(p.id) ? "var(--accent)" : "transparent"}` }}>
                        <div className="mt-0.5 shrink-0" style={{ color: selected.has(p.id) ? "var(--accent)" : "var(--text-muted)" }}>
                          {selected.has(p.id) ? <CheckSquare size={14} weight="fill" /> : <Square size={14} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs line-clamp-2" style={{ color: "var(--text)" }}>{p.message}</p>
                          <div className="flex gap-3 mt-1 text-[10px]" style={{ color: "var(--text-muted)" }}>
                            <span>{p.likes?.summary.total_count ?? 0} likes</span>
                            <span>{p.comments?.summary.total_count ?? 0} cmt</span>
                            <span>{p.shares?.count ?? 0} share</span>
                            <span>{new Date(p.created_time).toLocaleDateString("vi-VN")}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <Button onClick={handleImport} loading={importing} disabled={selected.size === 0} className="w-full">
                    <Plus size={13} /> Import {selected.size} bài đã chọn vào bộ mẫu
                  </Button>
                </div>
              )}
            </Card>
          )}

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Brain size={14} style={{ color: "var(--accent)" }} />
                <CardTitle>Bài mẫu ({samples.length})</CardTitle>
              </div>
              {samples.length >= 3 && (
                <Button size="sm" onClick={handleAnalyze} loading={analyzing}>
                  <Sparkle size={12} /> Phân tích
                </Button>
              )}
            </CardHeader>
            {samples.length < 3 && (
              <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>Cần ít nhất 3 bài mẫu để phân tích văn phong</p>
            )}
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {samples.map((s) => (
                <div key={s.id} className="p-3 rounded-lg" style={{ background: "var(--bg-subtle)" }}>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    {s.source === "facebook"
                      ? <FacebookLogo size={10} style={{ color: "#1877F2" }} />
                      : <Plus size={10} style={{ color: "var(--text-muted)" }} />}
                    <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{s.source === "facebook" ? "Facebook" : "Thủ công"}</span>
                  </div>
                  <p className="text-xs mb-2 line-clamp-3" style={{ color: "var(--text)" }}>{s.content}</p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 text-xs" style={{ color: "var(--text-muted)" }}>
                      <span className="flex items-center gap-1"><ThumbsUp size={10} />{s.likes}</span>
                      <span className="flex items-center gap-1"><ChatCircle size={10} />{s.comments}</span>
                      <span className="flex items-center gap-1"><Share size={10} />{s.shares}</span>
                    </div>
                    <button onClick={() => handleDelete(s.id)} style={{ color: "var(--rose)" }}><Trash size={12} /></button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Sparkle size={14} style={{ color: "var(--accent)" }} />
              <CardTitle>Hồ sơ văn phong</CardTitle>
            </div>
            {profile && <Badge variant="success">Đã phân tích</Badge>}
          </CardHeader>
          {error && <p className="text-xs mb-3 p-2 rounded" style={{ background: "var(--rose-light)", color: "var(--rose)" }}>{error}</p>}
          {profile ? (
            <div className="p-3 rounded-lg text-xs leading-relaxed whitespace-pre-wrap" style={{ background: "var(--bg-subtle)", color: "var(--text-secondary)" }}>
              {profile}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Brain size={32} className="mb-2 opacity-20" style={{ color: "var(--text-secondary)" }} />
              <p className="text-sm font-medium" style={{ color: "var(--text)" }}>Chưa có hồ sơ văn phong</p>
              <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Thêm ít nhất 3 bài mẫu rồi nhấn Phân tích</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
