"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Sparkle, SmileyWink, Clipboard, ArrowRight } from "@phosphor-icons/react";

const QUIZ_QUESTIONS = [
  { key: "after_wash", label: "Sau khi rửa mặt, da bạn cảm thấy?", options: ["Căng và khô", "Bình thường, thoải mái", "Bóng và nhờn", "Vừa khô vừa nhờn"] },
  { key: "by_noon", label: "Đến trưa, da bạn thường?", options: ["Vẫn khô, có thể bong tróc", "Bình thường", "Bóng dầu toàn mặt", "Chỉ bóng vùng chữ T"] },
  { key: "sensitivity", label: "Da bạn phản ứng với mỹ phẩm mới?", options: ["Thường bị đỏ/ngứa/rát", "Hiếm khi phản ứng", "Không bao giờ phản ứng", "Thỉnh thoảng có mụn"] },
  { key: "pores", label: "Lỗ chân lông của bạn?", options: ["Gần như không thấy", "Khá nhỏ", "Rõ ở vùng mũi", "To rõ khắp mặt"] },
  { key: "main_concern", label: "Vấn đề da chính bạn muốn cải thiện?", options: ["Khô, thiếu nước", "Mụn, lỗ chân lông to", "Nám, tàn nhang", "Nhăn, lão hoá", "Da không đều màu"] },
];

export function SkinAI() {
  const [tab, setTab] = useState<"analyze" | "quiz" | "recommend">("analyze");
  const [form, setForm] = useState({ symptoms: "", age: "", skinType: "", concerns: "" });
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>({});
  const [skinProfile, setSkinProfile] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");

  const analyze = async () => {
    if (!form.symptoms.trim()) return;
    setLoading(true); setResult("");
    try {
      const res = await fetch("/api/skin-ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "analyze-text", ...form }) });
      const data = await res.json();
      if (data.data) setResult(data.data.analysis);
    } finally { setLoading(false); }
  };

  const runQuiz = async () => {
    if (Object.keys(quizAnswers).length < QUIZ_QUESTIONS.length) {
      alert("Vui lòng trả lời tất cả câu hỏi");
      return;
    }
    setLoading(true); setResult("");
    try {
      const res = await fetch("/api/skin-ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "skin-quiz", answers: quizAnswers }) });
      const data = await res.json();
      if (data.data) { setResult(data.data.result); setSkinProfile(data.data.result.slice(0, 200)); }
    } finally { setLoading(false); }
  };

  const recommend = async () => {
    if (!skinProfile.trim()) return;
    setLoading(true); setResult("");
    try {
      const res = await fetch("/api/skin-ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "recommend-services", skinProfile }) });
      const data = await res.json();
      if (data.data) setResult(data.data.recommendation);
    } finally { setLoading(false); }
  };

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="grid grid-cols-3 gap-3">
        {[{ key: "analyze", label: "Phân tích da", icon: Sparkle }, { key: "quiz", label: "Kiểm tra da", icon: SmileyWink }, { key: "recommend", label: "Gợi ý dịch vụ", icon: Clipboard }].map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => { setTab(key as typeof tab); setResult(""); }} className="p-3 rounded-xl border-2 text-left transition-all" style={{ borderColor: tab === key ? "var(--accent)" : "var(--border)", background: tab === key ? "var(--accent-light)" : "var(--bg-card)" }}>
            <Icon size={16} style={{ color: tab === key ? "var(--accent)" : "var(--text-secondary)" }} weight="fill" />
            <p className="text-xs font-medium mt-1" style={{ color: tab === key ? "var(--accent)" : "var(--text-secondary)" }}>{label}</p>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {tab === "analyze" && (
          <Card>
            <CardHeader><CardTitle>Mô tả tình trạng da</CardTitle></CardHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Tuổi</label>
                  <input className="w-full text-xs rounded-lg px-3 py-2 border" style={{ borderColor: "var(--border)", background: "var(--bg-card)", color: "var(--text)" }} placeholder="VD: 28" value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} />
                </div>
                <Select label="Loại da (ước tính)" value={form.skinType} onChange={(e) => setForm({ ...form, skinType: e.target.value })}>
                  <option value="">-- Chọn --</option>
                  <option value="khô">Khô</option>
                  <option value="dầu">Dầu</option>
                  <option value="hỗn hợp">Hỗn hợp</option>
                  <option value="nhạy cảm">Nhạy cảm</option>
                  <option value="bình thường">Bình thường</option>
                </Select>
              </div>
              <Textarea label="Vấn đề da đang gặp phải *" rows={4} placeholder="VD: Da mặt bị nám hai bên gò má, thỉnh thoảng bị mụn đầu đen, lỗ chân lông to vùng mũi..." value={form.symptoms} onChange={(e) => setForm({ ...form, symptoms: e.target.value })} />
              <Textarea label="Mối quan tâm chính" rows={2} placeholder="VD: Muốn da sáng hơn, giảm nám..." value={form.concerns} onChange={(e) => setForm({ ...form, concerns: e.target.value })} />
              <Button onClick={analyze} loading={loading} className="w-full"><Sparkle size={13} weight="fill" /> Phân tích bằng AI</Button>
            </div>
          </Card>
        )}

        {tab === "quiz" && (
          <Card>
            <CardHeader><CardTitle>Bài kiểm tra loại da</CardTitle></CardHeader>
            <div className="space-y-4">
              {QUIZ_QUESTIONS.map((q) => (
                <div key={q.key}>
                  <p className="text-xs font-medium mb-2" style={{ color: "var(--text)" }}>{q.label}</p>
                  <div className="space-y-1.5">
                    {q.options.map((opt) => (
                      <button key={opt} onClick={() => setQuizAnswers({ ...quizAnswers, [q.key]: opt })} className="w-full text-left text-xs px-3 py-2 rounded-lg border transition-colors" style={{ borderColor: quizAnswers[q.key] === opt ? "var(--accent)" : "var(--border)", background: quizAnswers[q.key] === opt ? "var(--accent-light)" : "var(--bg-card)", color: quizAnswers[q.key] === opt ? "var(--accent)" : "var(--text-secondary)" }}>
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <Button onClick={runQuiz} loading={loading} className="w-full"><ArrowRight size={13} /> Xem kết quả</Button>
            </div>
          </Card>
        )}

        {tab === "recommend" && (
          <Card>
            <CardHeader><CardTitle>Gợi ý dịch vụ phù hợp</CardTitle></CardHeader>
            <div className="space-y-3">
              <Textarea label="Hồ sơ da khách hàng" rows={5} placeholder="Nhập hoặc dán kết quả từ phân tích da / kiểm tra da ở trên..." value={skinProfile} onChange={(e) => setSkinProfile(e.target.value)} hint="AI sẽ đối chiếu với danh sách dịch vụ hiện có để gợi ý phù hợp nhất" />
              <Button onClick={recommend} loading={loading} className="w-full"><Sparkle size={13} weight="fill" /> Gợi ý dịch vụ</Button>
            </div>
          </Card>
        )}

        {result && (
          <Card>
            <CardHeader><CardTitle>Kết quả phân tích</CardTitle></CardHeader>
            <div className="text-xs leading-relaxed whitespace-pre-line" style={{ color: "var(--text-secondary)" }}>{result}</div>
            {tab === "quiz" && (
              <Button size="sm" variant="secondary" className="mt-3 w-full" onClick={() => { setTab("recommend"); setSkinProfile(result.slice(0, 300)); setResult(""); }}>
                Xem gợi ý dịch vụ <ArrowRight size={12} />
              </Button>
            )}
            <p className="text-[10px] mt-3 p-2 rounded" style={{ background: "var(--amber-light)", color: "var(--amber)" }}>
              Lưu ý: Đây là tư vấn định hướng spa, không phải chẩn đoán y tế. Các vấn đề da nghiêm trọng cần gặp bác sĩ da liễu.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}
