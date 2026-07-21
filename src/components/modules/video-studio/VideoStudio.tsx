"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowClockwise, ArrowDown, ArrowUp, Brain, Check, CheckCircle, CloudArrowUp, FilmSlate, Gear, ImageSquare,
  MagicWand, Microphone, PaperPlaneTilt, Play, Plus, Sparkle, Spinner,
  Subtitles, UserCircle, VideoCamera, WarningCircle, Waveform, X,
} from "@phosphor-icons/react";
import { useActivePage } from "@/contexts/ActivePageContext";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";

type Tab = "projects" | "learning" | "voices" | "settings";
type ApiResult<T> = { success: boolean; data: T; error?: string };
type Staff = { id: string; name: string; role?: string; referenceImageUrl?: string; consentStatus: string };
type Voice = { id: string; name: string; staffProfileId?: string; status: string; providerVoiceId?: string };
type Skill = { id: string; name: string; group: string; description: string; rules: string[]; confidence: number; status: string };
type ProviderStatus = { mockMode: boolean; budgetUsd: number; providers: Record<string, { configured: boolean; model: string }> };
type Scene = {
  id: string; position: number; title: string; kind: string; purpose?: string; durationSec: number; script: string;
  visualPrompt: string; cameraDirection?: string; staffProfileId?: string; voiceProfileId?: string; sourceImageUrl?: string;
  sourceVideoUrl?: string; generatedVideoUrl?: string; audioUrl?: string; lipSyncVideoUrl?: string; status: string; locked: boolean;
};
type ProjectSummary = { id: string; name: string; brief: string; status: string; approvalStatus: string; platform: string; aspectRatio: string; durationSec: number; qualityScore?: number; outputUrl?: string; updatedAt: string; _count: { scenes: number; jobs: number; versions: number } };
type Project = ProjectSummary & { objective: string; caption?: string; hashtags?: string; staffProfileId?: string; voiceProfileId?: string; scenes: Scene[]; jobs: Array<{ id: string; type: string; provider: string; status: string; progress: number; error?: string }>; assets: Array<{ id: string; type: string; name: string; url: string }>; qualityReport?: { score: number; passed: boolean; issues: Array<{ code: string; severity: string; sceneId?: string; message: string; suggestion: string }> } };
type VideoConfig = { runwayApiKey?: string; runwayBaseUrl: string; runwayVideoModel: string; elevenLabsApiKey?: string; elevenLabsBaseUrl: string; elevenLabsVoiceModel: string; syncLabsApiKey?: string; syncLabsBaseUrl: string; syncLabsModel: string; videoMockMode: boolean; videoBudgetUsd: number; configured: Record<string, boolean> };

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const payload = await response.json().catch(() => ({})) as ApiResult<T>;
  if (!response.ok || !payload.success) throw new Error(payload.error || `Yêu cầu thất bại (${response.status})`);
  return payload.data;
}

const STATUS_LABEL: Record<string, string> = {
  draft: "Nháp", storyboard: "Đã có kịch bản", generating: "Đang tạo", video_ready: "Đã có cảnh", voice_ready: "Đã có giọng đọc",
  lip_syncing: "Đang khớp khẩu hình", ready: "Sẵn sàng", review: "Chờ duyệt", approved: "Đã duyệt", published: "Đã đăng",
  pending: "Chờ duyệt", active: "Hoạt động", failed: "Lỗi", completed: "Hoàn tất", processing: "Đang xử lý",
};
const SCENE_KIND_LABEL: Record<string, string> = {
  talking: "Nhân viên nói",
  broll: "Cảnh minh họa",
  title: "Màn hình tiêu đề",
  cta: "Lời kêu gọi hành động",
};

function Status({ value }: { value: string }) {
  const danger = value === "failed" || value === "rejected";
  const good = ["ready", "approved", "published", "completed", "active"].includes(value);
  return <Badge variant={danger ? "danger" : good ? "success" : value.includes("ing") || value === "processing" ? "warning" : "neutral"}>{STATUS_LABEL[value] || value}</Badge>;
}

function Notice({ notice, onClose }: { notice: { type: "error" | "success"; text: string } | null; onClose: () => void }) {
  if (!notice) return null;
  return <div className="fixed right-5 top-5 z-50 flex max-w-md items-start gap-3 rounded-md border p-3 text-sm shadow-lg" style={{ background: "var(--bg-card)", borderColor: notice.type === "error" ? "var(--rose)" : "var(--accent)" }}>
    {notice.type === "error" ? <WarningCircle size={19} color="var(--rose)" /> : <CheckCircle size={19} color="var(--accent)" />}
    <span className="flex-1" style={{ color: "var(--text)" }}>{notice.text}</span>
    <button aria-label="Đóng thông báo" onClick={onClose}><X size={16} /></button>
  </div>;
}

export function VideoStudio() {
  const { selectedPageId } = useActivePage();
  const [tab, setTab] = useState<Tab>("projects");
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [voices, setVoices] = useState<Voice[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [providers, setProviders] = useState<ProviderStatus | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: "error" | "success"; text: string } | null>(null);

  const qs = useMemo(() => `facebookPageId=${encodeURIComponent(selectedPageId || "")}`, [selectedPageId]);
  const loadProjects = useCallback(async () => setProjects(await api<ProjectSummary[]>(`/api/video-studio/projects?${qs}`)), [qs]);
  const loadProject = useCallback(async (id: string) => setProject(await api<Project>(`/api/video-studio/projects/${id}`)), []);
  const loadReferenceData = useCallback(async () => {
    const [staffData, voiceData, skillData, providerData] = await Promise.all([
      api<Staff[]>(`/api/staff-visuals?${qs}`), api<Voice[]>(`/api/video-studio/voices?${qs}`),
      api<Skill[]>(`/api/video-studio/skills?${qs}`), api<ProviderStatus>("/api/video-studio/providers"),
    ]);
    setStaff(staffData); setVoices(voiceData); setSkills(skillData); setProviders(providerData);
  }, [qs]);

  useEffect(() => { loadProjects().catch((e) => setNotice({ type: "error", text: e.message })); loadReferenceData().catch(() => null); }, [loadProjects, loadReferenceData]);
  useEffect(() => { if (selectedId) loadProject(selectedId).catch((e) => setNotice({ type: "error", text: e.message })); else setProject(null); }, [selectedId, loadProject]);

  const run = async (key: string, work: () => Promise<unknown>, message?: string) => {
    setBusy(key);
    try {
      await work();
      if (selectedId) await loadProject(selectedId);
      await loadProjects();
      if (message) setNotice({ type: "success", text: message });
    } catch (error) { setNotice({ type: "error", text: error instanceof Error ? error.message : String(error) }); }
    finally { setBusy(null); }
  };

  return <div className="space-y-5">
    <Notice notice={notice} onClose={() => setNotice(null)} />
    <header className="flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-end sm:justify-between" style={{ borderColor: "var(--border)" }}>
      <div>
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold" style={{ color: "var(--accent)" }}><FilmSlate size={16} weight="fill" /> XƯỞNG VIDEO AI</div>
        <h1 className="font-display text-2xl font-bold" style={{ color: "var(--text)" }}>Sản xuất video từ ý tưởng đến xuất bản</h1>
        <p className="mt-1 max-w-2xl text-sm" style={{ color: "var(--text-secondary)" }}>Tạo kịch bản, cảnh quay, giọng đọc và khẩu hình trong một quy trình có kiểm duyệt.</p>
      </div>
      <div className="flex items-center gap-2 text-xs" style={{ color: "var(--text-muted)" }}>
        <span className={cn("h-2 w-2 rounded-full", !providers ? "bg-neutral-400" : providers.mockMode ? "bg-amber-500" : "bg-emerald-500")} />
        {!providers ? "Đang kiểm tra" : providers.mockMode ? "Đang dùng chế độ thử" : "Đã kết nối dịch vụ AI"} · Giới hạn ${providers?.budgetUsd ?? 25}
      </div>
    </header>

    <nav className="flex gap-1 overflow-x-auto border-b" aria-label="Khu vực Video Studio" style={{ borderColor: "var(--border)" }}>
      {([ ["projects", FilmSlate, "Dự án"], ["learning", Brain, "Học từ video thật"], ["voices", Microphone, "Giọng đọc & quyền sử dụng"], ["settings", Gear, "Kết nối AI"] ] as const).map(([id, Icon, label]) =>
        <button key={id} onClick={() => setTab(id)} className="relative flex min-w-max items-center gap-2 px-4 py-3 text-sm font-semibold" style={{ color: tab === id ? "var(--accent)" : "var(--text-muted)" }}>
          <Icon size={17} weight={tab === id ? "fill" : "regular"} />{label}
          {tab === id && <span className="absolute inset-x-2 bottom-0 h-0.5" style={{ background: "var(--accent)" }} />}
        </button>)}
    </nav>

    {tab === "projects" && (project
      ? <ProjectWorkspace project={project} staff={staff} voices={voices} busy={busy} onBack={() => setSelectedId(null)} onRun={run} onRefresh={() => loadProject(project.id)} />
      : <ProjectsHome projects={projects} staff={staff} voices={voices} skills={skills} pageId={selectedPageId} busy={busy} onCreated={(id) => { loadProjects(); setSelectedId(id); }} onSelect={setSelectedId} onError={(text) => setNotice({ type: "error", text })} />)}
    {tab === "learning" && <LearningPanel projects={projects} skills={skills} pageId={selectedPageId} busy={busy} onRun={run} onReload={() => loadReferenceData()} />}
    {tab === "voices" && <VoicePanel projects={projects} staff={staff} voices={voices} pageId={selectedPageId} busy={busy} onRun={run} onReload={() => loadReferenceData()} />}
    {tab === "settings" && <ProviderSettings onStatus={(data) => setProviders(data)} onNotice={setNotice} />}
  </div>;
}

function ProjectsHome({ projects, staff, voices, skills, pageId, busy, onCreated, onSelect, onError }: { projects: ProjectSummary[]; staff: Staff[]; voices: Voice[]; skills: Skill[]; pageId: string; busy: string | null; onCreated: (id: string) => void; onSelect: (id: string) => void; onError: (text: string) => void }) {
  const [creating, setCreating] = useState(false);
  const showCreate = creating || projects.length === 0;
  const [form, setForm] = useState({ name: "", brief: "", objective: "booking", platform: "tiktok", aspectRatio: "9:16", durationSec: 30, staffProfileId: "", voiceProfileId: "", styleSkillIds: [] as string[] });
  const submit = async () => {
    try {
      const created = await api<ProjectSummary>("/api/video-studio/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, facebookPageId: pageId || null, staffProfileId: form.staffProfileId || null, voiceProfileId: form.voiceProfileId || null }) });
      onCreated(created.id);
    } catch (error) { onError(error instanceof Error ? error.message : String(error)); }
  };
  return <div className={cn("grid gap-6", showCreate && "xl:grid-cols-[minmax(0,1fr)_22rem]")}>
    <section>
      <div className="mb-4 flex items-center justify-between"><div><h2 className="text-base font-bold" style={{ color: "var(--text)" }}>Dự án gần đây</h2><p className="text-xs" style={{ color: "var(--text-muted)" }}>{projects.length} dự án trong Trang Facebook đang chọn</p></div><Button size="sm" onClick={() => setCreating(true)}><Plus size={16} />Tạo dự án</Button></div>
      {projects.length === 0 ? <div className="flex min-h-72 flex-col items-center justify-center border-y text-center" style={{ borderColor: "var(--border)" }}><FilmSlate size={36} color="var(--text-muted)" /><p className="mt-3 font-semibold">Chưa có dự án video</p><p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>Nhập một mô tả ngắn, AutoSpa sẽ tạo kịch bản theo từng cảnh.</p></div>
      : <div className="divide-y border-y" style={{ borderColor: "var(--border)" }}>{projects.map((item) => <button key={item.id} onClick={() => onSelect(item.id)} className="group grid w-full gap-3 px-2 py-4 text-left transition-colors hover:bg-[var(--bg-subtle)] sm:grid-cols-[minmax(0,1fr)_auto]">
        <div><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold" style={{ color: "var(--text)" }}>{item.name}</h3><Status value={item.status} />{item.qualityScore != null && <Badge variant={item.qualityScore >= 75 ? "success" : "warning"}>QA {item.qualityScore}</Badge>}</div><p className="mt-1 line-clamp-2 text-sm" style={{ color: "var(--text-secondary)" }}>{item.brief}</p></div>
        <div className="flex items-center gap-4 text-xs tabular-nums" style={{ color: "var(--text-muted)" }}><span>{item._count.scenes} cảnh</span><span>{item.durationSec}s</span><span>{item.aspectRatio}</span><Play size={18} className="transition-transform group-hover:translate-x-0.5" /></div>
      </button>)}</div>}
    </section>
    <aside className={cn("border-l pl-6", showCreate ? "block" : "hidden")} style={{ borderColor: "var(--border)" }}>
      <div className="mb-4 flex items-center justify-between"><div><h2 className="font-bold">Brief mới</h2><p className="text-xs" style={{ color: "var(--text-muted)" }}>AI sẽ chia thành các cảnh có thể sửa</p></div>{projects.length > 0 && <button onClick={() => setCreating(false)} aria-label="Đóng"><X size={18} /></button>}</div>
      <div className="space-y-4"><Input label="Tên dự án" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Video liệu trình phục hồi da" /><Textarea label="Mục tiêu và nội dung" rows={5} value={form.brief} onChange={(e) => setForm({ ...form, brief: e.target.value })} placeholder="Video 30 giây cho khách nữ 25-35 tuổi, tập trung quy trình thật và lời mời tư vấn nhẹ..." />
        <div className="grid grid-cols-2 gap-3"><Select label="Mục tiêu" value={form.objective} onChange={(e) => setForm({ ...form, objective: e.target.value })}><option value="booking">Đặt lịch</option><option value="lead">Tin nhắn</option><option value="awareness">Nhận diện</option><option value="engagement">Tương tác</option></Select><Select label="Nền tảng" value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })}><option value="tiktok">TikTok</option><option value="instagram">Instagram</option><option value="facebook">Facebook</option><option value="multi">Đa nền tảng</option></Select></div>
        <div className="grid grid-cols-2 gap-3"><Select label="Tỉ lệ" value={form.aspectRatio} onChange={(e) => setForm({ ...form, aspectRatio: e.target.value })}><option>9:16</option><option>1:1</option><option>16:9</option></Select><Input label="Thời lượng" type="number" min={10} max={180} value={form.durationSec} onChange={(e) => setForm({ ...form, durationSec: Number(e.target.value) })} /></div>
        <Select label="Nhân viên" value={form.staffProfileId} onChange={(e) => setForm({ ...form, staffProfileId: e.target.value })}><option value="">Chưa chọn</option>{staff.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select>
        <Select label="Giọng đọc" value={form.voiceProfileId} onChange={(e) => setForm({ ...form, voiceProfileId: e.target.value })}><option value="">Chưa chọn</option>{voices.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select>
        {skills.some((skill) => skill.status === "approved") && <div><p className="mb-2 text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>Phong cách đã học</p><div className="flex flex-wrap gap-2">{skills.filter((skill) => skill.status === "approved").slice(0, 6).map((skill) => <button key={skill.id} type="button" onClick={() => setForm({ ...form, styleSkillIds: form.styleSkillIds.includes(skill.id) ? form.styleSkillIds.filter((id) => id !== skill.id) : [...form.styleSkillIds, skill.id] })} className="rounded-md border px-2 py-1 text-xs" style={{ borderColor: form.styleSkillIds.includes(skill.id) ? "var(--accent)" : "var(--border)", color: form.styleSkillIds.includes(skill.id) ? "var(--accent)" : "var(--text-secondary)" }}>{skill.name}</button>)}</div></div>}
        <Button className="w-full" loading={busy === "create"} disabled={form.name.length < 2 || form.brief.length < 10} onClick={submit}><MagicWand size={17} />Tạo dự án video</Button>
      </div>
    </aside>
  </div>;
}

function ProjectWorkspace({ project, staff, voices, busy, onBack, onRun, onRefresh }: { project: Project; staff: Staff[]; voices: Voice[]; busy: string | null; onBack: () => void; onRun: (key: string, work: () => Promise<unknown>, message?: string) => Promise<void>; onRefresh: () => Promise<void> }) {
  const [activeSceneId, setActiveSceneId] = useState(project.scenes[0]?.id || "");
  const scene = project.scenes.find((item) => item.id === activeSceneId) || project.scenes[0];
  useEffect(() => { if (!project.scenes.some((item) => item.id === activeSceneId)) setActiveSceneId(project.scenes[0]?.id || ""); }, [project.scenes, activeSceneId]);
  const post = (url: string, body?: unknown) => api(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const patchScene = async (id: string, data: Partial<Scene>) => { await api(`/api/video-studio/scenes/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }); await onRefresh(); };
  const activeJobs = project.jobs.filter((job) => ["queued", "processing"].includes(job.status));
  const uploadMusic = async (file: File) => {
    const form = new FormData(); form.set("file", file); form.set("projectId", project.id); form.set("purpose", "music");
    await api("/api/video-studio/upload", { method: "POST", body: form });
  };
  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><button onClick={onBack} className="rounded-md p-2 hover:bg-[var(--bg-subtle)]" aria-label="Quay lại"><X size={18} /></button><div><div className="flex items-center gap-2"><h2 className="text-lg font-bold">{project.name}</h2><Status value={project.status} /></div><p className="text-xs" style={{ color: "var(--text-muted)" }}>{project.platform} · {project.aspectRatio} · {project.durationSec}s</p></div></div>
      <div className="flex flex-wrap gap-2"><Button variant="secondary" size="sm" onClick={() => onRun("storyboard", () => post(`/api/video-studio/projects/${project.id}/storyboard`), "Kịch bản phân cảnh đã được cập nhật")} loading={busy === "storyboard"}><Sparkle size={16} />Tạo kịch bản phân cảnh</Button><Button variant="secondary" size="sm" onClick={() => onRun("qa", () => post(`/api/video-studio/projects/${project.id}/quality`), "Đã kiểm tra video")} loading={busy === "qa"}><CheckCircle size={16} />Kiểm tra</Button><Button size="sm" onClick={() => onRun("render", () => post(`/api/video-studio/projects/${project.id}/render`), "Video đã được đưa vào hàng đợi dựng")} loading={busy === "render"}><FilmSlate size={16} />Dựng video</Button></div>
    </div>

    <div className="grid gap-3 sm:grid-cols-5">{[["01", "Kịch bản", project.scenes.length > 0], ["02", "Cảnh", project.scenes.some((s) => s.generatedVideoUrl)], ["03", "Giọng đọc", project.scenes.filter((s) => s.kind === "talking").every((s) => s.audioUrl)], ["04", "Khẩu hình", project.scenes.filter((s) => s.kind === "talking").every((s) => s.lipSyncVideoUrl)], ["05", "Duyệt", project.approvalStatus === "approved"]].map(([num, label, done]) => <div key={String(num)} className="border-t-2 pt-2" style={{ borderColor: done ? "var(--accent)" : "var(--border)" }}><span className="text-[10px] font-bold" style={{ color: done ? "var(--accent)" : "var(--text-muted)" }}>{num}</span><p className="text-xs font-semibold">{label}</p></div>)}</div>

    {activeJobs.length > 0 && <div className="flex flex-wrap items-center gap-3 border-y px-1 py-3 text-xs" style={{ borderColor: "var(--border)" }}><Spinner className="animate-spin" size={16} color="var(--warning)" /><strong>{activeJobs.length} tác vụ đang chạy</strong>{activeJobs.map((job) => <button key={job.id} onClick={() => onRun(`poll-${job.id}`, () => api(`/api/video-studio/jobs/${job.id}`))} className="underline" style={{ color: "var(--text-secondary)" }}>{job.provider} {job.progress}%</button>)}</div>}

    <div className="grid min-h-[34rem] gap-5 lg:grid-cols-[19rem_minmax(0,1fr)_19rem]">
      <aside className="border-r pr-4" style={{ borderColor: "var(--border)" }}><div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-bold">Timeline</h3><span className="text-xs tabular-nums" style={{ color: "var(--text-muted)" }}>{project.scenes.reduce((sum, item) => sum + item.durationSec, 0)}s</span></div>
        {project.scenes.length === 0 ? <div className="py-12 text-center text-sm" style={{ color: "var(--text-muted)" }}>Tạo kịch bản phân cảnh để bắt đầu.</div> : <div className="space-y-1">{project.scenes.map((item) => <button key={item.id} onClick={() => setActiveSceneId(item.id)} className="grid w-full grid-cols-[2rem_1fr_auto] items-center gap-2 rounded-md px-2 py-3 text-left" style={{ background: activeSceneId === item.id ? "var(--accent-light)" : "transparent" }}><span className="font-mono text-xs" style={{ color: "var(--text-muted)" }}>{String(item.position + 1).padStart(2, "0")}</span><span className="min-w-0"><span className="block truncate text-sm font-semibold">{item.title}</span><span className="block text-[11px]" style={{ color: "var(--text-muted)" }}>{SCENE_KIND_LABEL[item.kind] || item.kind} · {item.durationSec} giây</span></span><span className="h-2 w-2 rounded-full" style={{ background: item.status === "ready" ? "var(--accent)" : item.status.includes("ing") ? "var(--warning)" : "var(--border-strong)" }} /></button>)}</div>}
      </aside>

      <main className="min-w-0">{scene ? <SceneEditor projectId={project.id} scene={scene} staff={staff} voices={voices} busy={busy} onPatch={patchScene} onRun={onRun} onRefresh={onRefresh} /> : <div className="flex h-full items-center justify-center text-sm" style={{ color: "var(--text-muted)" }}>Chưa có cảnh được chọn</div>}</main>

      <aside className="border-l pl-4" style={{ borderColor: "var(--border)" }}><h3 className="mb-4 text-sm font-bold">Hoàn thiện</h3>
        <div className="space-y-4"><div><p className="mb-1 text-xs font-semibold">Điểm chất lượng</p><div className="flex items-end gap-2"><strong className="text-3xl tabular-nums" style={{ color: (project.qualityScore || 0) >= 75 ? "var(--accent)" : "var(--warning)" }}>{project.qualityScore ?? "--"}</strong><span className="pb-1 text-xs" style={{ color: "var(--text-muted)" }}>/100</span></div></div>
          <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed p-3 text-xs font-semibold" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}><Waveform size={17} color="var(--accent)" /><span className="min-w-0 flex-1 truncate">{project.assets.find((asset) => asset.type === "music")?.name || "Thêm nhạc nền"}</span><input type="file" accept="audio/mpeg,audio/wav,audio/mp4" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) onRun("upload-music", () => uploadMusic(file), "Đã thêm nhạc nền"); event.target.value = ""; }} /></label>
          {project.qualityReport?.issues?.slice(0, 5).map((issue) => <div key={`${issue.code}-${issue.sceneId}`} className="border-l-2 pl-3 text-xs" style={{ borderColor: issue.severity === "blocking" ? "var(--rose)" : "var(--warning)" }}><p className="font-semibold">{issue.message}</p><p className="mt-1" style={{ color: "var(--text-muted)" }}>{issue.suggestion}</p></div>)}
          {project.outputUrl && <div><p className="mb-2 text-xs font-semibold">Video đã dựng</p>{project.outputUrl.startsWith("mock://") ? <div className="flex aspect-[9/16] max-h-64 items-center justify-center rounded-md bg-[var(--bg-subtle)] text-center text-xs" style={{ color: "var(--text-muted)" }}>Bản xem trước ở chế độ thử<br />Tắt chế độ thử để xuất tệp MP4</div> : <video src={project.outputUrl} controls className="max-h-64 w-full rounded-md bg-black" />}</div>}
          <Button className="w-full" variant={project.approvalStatus === "approved" ? "secondary" : "primary"} disabled={!project.outputUrl || (project.qualityScore || 0) < 75 || project.approvalStatus === "approved"} onClick={() => onRun("approve", () => api(`/api/video-studio/projects/${project.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ approvalStatus: "approved" }) }), "Video đã được duyệt")}><Check size={16} />{project.approvalStatus === "approved" ? "Đã duyệt" : "Duyệt video"}</Button>
          <Button className="w-full" variant="secondary" disabled={project.approvalStatus !== "approved"} onClick={() => onRun("publish", () => post(`/api/video-studio/projects/${project.id}/publish`, { targets: project.platform === "multi" ? ["facebook", "instagram", "tiktok"] : [project.platform] }), "Video đã được đưa vào hàng đợi xuất bản")} loading={busy === "publish"}><PaperPlaneTilt size={16} />Xuất bản</Button>
          <Button className="w-full" variant="ghost" onClick={() => onRun("template", () => post("/api/video-studio/templates", { projectId: project.id, name: `${project.name} - mẫu` }), "Đã lưu thành template")}><Plus size={16} />Lưu làm template</Button>
        </div>
      </aside>
    </div>
  </div>;
}

function SceneEditor({ projectId, scene, staff, voices, busy, onPatch, onRun, onRefresh }: { projectId: string; scene: Scene; staff: Staff[]; voices: Voice[]; busy: string | null; onPatch: (id: string, data: Partial<Scene>) => Promise<void>; onRun: (key: string, work: () => Promise<unknown>, message?: string) => Promise<void>; onRefresh: () => Promise<void> }) {
  const [draft, setDraft] = useState(scene);
  useEffect(() => setDraft(scene), [scene]);
  const action = (name: string) => onRun(`${name}-${scene.id}`, () => api(`/api/video-studio/scenes/${scene.id}/action`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: name }) }), name === "generate-video" ? "Đã gửi cảnh sang Runway" : name === "generate-voice" ? "Đã tạo giọng đọc" : name === "lip-sync" ? "Đã gửi cảnh sang Sync Labs" : "Đã đổi vị trí cảnh");
  const selectedStaff = staff.find((item) => item.id === draft.staffProfileId);
  const uploadSceneVideo = async (file: File) => {
    const form = new FormData();
    form.set("file", file); form.set("projectId", projectId); form.set("sceneId", scene.id); form.set("purpose", "source_video");
    await api("/api/video-studio/upload", { method: "POST", body: form });
  };
  return <div className="space-y-5"><div className="flex items-start justify-between gap-3"><div><div className="mb-1 flex items-center gap-2"><Status value={scene.status} /><span className="text-xs" style={{ color: "var(--text-muted)" }}>Cảnh {scene.position + 1}</span></div><input className="w-full bg-transparent text-lg font-bold outline-none" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} onBlur={() => draft.title !== scene.title && onPatch(scene.id, { title: draft.title })} /></div><div className="flex items-center gap-1"><button title="Đưa cảnh lên" aria-label="Đưa cảnh lên" onClick={() => action("move-up")} className="rounded-md border p-1.5" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}><ArrowUp size={14} /></button><button title="Đưa cảnh xuống" aria-label="Đưa cảnh xuống" onClick={() => action("move-down")} className="rounded-md border p-1.5" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}><ArrowDown size={14} /></button><button onClick={() => onPatch(scene.id, { locked: !scene.locked })} className="rounded-md border px-2 py-1 text-xs" style={{ borderColor: scene.locked ? "var(--accent)" : "var(--border)", color: scene.locked ? "var(--accent)" : "var(--text-muted)" }}>{scene.locked ? "Đã khóa" : "Khóa cảnh"}</button></div></div>
    <div className="grid gap-3 sm:grid-cols-3"><Select label="Loại cảnh" value={draft.kind} onChange={(e) => { const kind = e.target.value; setDraft({ ...draft, kind }); onPatch(scene.id, { kind }); }}><option value="talking">Nhân viên nói</option><option value="broll">B-roll</option><option value="title">Tiêu đề</option><option value="cta">CTA</option></Select><Input label="Thời lượng (giây)" type="number" min={1} max={30} value={draft.durationSec} onChange={(e) => setDraft({ ...draft, durationSec: Number(e.target.value) })} onBlur={() => onPatch(scene.id, { durationSec: draft.durationSec })} /><Select label="Nhân viên" value={draft.staffProfileId || ""} onChange={(e) => { const value = e.target.value; const selected = staff.find((item) => item.id === value); setDraft({ ...draft, staffProfileId: value, sourceImageUrl: selected?.referenceImageUrl }); onPatch(scene.id, { staffProfileId: value || undefined, sourceImageUrl: selected?.referenceImageUrl }); }}><option value="">Không dùng</option>{staff.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></div>
    {scene.kind === "talking" && <Select label="Giọng đọc" value={draft.voiceProfileId || ""} onChange={(e) => { setDraft({ ...draft, voiceProfileId: e.target.value }); onPatch(scene.id, { voiceProfileId: e.target.value }); }}><option value="">Chọn giọng đọc</option>{voices.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select>}
    <Textarea label="Lời thoại" rows={5} value={draft.script} onChange={(e) => setDraft({ ...draft, script: e.target.value })} onBlur={() => draft.script !== scene.script && onPatch(scene.id, { script: draft.script })} hint="Viết như lời nói thật; dấu câu quyết định nhịp đọc." />
    <Textarea label="Chỉ đạo hình ảnh" rows={4} value={draft.visualPrompt} onChange={(e) => setDraft({ ...draft, visualPrompt: e.target.value })} onBlur={() => draft.visualPrompt !== scene.visualPrompt && onPatch(scene.id, { visualPrompt: draft.visualPrompt })} />
    <div className="grid gap-3 sm:grid-cols-4"><Button variant="secondary" loading={busy === `generate-video-${scene.id}`} onClick={() => action("generate-video")}><VideoCamera size={17} />Tạo cảnh bằng Runway</Button><label className="flex min-h-9 cursor-pointer items-center justify-center gap-2 rounded-md border px-3 text-sm font-semibold" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}><CloudArrowUp size={17} />Tải cảnh thật lên<input type="file" accept="video/mp4,video/quicktime,video/webm" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) onRun(`upload-${scene.id}`, () => uploadSceneVideo(file), "Cảnh quay thật đã được thêm vào"); event.target.value = ""; }} /></label><Button variant="secondary" disabled={scene.kind !== "talking" || !scene.voiceProfileId} loading={busy === `generate-voice-${scene.id}`} onClick={() => action("generate-voice")}><Waveform size={17} />Tạo giọng đọc</Button><Button variant="secondary" disabled={scene.kind !== "talking" || !scene.audioUrl || !(scene.generatedVideoUrl || scene.sourceVideoUrl || selectedStaff?.referenceImageUrl)} loading={busy === `lip-sync-${scene.id}`} onClick={() => action("lip-sync")}><UserCircle size={17} />Khớp khẩu hình</Button></div>
    <div className="grid grid-cols-3 gap-3 border-t pt-4 text-center text-xs" style={{ borderColor: "var(--border)" }}><div><ImageSquare size={18} className="mx-auto mb-1" color={scene.generatedVideoUrl || scene.sourceVideoUrl ? "var(--accent)" : "var(--text-muted)"} />Cảnh</div><div><Microphone size={18} className="mx-auto mb-1" color={scene.audioUrl ? "var(--accent)" : "var(--text-muted)"} />Giọng đọc</div><div><Subtitles size={18} className="mx-auto mb-1" color={scene.lipSyncVideoUrl ? "var(--accent)" : "var(--text-muted)"} />Khẩu hình</div></div>
    <button onClick={onRefresh} className="flex items-center gap-2 text-xs" style={{ color: "var(--text-muted)" }}><ArrowClockwise size={14} />Làm mới trạng thái</button>
  </div>;
}

function LearningPanel({ projects, skills, busy, onRun, onReload }: { projects: ProjectSummary[]; skills: Skill[]; pageId: string; busy: string | null; onRun: (key: string, work: () => Promise<unknown>, message?: string) => Promise<void>; onReload: () => Promise<void> }) {
  const [projectId, setProjectId] = useState(projects[0]?.id || ""); const [file, setFile] = useState<File | null>(null);
  const analyze = async () => { if (!file || !projectId) throw new Error("Chọn dự án và video thật"); const form = new FormData(); form.set("file", file); form.set("projectId", projectId); form.set("purpose", "source_video"); const asset = await api<{ id: string }>("/api/video-studio/upload", { method: "POST", body: form }); await api("/api/video-studio/learning", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectId, assetId: asset.id }) }); await onReload(); };
  return <div className="grid gap-8 lg:grid-cols-[21rem_minmax(0,1fr)]"><aside className="border-r pr-6" style={{ borderColor: "var(--border)" }}><h2 className="font-bold">Thêm video thật</h2><p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>Hệ thống sẽ đề xuất các kỹ năng rút ra từ video. Bạn cần duyệt trước khi bộ não áp dụng.</p><div className="mt-5 space-y-4"><Select label="Dự án chứa video" value={projectId} onChange={(e) => setProjectId(e.target.value)}><option value="">Chọn dự án</option>{projects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select><label className="flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-md border border-dashed p-5 text-center"><CloudArrowUp size={28} color="var(--accent)" /><span className="mt-2 text-sm font-semibold">{file?.name || "Chọn tệp MP4, MOV hoặc WebM"}</span><span className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>Dung lượng tối đa 150 MB</span><input type="file" accept="video/mp4,video/quicktime,video/webm" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] || null)} /></label><Button className="w-full" disabled={!file || !projectId} loading={busy === "learn"} onClick={() => onRun("learn", analyze, "Video đã được đưa vào hàng đợi phân tích")}><Brain size={17} />Phân tích và đề xuất kỹ năng</Button></div></aside>
    <section><div className="mb-4 flex items-end justify-between"><div><h2 className="font-bold">Kỹ năng học từ video</h2><p className="text-xs" style={{ color: "var(--text-muted)" }}>{skills.filter((item) => item.status === "pending").length} chờ duyệt · {skills.filter((item) => item.status === "approved").length} đang được áp dụng</p></div></div><div className="divide-y border-y" style={{ borderColor: "var(--border)" }}>{skills.length === 0 ? <p className="py-16 text-center text-sm" style={{ color: "var(--text-muted)" }}>Chưa có kỹ năng nào được học từ video thật.</p> : skills.map((skill) => <article key={skill.id} className="grid gap-3 py-4 sm:grid-cols-[1fr_auto]"><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{skill.name}</h3><Badge>{skill.group}</Badge><Status value={skill.status} /><span className="text-xs tabular-nums" style={{ color: "var(--text-muted)" }}>{Math.round(skill.confidence * 100)}%</span></div><p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>{skill.description}</p><p className="mt-2 text-xs" style={{ color: "var(--text-muted)" }}>{skill.rules.join(" · ")}</p></div>{skill.status === "pending" && <div className="flex items-center gap-2"><Button size="sm" variant="ghost" onClick={() => onRun(`reject-${skill.id}`, () => api("/api/video-studio/skills", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: skill.id, action: "reject" }) }).then(onReload))}>Bỏ qua</Button><Button size="sm" onClick={() => onRun(`approve-${skill.id}`, () => api("/api/video-studio/skills", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: skill.id, action: "approve" }) }).then(onReload))}><Check size={15} />Duyệt</Button></div>}</article>)}</div></section>
  </div>;
}

function VoicePanel({ projects, staff, voices, pageId, busy, onRun, onReload }: { projects: ProjectSummary[]; staff: Staff[]; voices: Voice[]; pageId: string; busy: string | null; onRun: (key: string, work: () => Promise<unknown>, message?: string) => Promise<void>; onReload: () => Promise<void> }) {
  const [form, setForm] = useState({ projectId: projects[0]?.id || "", staffId: staff[0]?.id || "", name: "", consentConfirmed: false, consentNote: "" });
  const [file, setFile] = useState<File | null>(null);
  const create = async () => {
    const person = staff.find((item) => item.id === form.staffId);
    if (!person || !file || !form.projectId || !form.consentConfirmed) throw new Error("Vui lòng nhập đủ thông tin và xác nhận sự đồng ý của nhân viên");
    const consent = await api<{ id: string }>("/api/video-studio/consents", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        subjectType: "staff", subjectId: person.id, subjectName: person.name, facebookPageId: pageId || null,
        scopes: ["voice_clone", "lip_sync", "face_generation", "advertising"], evidenceType: "digital_attestation",
        evidenceText: form.consentNote, confirmed: true, termsVersion: "video-consent-v1",
        expiresAt: new Date(Date.now() + 365 * 86_400_000).toISOString(), notes: "Xác nhận bởi owner trong AI Video Studio",
      }),
    });
    const upload = new FormData(); upload.set("file", file); upload.set("projectId", form.projectId); upload.set("purpose", "voice_sample");
    const asset = await api<{ id: string }>("/api/video-studio/upload", { method: "POST", body: upload });
    await api("/api/video-studio/voices", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ facebookPageId: pageId || null, staffProfileId: person.id, consentId: consent.id, sampleAssetId: asset.id, name: form.name || `${person.name} - giọng thật`, clone: true, settings: { stability: 0.55, similarityBoost: 0.78, style: 0.2, speed: 1 } }) });
    await onReload();
  };
  return <div className="grid gap-8 lg:grid-cols-[22rem_minmax(0,1fr)]"><aside className="border-r pr-6" style={{ borderColor: "var(--border)" }}><h2 className="font-bold">Tạo giọng đọc</h2><p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>Chỉ sao chép giọng khi nhân viên đã đồng ý rõ phạm vi và thời hạn sử dụng.</p><div className="mt-5 space-y-4"><Select label="Dự án lưu mẫu" value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value })}><option value="">Chọn dự án</option>{projects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select><Select label="Nhân viên" value={form.staffId} onChange={(e) => setForm({ ...form, staffId: e.target.value })}><option value="">Chọn nhân viên</option>{staff.filter((item) => item.consentStatus === "consented").map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select><Input label="Tên giọng đọc" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Lan - tư vấn nhẹ nhàng" /><label className="flex cursor-pointer items-center gap-3 rounded-md border border-dashed p-4"><Microphone size={22} color="var(--accent)" /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{file?.name || "Tải mẫu MP3 hoặc WAV lên"}</span><span className="block text-xs" style={{ color: "var(--text-muted)" }}>Bản thu rõ tiếng, không có nhạc nền</span></span><input type="file" accept="audio/mpeg,audio/wav,audio/mp4" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] || null)} /></label><Textarea label="Bằng chứng đồng ý" rows={3} value={form.consentNote} onChange={(e) => setForm({ ...form, consentNote: e.target.value })} placeholder="Ngày ký, hình thức xác nhận và phạm vi nhân viên đã đồng ý..." /><label className="flex items-start gap-2 text-xs" style={{ color: "var(--text-secondary)" }}><input type="checkbox" className="mt-0.5" checked={form.consentConfirmed} onChange={(e) => setForm({ ...form, consentConfirmed: e.target.checked })} /><span>Tôi xác nhận nhân viên đã đồng ý cho sao chép giọng, khớp khẩu hình và sử dụng trong quảng cáo trong 12 tháng.</span></label><Button className="w-full" disabled={!file || !form.staffId || !form.projectId || !form.consentConfirmed || form.consentNote.trim().length < 20} loading={busy === "voice-create"} onClick={() => onRun("voice-create", create, "Đã tạo giọng đọc")}><Waveform size={17} />Xác nhận và tạo giọng</Button></div></aside>
    <section><h2 className="font-bold">Thư viện giọng đọc</h2><p className="mb-4 text-xs" style={{ color: "var(--text-muted)" }}>{voices.length} giọng đọc đang hoạt động</p><div className="grid gap-px overflow-hidden rounded-md border bg-[var(--border)] sm:grid-cols-2 xl:grid-cols-3" style={{ borderColor: "var(--border)" }}>{voices.map((voice) => { const person = staff.find((item) => item.id === voice.staffProfileId); return <article key={voice.id} className="min-h-36 bg-[var(--bg-card)] p-4"><div className="flex items-start justify-between"><div className="flex h-9 w-9 items-center justify-center rounded-md bg-[var(--accent-light)]"><Waveform size={19} color="var(--accent)" /></div><Status value={voice.status} /></div><h3 className="mt-4 font-semibold">{voice.name}</h3><p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>{person?.name || "Giọng hệ thống"} · ElevenLabs</p><p className="mt-3 text-[11px]" style={{ color: voice.providerVoiceId ? "var(--accent)" : "var(--warning)" }}>{voice.providerVoiceId ? "Đã sẵn sàng sử dụng" : "Chưa kết nối với ElevenLabs"}</p></article>; })}{voices.length === 0 && <p className="col-span-full bg-[var(--bg-card)] py-16 text-center text-sm" style={{ color: "var(--text-muted)" }}>Chưa có giọng đọc nào.</p>}</div></section>
  </div>;
}

function ProviderSettings({ onStatus, onNotice }: { onStatus: (data: ProviderStatus) => void; onNotice: (notice: { type: "error" | "success"; text: string }) => void }) {
  const [config, setConfig] = useState<VideoConfig | null>(null); const [saving, setSaving] = useState(false); const [testing, setTesting] = useState<string | null>(null);
  useEffect(() => { api<VideoConfig>("/api/video-studio/config").then(setConfig).catch((e) => onNotice({ type: "error", text: e.message })); }, [onNotice]);
  if (!config) return <div className="flex min-h-64 items-center justify-center"><Spinner size={24} className="animate-spin" /></div>;
  const save = async () => { setSaving(true); try { await api("/api/video-studio/config", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(config) }); const status = await api<ProviderStatus>("/api/video-studio/providers"); onStatus(status); onNotice({ type: "success", text: "Đã lưu cấu hình Xưởng video" }); } catch (e) { onNotice({ type: "error", text: e instanceof Error ? e.message : String(e) }); } finally { setSaving(false); } };
  const test = async (provider: string) => { setTesting(provider); try { await api("/api/video-studio/providers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider }) }); onNotice({ type: "success", text: `${provider} kết nối thành công` }); } catch (e) { onNotice({ type: "error", text: e instanceof Error ? e.message : String(e) }); } finally { setTesting(null); } };
  const providers = [
    { id: "runway", label: "Runway", key: "runwayApiKey", base: "runwayBaseUrl", model: "runwayVideoModel", purpose: "Tạo video từ mô tả hoặc hình ảnh" },
    { id: "elevenLabs", label: "ElevenLabs", key: "elevenLabsApiKey", base: "elevenLabsBaseUrl", model: "elevenLabsVoiceModel", purpose: "Tạo giọng đọc tự nhiên và sao chép giọng" },
    { id: "sync", label: "Sync Labs", key: "syncLabsApiKey", base: "syncLabsBaseUrl", model: "syncLabsModel", purpose: "Đồng bộ khẩu hình từ ảnh hoặc video" },
  ] as const;
  return <div className="max-w-4xl"><div className="mb-6 flex flex-wrap items-start justify-between gap-4"><div><h2 className="font-bold">Kết nối dịch vụ AI</h2><p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>Khóa truy cập chỉ được lưu và sử dụng trên máy chủ.</p></div><div className="flex items-center gap-3"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={config.videoMockMode} onChange={(e) => setConfig({ ...config, videoMockMode: e.target.checked })} /> Chế độ thử</label><Button onClick={save} loading={saving}><Check size={16} />Lưu cấu hình</Button></div></div>
    <div className="divide-y border-y" style={{ borderColor: "var(--border)" }}>{providers.map((provider) => <section key={provider.id} className="grid gap-4 py-5 md:grid-cols-[12rem_minmax(0,1fr)_auto]"><div><div className="flex items-center gap-2"><h3 className="font-bold">{provider.label}</h3><span className="h-2 w-2 rounded-full" style={{ background: config.configured[provider.id] ? "var(--accent)" : "var(--border-strong)" }} /></div><p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>{provider.purpose}</p></div><div className="grid gap-3 sm:grid-cols-2"><Input label="Khóa truy cập" type="password" value={String(config[provider.key] || "")} placeholder="Nhập khóa mới" onChange={(e) => setConfig({ ...config, [provider.key]: e.target.value })} /><Input label="Mô hình" value={String(config[provider.model])} onChange={(e) => setConfig({ ...config, [provider.model]: e.target.value })} /><div className="sm:col-span-2"><Input label="Địa chỉ dịch vụ" value={String(config[provider.base])} onChange={(e) => setConfig({ ...config, [provider.base]: e.target.value })} /></div></div><Button variant="secondary" size="sm" loading={testing === provider.id} onClick={() => test(provider.id)}>Kiểm tra</Button></section>)}</div>
    <div className="mt-6 grid gap-4 sm:grid-cols-[1fr_12rem]"><div><h3 className="text-sm font-bold">Ngân sách bảo vệ</h3><p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>Hệ thống chặn tác vụ mới khi tổng chi phí dự án vượt trần này.</p></div><Input label="USD / dự án" type="number" min={1} max={10000} value={config.videoBudgetUsd} onChange={(e) => setConfig({ ...config, videoBudgetUsd: Number(e.target.value) })} /></div>
  </div>;
}
