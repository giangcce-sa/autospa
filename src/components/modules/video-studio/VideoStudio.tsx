"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowClockwise, ArrowDown, ArrowUp, Brain, Check, CheckCircle, CloudArrowUp, FilmSlate, Gear, ImageSquare,
  MagicWand, Microphone, PaperPlaneTilt, Play, Plus, Sparkle, Spinner,
  Subtitles, UserCircle, VideoCamera, WarningCircle, Waveform, X,
} from "@phosphor-icons/react";
import { useActivePage } from "@/contexts/ActivePageContext";
import { Button } from "@/components/ui/Button";
import { MediaAssetCard } from "@/components/media/MediaAssetCard";
import { MediaPreviewDialog } from "@/components/media/MediaPreviewDialog";
import { MediaStatusBadge } from "@/components/media/MediaStatusBadge";
import { Input, Textarea } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";

type Tab = "projects" | "learning" | "voices" | "readiness";
type CanonicalVideoView = "overview" | "projects" | "review" | "jobs";
type ApiResult<T> = { success: boolean; data: T; error?: string };

interface VideoStudioProps {
  facebookPageId?: string;
  canonicalView?: CanonicalVideoView;
  canMutate?: boolean;
  initialProjectId?: string;
  initialSceneId?: string;
  onProjectIdChange?: (projectId?: string) => void;
  onSceneIdChange?: (sceneId?: string) => void;
}
type Staff = { id: string; name: string; role?: string; referenceImageUrl?: string; consentStatus: string };
type Voice = { id: string; name: string; staffProfileId?: string; status: string; providerVoiceId?: string };
type Skill = { id: string; name: string; group: string; description: string; rules: string[]; confidence: number; status: string };
type ProviderStatus = { mockMode: boolean; budgetUsd: number; providers: Record<string, { configured: boolean; model: string }> };
type Scene = {
  id: string; position: number; title: string; kind: string; purpose?: string; durationSec: number; script: string;
  visualPrompt: string; cameraDirection?: string; staffProfileId?: string; voiceProfileId?: string; sourceImageUrl?: string;
  sourceVideoUrl?: string; generatedVideoUrl?: string; audioUrl?: string; lipSyncVideoUrl?: string; status: string; locked: boolean;
};
type ProjectSummary = {
  id: string; name: string; brief: string; status: string; approvalStatus: string; platform: string; aspectRatio: string;
  durationSec: number; qualityScore?: number; outputUrl?: string; thumbnailUrl?: string; posterUrl?: string; firstSceneImageUrl?: string;
  inputRevision: number; renderedRevision?: number; approvedRevision?: number; renderFresh: boolean; approvalFresh: boolean; mock: boolean;
  publishedPostId?: string; updatedAt: string; activeJob?: { status: string; progress: number } | null;
  _count: { scenes: number; jobs: number; versions: number };
};
type VideoJob = { id: string; type: string; provider: string; status: string; progress: number; error?: string; attempt?: number; createdAt?: string; updatedAt?: string };
type Project = ProjectSummary & { objective: string; caption?: string; hashtags?: string; staffProfileId?: string; voiceProfileId?: string; scenes: Scene[]; jobs: VideoJob[]; assets: Array<{ id: string; type: string; name: string; url: string }>; qualityReport?: { score: number; passed: boolean; issues: Array<{ code: string; severity: string; sceneId?: string; message: string; suggestion: string }> } };

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
  return <div className="fixed right-5 top-5 z-50 flex max-w-md items-start gap-3 rounded-[9px] border p-3 text-sm shadow-lg" style={{ background: "var(--bg-card)", borderColor: notice.type === "error" ? "var(--danger)" : "var(--accent)" }}>
    {notice.type === "error" ? <WarningCircle size={19} color="var(--danger)" /> : <CheckCircle size={19} color="var(--accent)" />}
    <span className="flex-1" style={{ color: "var(--text)" }}>{notice.text}</span>
    <button aria-label="Đóng thông báo" onClick={onClose}><X size={16} /></button>
  </div>;
}

export function VideoStudio({
  facebookPageId: providedPageId,
  canonicalView,
  canMutate = true,
  initialProjectId,
  initialSceneId,
  onProjectIdChange,
  onSceneIdChange,
}: VideoStudioProps = {}) {
  const { selectedPageId } = useActivePage();
  const facebookPageId = providedPageId ?? selectedPageId;
  const [tab, setTab] = useState<Tab>("projects");
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(initialProjectId ?? null);
  const [project, setProject] = useState<Project | null>(null);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [voices, setVoices] = useState<Voice[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [providers, setProviders] = useState<ProviderStatus | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: "error" | "success"; text: string } | null>(null);

  const qs = useMemo(() => `facebookPageId=${encodeURIComponent(facebookPageId || "")}`, [facebookPageId]);
  const loadProjects = useCallback(async () => setProjects(await api<ProjectSummary[]>(`/api/video-studio/projects?${qs}`)), [qs]);
  const loadProject = useCallback(async (id: string, signal?: AbortSignal) => setProject(await api<Project>(`/api/video-studio/projects/${id}`, { signal })), []);
  const loadReferenceData = useCallback(async () => {
    const [staffData, voiceData, skillData, providerData] = await Promise.all([
      api<Staff[]>(`/api/staff-visuals?${qs}`), api<Voice[]>(`/api/video-studio/voices?${qs}`),
      api<Skill[]>(`/api/video-studio/skills?${qs}`), api<ProviderStatus>("/api/video-studio/providers"),
    ]);
    setStaff(staffData); setVoices(voiceData); setSkills(skillData); setProviders(providerData);
  }, [qs]);

  useEffect(() => {
    setSelectedId(initialProjectId ?? null);
    setProject(null);
  }, [facebookPageId, initialProjectId]);

  useEffect(() => { loadProjects().catch((e) => setNotice({ type: "error", text: e.message })); loadReferenceData().catch(() => null); }, [loadProjects, loadReferenceData]);
  useEffect(() => {
    const controller = new AbortController();
    if (selectedId) {
      loadProject(selectedId, controller.signal).catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setNotice({ type: "error", text: error instanceof Error ? error.message : String(error) });
      });
    } else {
      setProject(null);
    }
    return () => controller.abort();
  }, [selectedId, loadProject]);

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

    {!canonicalView && (
      <nav className="flex gap-1 overflow-x-auto border-b" aria-label="Khu vực Video Studio" style={{ borderColor: "var(--border)" }}>
        {([ ["projects", FilmSlate, "Dự án"], ["learning", Brain, "Học từ video thật"], ["voices", Microphone, "Giọng đọc & quyền sử dụng"], ["readiness", Gear, "Trạng thái kết nối"] ] as const).map(([id, Icon, label]) =>
          <button key={id} onClick={() => setTab(id)} className="relative flex min-w-max items-center gap-2 px-4 py-3 text-sm font-semibold" style={{ color: tab === id ? "var(--accent)" : "var(--text-muted)" }}>
            <Icon size={17} weight={tab === id ? "fill" : "regular"} />{label}
            {tab === id && <span className="absolute inset-x-2 bottom-0 h-0.5" style={{ background: "var(--accent)" }} />}
          </button>)}
      </nav>
    )}

    {canonicalView === "overview" && <VideoOverview projects={projects} providers={providers} onSelect={(id) => onProjectIdChange?.(id)} />}
    {canonicalView === "review" && <VideoReview projects={projects} project={project} canMutate={canMutate} busy={busy} onSelect={(id) => onProjectIdChange?.(id)} onRun={run} />}
    {canonicalView === "jobs" && <VideoJobs projects={projects} project={project} onSelect={(id) => onProjectIdChange?.(id)} onRefresh={(id) => loadProject(id)} />}
    {(canonicalView === "projects" || (!canonicalView && tab === "projects")) && (project
      ? canMutate
        ? <ProjectWorkspace key={project.id} project={project} staff={staff} voices={voices} busy={busy} initialSceneId={initialSceneId} onSceneIdChange={onSceneIdChange} onBack={() => { setSelectedId(null); onProjectIdChange?.(undefined); }} onRun={run} onRefresh={() => loadProject(project.id)} />
        : <VideoProjectReadOnly project={project} onBack={() => { setSelectedId(null); onProjectIdChange?.(undefined); }} />
      : <ProjectsHome projects={projects} staff={staff} voices={voices} skills={skills} pageId={facebookPageId} busy={busy} canMutate={canMutate} onCreated={(id) => { loadProjects(); setSelectedId(id); onProjectIdChange?.(id); }} onSelect={(id) => { setSelectedId(id); onProjectIdChange?.(id); }} onError={(text) => setNotice({ type: "error", text })} />)}
    {!canonicalView && tab === "learning" && <LearningPanel projects={projects} skills={skills} pageId={facebookPageId} busy={busy} onRun={run} onReload={() => loadReferenceData()} />}
    {!canonicalView && tab === "voices" && <VoicePanel projects={projects} staff={staff} voices={voices} pageId={facebookPageId} busy={busy} onRun={run} onReload={() => loadReferenceData()} />}
    {!canonicalView && tab === "readiness" && <ProviderReadiness providers={providers} />}
  </div>;
}

function VideoOverview({ projects, providers, onSelect }: { projects: ProjectSummary[]; providers: ProviderStatus | null; onSelect: (id: string) => void }) {
  const activeJobs = projects.filter((item) => item.activeJob).length;
  const readyForReview = projects.filter((item) => item.renderFresh && (item.qualityScore ?? 0) >= 75 && !item.approvalFresh).length;
  const approved = projects.filter((item) => item.approvalFresh).length;
  return <div className="space-y-6">
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {[ ["Dự án", projects.length], ["Job đang chạy", activeJobs], ["Chờ duyệt", readyForReview], ["Đã duyệt đúng revision", approved] ].map(([label, value]) => <div key={String(label)} className="rounded-[11px] border border-[var(--border)] bg-[var(--bg-card)] p-4"><p className="text-xs text-[var(--text-muted)]">{label}</p><p className="mt-1 text-2xl font-bold text-[var(--text)]">{value}</p></div>)}
    </div>
    <ProviderReadiness providers={providers} />
    <section>
      <div className="mb-3"><h2 className="font-bold">Dự án cập nhật gần đây</h2><p className="text-xs text-[var(--text-muted)]">Mở dự án để tiếp tục storyboard và render.</p></div>
      <VideoProjectCards projects={projects.slice(0, 6)} onSelect={onSelect} emptyText="Chưa có dự án video." />
    </section>
  </div>;
}

function VideoReview({ projects, project, canMutate, busy, onSelect, onRun }: { projects: ProjectSummary[]; project: Project | null; canMutate: boolean; busy: string | null; onSelect: (id: string) => void; onRun: (key: string, work: () => Promise<unknown>, message?: string) => Promise<void> }) {
  if (!project) {
    const reviewProjects = projects.filter((item) => item.outputUrl || item.qualityScore != null || item.approvalStatus !== "draft");
    return <div className="space-y-3"><div><h2 className="font-bold">QA & Duyệt video</h2><p className="text-xs text-[var(--text-muted)]">Trạng thái render, QA và approval luôn được đối chiếu theo revision hiện tại.</p></div><VideoProjectCards projects={reviewProjects} onSelect={onSelect} emptyText="Chưa có video nào sẵn sàng để review." /></div>;
  }
  const canApprove = canMutate && Boolean(project.outputUrl) && !project.mock && project.renderFresh && (project.qualityScore ?? 0) >= 75 && !project.approvalFresh;
  return <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
    <section className="space-y-4"><button type="button" className="text-xs font-semibold text-[var(--accent)]" onClick={() => onSelect("")}>Quay lại danh sách review</button><div><h2 className="text-lg font-bold">{project.name}</h2><p className="text-xs text-[var(--text-muted)]">Revision {project.renderedRevision ?? "–"}/{project.inputRevision}</p></div>{project.outputUrl && !project.mock && project.renderFresh ? <video src={project.outputUrl} controls className="max-h-[68vh] w-full rounded-[11px] bg-[var(--side)]" /> : <div className="flex min-h-72 items-center justify-center rounded-[11px] border border-[var(--border)] bg-[var(--bg-subtle)] p-6 text-center text-sm text-[var(--text-muted)]">{project.mock ? "Output thử không thể duyệt để xuất bản." : project.outputUrl && !project.renderFresh ? "Render đã cũ so với revision hiện tại." : "Chưa có video đã render."}</div>}</section>
    <aside className="space-y-4 rounded-[11px] border border-[var(--border)] bg-[var(--bg-card)] p-4"><div className="flex flex-wrap gap-2"><MediaStatusBadge status={project.mock ? "mock" : project.renderFresh ? project.status : "stale"} /><MediaStatusBadge status={project.approvalFresh ? "approved" : project.approvalStatus} /></div><div><p className="text-xs text-[var(--text-muted)]">Điểm QA</p><p className="text-3xl font-bold">{project.qualityScore ?? "–"}<span className="text-sm font-normal text-[var(--text-muted)]">/100</span></p></div>{project.qualityReport?.issues?.map((issue) => <div key={`${issue.code}:${issue.sceneId ?? "project"}`} className="border-l-2 border-[var(--warning)] pl-3 text-xs"><p className="font-semibold">{issue.message}</p><p className="mt-1 text-[var(--text-muted)]">{issue.suggestion}</p></div>)}{!canMutate && <p className="rounded-[9px] bg-[var(--bg-subtle)] p-3 text-xs text-[var(--text-muted)]">Bạn có quyền xem nhưng không thể chạy QA hoặc duyệt.</p>}{canMutate && <><Button className="w-full" variant="secondary" loading={busy === "qa"} onClick={() => onRun("qa", () => api(`/api/video-studio/projects/${project.id}/quality`, { method: "POST" }), "Đã kiểm tra video")}>Kiểm tra lại QA</Button><Button className="w-full" disabled={!canApprove} loading={busy === "approve"} onClick={() => onRun("approve", () => api(`/api/video-studio/projects/${project.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ approvalStatus: "approved" }) }), "Video đã được duyệt")}>Duyệt revision hiện tại</Button></>}</aside>
  </div>;
}

function VideoJobs({ projects, project, onSelect, onRefresh }: { projects: ProjectSummary[]; project: Project | null; onSelect: (id: string) => void; onRefresh: (id: string) => Promise<void> }) {
  if (!project) {
    const projectsWithJobs = projects.filter((item) => item._count.jobs > 0);
    return <div className="space-y-3"><div><h2 className="font-bold">Công việc video</h2><p className="text-xs text-[var(--text-muted)]">Theo dõi render, voice, lip-sync và publish theo từng dự án.</p></div><VideoProjectCards projects={projectsWithJobs} onSelect={onSelect} emptyText="Chưa có công việc video nào." /></div>;
  }
  return <div className="space-y-4"><div className="flex items-start justify-between gap-3"><div><button type="button" className="text-xs font-semibold text-[var(--accent)]" onClick={() => onSelect("")}>Quay lại danh sách dự án</button><h2 className="mt-2 text-lg font-bold">{project.name}</h2><p className="text-xs text-[var(--text-muted)]">{project.jobs.length} công việc đã persist</p></div><Button variant="secondary" size="sm" onClick={() => onRefresh(project.id)}><ArrowClockwise size={14} />Làm mới</Button></div><div className="divide-y rounded-[11px] border border-[var(--border)] bg-[var(--bg-card)]">{project.jobs.length === 0 ? <p className="p-8 text-center text-sm text-[var(--text-muted)]">Dự án chưa có công việc.</p> : project.jobs.map((job) => <article key={job.id} className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_auto]"><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{job.type}</h3><Status value={job.status} /></div><p className="mt-1 text-xs text-[var(--text-muted)]">{job.provider} · Lần thử {job.attempt ?? 0}</p>{job.error && <p className="mt-2 text-xs text-[var(--danger)]">{job.error}</p>}</div><div className="text-right"><p className="text-lg font-bold tabular-nums">{job.progress}%</p><p className="text-[11px] text-[var(--text-muted)]">Tiến độ persist</p></div></article>)}</div></div>;
}

function VideoProjectReadOnly({ project, onBack }: { project: Project; onBack: () => void }) {
  return <div className="space-y-4"><button type="button" className="text-xs font-semibold text-[var(--accent)]" onClick={onBack}>Quay lại danh sách dự án</button><div><h2 className="text-lg font-bold">{project.name}</h2><p className="text-xs text-[var(--text-muted)]">{project.platform} · {project.aspectRatio} · {project.durationSec}s</p></div><div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]"><div className="space-y-2 rounded-[11px] border border-[var(--border)] bg-[var(--bg-card)] p-4"><p className="text-sm font-semibold">Storyboard</p>{project.scenes.length === 0 ? <p className="text-xs text-[var(--text-muted)]">Chưa có cảnh.</p> : project.scenes.map((scene) => <article key={scene.id} className="border-t border-[var(--border)] py-3 first:border-0"><div className="flex items-center justify-between gap-3"><p className="font-semibold">{scene.position + 1}. {scene.title}</p><Status value={scene.status} /></div><p className="mt-1 text-xs text-[var(--text-muted)]">{scene.durationSec}s · {SCENE_KIND_LABEL[scene.kind] || scene.kind}</p><p className="mt-2 whitespace-pre-wrap text-sm text-[var(--text-secondary)]">{scene.script}</p></article>)}</div><aside className="space-y-3 rounded-[11px] border border-[var(--border)] bg-[var(--bg-card)] p-4"><MediaStatusBadge status={project.mock ? "mock" : project.renderFresh ? project.status : "stale"} /><p className="text-xs text-[var(--text-muted)]">QA <strong className="text-[var(--text)]">{project.qualityScore ?? "Chưa kiểm tra"}</strong></p><p className="text-xs text-[var(--text-muted)]">Approval <strong className="text-[var(--text)]">{project.approvalFresh ? "Đúng revision" : "Chưa có hoặc đã cũ"}</strong></p><p className="rounded-[9px] bg-[var(--bg-subtle)] p-3 text-xs text-[var(--text-muted)]">Chế độ chỉ xem không cho phép sửa cảnh, render hoặc duyệt.</p></aside></div></div>;
}

function VideoProjectCards({ projects, onSelect, emptyText }: { projects: ProjectSummary[]; onSelect: (id: string) => void; emptyText: string }) {
  if (projects.length === 0) return <div className="flex min-h-48 items-center justify-center rounded-[11px] border border-[var(--border)] text-sm text-[var(--text-muted)]">{emptyText}</div>;
  return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{projects.map((item) => <MediaAssetCard key={item.id} kind="video" title={item.name} description={item.brief} thumbnailUrl={item.posterUrl} aspectRatio={item.aspectRatio} badges={<><MediaStatusBadge status={item.mock ? "mock" : item.outputUrl && !item.renderFresh ? "stale" : item.status} />{item.qualityScore != null && <Badge variant={item.qualityScore >= 75 ? "success" : "warning"}>QA {item.qualityScore}</Badge>}</>} metadata={<><span>{item._count.scenes} cảnh</span><span>Rev {item.renderedRevision ?? "–"}/{item.inputRevision}</span>{item.activeJob && <span>{item.activeJob.progress}%</span>}</>} onSelect={() => onSelect(item.id)} />)}</div>;
}

function ProjectsHome({ projects, staff, voices, skills, pageId, busy, canMutate, onCreated, onSelect, onError }: { projects: ProjectSummary[]; staff: Staff[]; voices: Voice[]; skills: Skill[]; pageId: string; busy: string | null; canMutate: boolean; onCreated: (id: string) => void; onSelect: (id: string) => void; onError: (text: string) => void }) {
  const [creating, setCreating] = useState(false);
  const [previewProject, setPreviewProject] = useState<ProjectSummary | null>(null);
  const showCreate = canMutate && (creating || projects.length === 0);
  const [form, setForm] = useState({ name: "", brief: "", objective: "booking", platform: "tiktok", aspectRatio: "9:16", durationSec: 30, staffProfileId: "", voiceProfileId: "", styleSkillIds: [] as string[] });
  const submit = async () => {
    try {
      const created = await api<ProjectSummary>("/api/video-studio/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, facebookPageId: pageId || null, staffProfileId: form.staffProfileId || null, voiceProfileId: form.voiceProfileId || null }) });
      onCreated(created.id);
    } catch (error) { onError(error instanceof Error ? error.message : String(error)); }
  };
  return <div className={cn("grid gap-6", showCreate && "xl:grid-cols-[minmax(0,1fr)_22rem]")}>
    <section>
      <div className="mb-4 flex items-center justify-between"><div><h2 className="text-base font-bold" style={{ color: "var(--text)" }}>Dự án gần đây</h2><p className="text-xs" style={{ color: "var(--text-muted)" }}>{projects.length} dự án trong Trang Facebook đang chọn</p></div>{canMutate && <Button size="sm" onClick={() => setCreating(true)}><Plus size={16} />Tạo dự án</Button>}</div>
      {projects.length === 0 ? <div className="flex min-h-72 flex-col items-center justify-center border-y text-center" style={{ borderColor: "var(--border)" }}><FilmSlate size={36} color="var(--text-muted)" /><p className="mt-3 font-semibold">Chưa có dự án video</p><p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>Nhập một mô tả ngắn, AutoSpa sẽ tạo kịch bản theo từng cảnh.</p></div>
      : <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">{projects.map((item) => {
        const cardStatus = item.mock ? "mock" : item.outputUrl && !item.renderFresh ? "stale" : item.status;
        return <MediaAssetCard
          key={item.id}
          kind="video"
          title={item.name}
          description={item.brief}
          thumbnailUrl={item.posterUrl}
          aspectRatio={item.aspectRatio}
          badges={<><MediaStatusBadge status={cardStatus} />{item.qualityScore != null && <Badge variant={item.qualityScore >= 75 ? "success" : "warning"}>QA {item.qualityScore}</Badge>}</>}
          metadata={<><span>{item._count.scenes} cảnh</span><span>{item.durationSec}s</span><span>{item.aspectRatio}</span><span>Rev {item.renderedRevision ?? "–"}/{item.inputRevision}</span>{item.activeJob && <span>{item.activeJob.status} {item.activeJob.progress}%</span>}{item.publishedPostId && <span>Đã xuất bản</span>}</>}
          onSelect={() => setPreviewProject(item)}
        />;
      })}</div>}
      <MediaPreviewDialog
        open={Boolean(previewProject)}
        onOpenChange={(open) => { if (!open) setPreviewProject(null); }}
        title={previewProject?.name || "Dự án video"}
        description={previewProject?.brief}
        kind="video"
        mediaUrl={previewProject?.renderFresh ? previewProject.outputUrl : null}
        posterUrl={previewProject?.posterUrl}
        aspectRatio={previewProject?.aspectRatio}
        details={previewProject ? <div className="space-y-3 text-xs"><div className="flex flex-wrap gap-2"><MediaStatusBadge status={previewProject.mock ? "mock" : previewProject.outputUrl && !previewProject.renderFresh ? "stale" : previewProject.status} /><MediaStatusBadge status={previewProject.approvalFresh ? "approved" : previewProject.approvalStatus} /></div><dl className="space-y-2"><div className="flex justify-between gap-3"><dt className="text-[var(--text-muted)]">Nền tảng</dt><dd>{previewProject.platform}</dd></div><div className="flex justify-between gap-3"><dt className="text-[var(--text-muted)]">Thời lượng</dt><dd>{previewProject.durationSec}s</dd></div><div className="flex justify-between gap-3"><dt className="text-[var(--text-muted)]">Revision</dt><dd>{previewProject.renderedRevision ?? "–"}/{previewProject.inputRevision}</dd></div><div className="flex justify-between gap-3"><dt className="text-[var(--text-muted)]">QA</dt><dd>{previewProject.qualityScore ?? "Chưa kiểm tra"}</dd></div></dl></div> : null}
        actions={previewProject ? <Button className="w-full" onClick={() => { const id = previewProject.id; setPreviewProject(null); onSelect(id); }}><Play size={16} />Mở dự án</Button> : null}
      />
    </section>
    <aside className={cn("border-l pl-6", showCreate ? "block" : "hidden")} style={{ borderColor: "var(--border)" }}>
      <div className="mb-4 flex items-center justify-between"><div><h2 className="font-bold">Brief mới</h2><p className="text-xs" style={{ color: "var(--text-muted)" }}>AI sẽ chia thành các cảnh có thể sửa</p></div>{projects.length > 0 && <button onClick={() => setCreating(false)} aria-label="Đóng"><X size={18} /></button>}</div>
      <div className="space-y-4"><Input label="Tên dự án" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Video liệu trình phục hồi da" /><Textarea label="Mục tiêu và nội dung" rows={5} value={form.brief} onChange={(e) => setForm({ ...form, brief: e.target.value })} placeholder="Video 30 giây cho khách nữ 25-35 tuổi, tập trung quy trình thật và lời mời tư vấn nhẹ..." />
        <div className="grid grid-cols-2 gap-3"><Select label="Mục tiêu" value={form.objective} onChange={(e) => setForm({ ...form, objective: e.target.value })}><option value="booking">Đặt lịch</option><option value="lead">Tin nhắn</option><option value="awareness">Nhận diện</option><option value="engagement">Tương tác</option></Select><Select label="Nền tảng" value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })}><option value="tiktok">TikTok</option><option value="instagram">Instagram</option><option value="facebook">Facebook</option><option value="multi">Đa nền tảng</option></Select></div>
        <div className="grid grid-cols-2 gap-3"><Select label="Tỉ lệ" value={form.aspectRatio} onChange={(e) => setForm({ ...form, aspectRatio: e.target.value })}><option>9:16</option><option>1:1</option><option>16:9</option></Select><Input label="Thời lượng" type="number" min={10} max={180} value={form.durationSec} onChange={(e) => setForm({ ...form, durationSec: Number(e.target.value) })} /></div>
        <Select label="Nhân viên" value={form.staffProfileId} onChange={(e) => setForm({ ...form, staffProfileId: e.target.value })}><option value="">Chưa chọn</option>{staff.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select>
        <Select label="Giọng đọc" value={form.voiceProfileId} onChange={(e) => setForm({ ...form, voiceProfileId: e.target.value })}><option value="">Chưa chọn</option>{voices.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select>
        {skills.some((skill) => skill.status === "approved") && <div><p className="mb-2 text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>Phong cách đã học</p><div className="flex flex-wrap gap-2">{skills.filter((skill) => skill.status === "approved").slice(0, 6).map((skill) => <button key={skill.id} type="button" onClick={() => setForm({ ...form, styleSkillIds: form.styleSkillIds.includes(skill.id) ? form.styleSkillIds.filter((id) => id !== skill.id) : [...form.styleSkillIds, skill.id] })} className="rounded-[9px] border px-2 py-1 text-xs" style={{ borderColor: form.styleSkillIds.includes(skill.id) ? "var(--accent)" : "var(--border)", color: form.styleSkillIds.includes(skill.id) ? "var(--accent)" : "var(--text-secondary)" }}>{skill.name}</button>)}</div></div>}
        <Button className="w-full" loading={busy === "create"} disabled={form.name.length < 2 || form.brief.length < 10} onClick={submit}><MagicWand size={17} />Tạo dự án video</Button>
      </div>
    </aside>
  </div>;
}

function ProjectWorkspace({ project, staff, voices, busy, initialSceneId, onSceneIdChange, onBack, onRun, onRefresh }: { project: Project; staff: Staff[]; voices: Voice[]; busy: string | null; initialSceneId?: string; onSceneIdChange?: (sceneId?: string) => void; onBack: () => void; onRun: (key: string, work: () => Promise<unknown>, message?: string) => Promise<void>; onRefresh: () => Promise<void> }) {
  const [activeSceneId, setActiveSceneId] = useState(initialSceneId || project.scenes[0]?.id || "");
  const scene = project.scenes.find((item) => item.id === activeSceneId) || project.scenes[0];
  useEffect(() => {
    if (initialSceneId) setActiveSceneId(initialSceneId);
  }, [initialSceneId]);
  useEffect(() => {
    if (!project.scenes.some((item) => item.id === activeSceneId)) {
      setActiveSceneId(project.scenes[0]?.id || "");
    }
  }, [project.scenes, activeSceneId]);
  const post = (url: string, body?: unknown) => api(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const patchScene = async (id: string, data: Partial<Scene>) => { await api(`/api/video-studio/scenes/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }); await onRefresh(); };
  const activeJobs = project.jobs.filter((job) => ["queued", "processing"].includes(job.status));
  const uploadMusic = async (file: File) => {
    const form = new FormData(); form.set("file", file); form.set("projectId", project.id); form.set("purpose", "music");
    await api("/api/video-studio/upload", { method: "POST", body: form });
  };
  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><button onClick={onBack} className="rounded-[9px] p-2 hover:bg-[var(--bg-subtle)]" aria-label="Quay lại"><X size={18} /></button><div><div className="flex items-center gap-2"><h2 className="text-lg font-bold">{project.name}</h2><Status value={project.status} /></div><p className="text-xs" style={{ color: "var(--text-muted)" }}>{project.platform} · {project.aspectRatio} · {project.durationSec}s</p></div></div>
      <div className="flex flex-wrap gap-2"><Button variant="secondary" size="sm" onClick={() => onRun("storyboard", () => post(`/api/video-studio/projects/${project.id}/storyboard`), "Kịch bản phân cảnh đã được cập nhật")} loading={busy === "storyboard"}><Sparkle size={16} />Tạo kịch bản phân cảnh</Button><Button variant="secondary" size="sm" onClick={() => onRun("qa", () => post(`/api/video-studio/projects/${project.id}/quality`), "Đã kiểm tra video")} loading={busy === "qa"}><CheckCircle size={16} />Kiểm tra</Button><Button size="sm" onClick={() => onRun("render", () => post(`/api/video-studio/projects/${project.id}/render`), "Video đã được đưa vào hàng đợi dựng")} loading={busy === "render"}><FilmSlate size={16} />Dựng video</Button></div>
    </div>

    <div className="grid gap-3 sm:grid-cols-5">{[["01", "Kịch bản", project.scenes.length > 0], ["02", "Cảnh", project.scenes.some((s) => s.generatedVideoUrl)], ["03", "Giọng đọc", project.scenes.filter((s) => s.kind === "talking").every((s) => s.audioUrl)], ["04", "Khẩu hình", project.scenes.filter((s) => s.kind === "talking").every((s) => s.lipSyncVideoUrl)], ["05", "Duyệt", project.approvalStatus === "approved"]].map(([num, label, done]) => <div key={String(num)} className="border-t-2 pt-2" style={{ borderColor: done ? "var(--accent)" : "var(--border)" }}><span className="text-[10px] font-bold" style={{ color: done ? "var(--accent)" : "var(--text-muted)" }}>{num}</span><p className="text-xs font-semibold">{label}</p></div>)}</div>

    {activeJobs.length > 0 && <div className="flex flex-wrap items-center gap-3 border-y px-1 py-3 text-xs" style={{ borderColor: "var(--border)" }}><Spinner className="animate-spin" size={16} color="var(--warning)" /><strong>{activeJobs.length} tác vụ đang chạy</strong>{activeJobs.map((job) => <button key={job.id} onClick={() => onRun(`refresh-${job.id}`, () => api(`/api/video-studio/jobs/${job.id}`))} className="underline" style={{ color: "var(--text-secondary)" }}>{job.provider} {job.progress}%</button>)}</div>}

    <div className="grid min-h-[34rem] gap-5 lg:grid-cols-[19rem_minmax(0,1fr)_19rem]">
      <aside className="border-r pr-4" style={{ borderColor: "var(--border)" }}><div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-bold">Timeline</h3><span className="text-xs tabular-nums" style={{ color: "var(--text-muted)" }}>{project.scenes.reduce((sum, item) => sum + item.durationSec, 0)}s</span></div>
        {project.scenes.length === 0 ? <div className="py-12 text-center text-sm" style={{ color: "var(--text-muted)" }}>Tạo kịch bản phân cảnh để bắt đầu.</div> : <div className="space-y-1">{project.scenes.map((item) => <button key={item.id} onClick={() => { setActiveSceneId(item.id); onSceneIdChange?.(item.id); }} className="grid w-full grid-cols-[2rem_1fr_auto] items-center gap-2 rounded-[9px] px-2 py-3 text-left" style={{ background: activeSceneId === item.id ? "var(--accent-light)" : "transparent" }}><span className="font-mono text-xs" style={{ color: "var(--text-muted)" }}>{String(item.position + 1).padStart(2, "0")}</span><span className="min-w-0"><span className="block truncate text-sm font-semibold">{item.title}</span><span className="block text-[11px]" style={{ color: "var(--text-muted)" }}>{SCENE_KIND_LABEL[item.kind] || item.kind} · {item.durationSec} giây</span></span><span className="h-2 w-2 rounded-full" style={{ background: item.status === "ready" ? "var(--green)" : item.status.includes("ing") ? "var(--warning)" : "var(--border-strong)" }} /></button>)}</div>}
      </aside>

      <main className="min-w-0">{scene ? <SceneEditor projectId={project.id} scene={scene} staff={staff} voices={voices} busy={busy} onPatch={patchScene} onRun={onRun} onRefresh={onRefresh} /> : <div className="flex h-full items-center justify-center text-sm" style={{ color: "var(--text-muted)" }}>Chưa có cảnh được chọn</div>}</main>

      <aside className="border-l pl-4" style={{ borderColor: "var(--border)" }}><h3 className="mb-4 text-sm font-bold">Hoàn thiện</h3>
        <div className="space-y-4"><div><p className="mb-1 text-xs font-semibold">Điểm chất lượng</p><div className="flex items-end gap-2"><strong className="text-3xl tabular-nums" style={{ color: (project.qualityScore || 0) >= 75 ? "var(--accent)" : "var(--warning)" }}>{project.qualityScore ?? "--"}</strong><span className="pb-1 text-xs" style={{ color: "var(--text-muted)" }}>/100</span></div></div>
          <label className="flex cursor-pointer items-center gap-2 rounded-[9px] border border-dashed p-3 text-xs font-semibold" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}><Waveform size={17} color="var(--accent)" /><span className="min-w-0 flex-1 truncate">{project.assets.find((asset) => asset.type === "music")?.name || "Thêm nhạc nền"}</span><input type="file" accept="audio/mpeg,audio/wav,audio/mp4" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) onRun("upload-music", () => uploadMusic(file), "Đã thêm nhạc nền"); event.target.value = ""; }} /></label>
          {project.qualityReport?.issues?.slice(0, 5).map((issue) => <div key={`${issue.code}-${issue.sceneId}`} className="border-l-2 pl-3 text-xs" style={{ borderColor: issue.severity === "blocking" ? "var(--danger)" : "var(--warning)" }}><p className="font-semibold">{issue.message}</p><p className="mt-1" style={{ color: "var(--text-muted)" }}>{issue.suggestion}</p></div>)}
          {project.outputUrl && <div><p className="mb-2 text-xs font-semibold">Video đã dựng</p>{project.outputUrl.startsWith("mock://") ? <div className="flex aspect-[9/16] max-h-64 items-center justify-center rounded-[9px] bg-[var(--bg-subtle)] text-center text-xs" style={{ color: "var(--text-muted)" }}>Bản xem trước ở chế độ thử<br />Tắt chế độ thử để xuất tệp MP4</div> : <video src={project.outputUrl} controls className="max-h-64 w-full rounded-[9px] bg-[var(--side)]" />}</div>}
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
  return <div className="space-y-5"><div className="flex items-start justify-between gap-3"><div><div className="mb-1 flex items-center gap-2"><Status value={scene.status} /><span className="text-xs" style={{ color: "var(--text-muted)" }}>Cảnh {scene.position + 1}</span></div><input className="w-full bg-transparent text-lg font-bold outline-none" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} onBlur={() => draft.title !== scene.title && onPatch(scene.id, { title: draft.title })} /></div><div className="flex items-center gap-1"><button title="Đưa cảnh lên" aria-label="Đưa cảnh lên" onClick={() => action("move-up")} className="rounded-[9px] border p-1.5" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}><ArrowUp size={14} /></button><button title="Đưa cảnh xuống" aria-label="Đưa cảnh xuống" onClick={() => action("move-down")} className="rounded-[9px] border p-1.5" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}><ArrowDown size={14} /></button><button onClick={() => onPatch(scene.id, { locked: !scene.locked })} className="rounded-[9px] border px-2 py-1 text-xs" style={{ borderColor: scene.locked ? "var(--accent)" : "var(--border)", color: scene.locked ? "var(--accent)" : "var(--text-muted)" }}>{scene.locked ? "Đã khóa" : "Khóa cảnh"}</button></div></div>
    <div className="grid gap-3 sm:grid-cols-3"><Select label="Loại cảnh" value={draft.kind} onChange={(e) => { const kind = e.target.value; setDraft({ ...draft, kind }); onPatch(scene.id, { kind }); }}><option value="talking">Nhân viên nói</option><option value="broll">B-roll</option><option value="title">Tiêu đề</option><option value="cta">CTA</option></Select><Input label="Thời lượng (giây)" type="number" min={1} max={30} value={draft.durationSec} onChange={(e) => setDraft({ ...draft, durationSec: Number(e.target.value) })} onBlur={() => onPatch(scene.id, { durationSec: draft.durationSec })} /><Select label="Nhân viên" value={draft.staffProfileId || ""} onChange={(e) => { const value = e.target.value; const selected = staff.find((item) => item.id === value); setDraft({ ...draft, staffProfileId: value, sourceImageUrl: selected?.referenceImageUrl }); onPatch(scene.id, { staffProfileId: value || undefined, sourceImageUrl: selected?.referenceImageUrl }); }}><option value="">Không dùng</option>{staff.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></div>
    {scene.kind === "talking" && <Select label="Giọng đọc" value={draft.voiceProfileId || ""} onChange={(e) => { setDraft({ ...draft, voiceProfileId: e.target.value }); onPatch(scene.id, { voiceProfileId: e.target.value }); }}><option value="">Chọn giọng đọc</option>{voices.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select>}
    <Textarea label="Lời thoại" rows={5} value={draft.script} onChange={(e) => setDraft({ ...draft, script: e.target.value })} onBlur={() => draft.script !== scene.script && onPatch(scene.id, { script: draft.script })} hint="Viết như lời nói thật; dấu câu quyết định nhịp đọc." />
    <Textarea label="Chỉ đạo hình ảnh" rows={4} value={draft.visualPrompt} onChange={(e) => setDraft({ ...draft, visualPrompt: e.target.value })} onBlur={() => draft.visualPrompt !== scene.visualPrompt && onPatch(scene.id, { visualPrompt: draft.visualPrompt })} />
    <div className="grid gap-3 sm:grid-cols-4"><Button variant="secondary" loading={busy === `generate-video-${scene.id}`} onClick={() => action("generate-video")}><VideoCamera size={17} />Tạo cảnh bằng Runway</Button><label className="flex min-h-9 cursor-pointer items-center justify-center gap-2 rounded-[9px] border px-3 text-sm font-semibold" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}><CloudArrowUp size={17} />Tải cảnh thật lên<input type="file" accept="video/mp4,video/quicktime,video/webm" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) onRun(`upload-${scene.id}`, () => uploadSceneVideo(file), "Cảnh quay thật đã được thêm vào"); event.target.value = ""; }} /></label><Button variant="secondary" disabled={scene.kind !== "talking" || !scene.voiceProfileId} loading={busy === `generate-voice-${scene.id}`} onClick={() => action("generate-voice")}><Waveform size={17} />Tạo giọng đọc</Button><Button variant="secondary" disabled={scene.kind !== "talking" || !scene.audioUrl || !(scene.generatedVideoUrl || scene.sourceVideoUrl || selectedStaff?.referenceImageUrl)} loading={busy === `lip-sync-${scene.id}`} onClick={() => action("lip-sync")}><UserCircle size={17} />Khớp khẩu hình</Button></div>
    <div className="grid grid-cols-3 gap-3 border-t pt-4 text-center text-xs" style={{ borderColor: "var(--border)" }}><div><ImageSquare size={18} className="mx-auto mb-1" color={scene.generatedVideoUrl || scene.sourceVideoUrl ? "var(--accent)" : "var(--text-muted)"} />Cảnh</div><div><Microphone size={18} className="mx-auto mb-1" color={scene.audioUrl ? "var(--accent)" : "var(--text-muted)"} />Giọng đọc</div><div><Subtitles size={18} className="mx-auto mb-1" color={scene.lipSyncVideoUrl ? "var(--accent)" : "var(--text-muted)"} />Khẩu hình</div></div>
    <button onClick={onRefresh} className="flex items-center gap-2 text-xs" style={{ color: "var(--text-muted)" }}><ArrowClockwise size={14} />Làm mới trạng thái</button>
  </div>;
}

function LearningPanel({ projects, skills, busy, onRun, onReload }: { projects: ProjectSummary[]; skills: Skill[]; pageId: string; busy: string | null; onRun: (key: string, work: () => Promise<unknown>, message?: string) => Promise<void>; onReload: () => Promise<void> }) {
  const [projectId, setProjectId] = useState(projects[0]?.id || ""); const [file, setFile] = useState<File | null>(null);
  const analyze = async () => { if (!file || !projectId) throw new Error("Chọn dự án và video thật"); const form = new FormData(); form.set("file", file); form.set("projectId", projectId); form.set("purpose", "source_video"); const asset = await api<{ id: string }>("/api/video-studio/upload", { method: "POST", body: form }); await api("/api/video-studio/learning", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectId, assetId: asset.id }) }); await onReload(); };
  return <div className="grid gap-8 lg:grid-cols-[21rem_minmax(0,1fr)]"><aside className="border-r pr-6" style={{ borderColor: "var(--border)" }}><h2 className="font-bold">Thêm video thật</h2><p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>Hệ thống sẽ đề xuất các kỹ năng rút ra từ video. Bạn cần duyệt trước khi bộ não áp dụng.</p><div className="mt-5 space-y-4"><Select label="Dự án chứa video" value={projectId} onChange={(e) => setProjectId(e.target.value)}><option value="">Chọn dự án</option>{projects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select><label className="flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-[9px] border border-dashed p-5 text-center"><CloudArrowUp size={28} color="var(--accent)" /><span className="mt-2 text-sm font-semibold">{file?.name || "Chọn tệp MP4, MOV hoặc WebM"}</span><span className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>Dung lượng tối đa 150 MB</span><input type="file" accept="video/mp4,video/quicktime,video/webm" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] || null)} /></label><Button className="w-full" disabled={!file || !projectId} loading={busy === "learn"} onClick={() => onRun("learn", analyze, "Video đã được đưa vào hàng đợi phân tích")}><Brain size={17} />Phân tích và đề xuất kỹ năng</Button></div></aside>
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
  return <div className="grid gap-8 lg:grid-cols-[22rem_minmax(0,1fr)]"><aside className="border-r pr-6" style={{ borderColor: "var(--border)" }}><h2 className="font-bold">Tạo giọng đọc</h2><p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>Chỉ sao chép giọng khi nhân viên đã đồng ý rõ phạm vi và thời hạn sử dụng.</p><div className="mt-5 space-y-4"><Select label="Dự án lưu mẫu" value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value })}><option value="">Chọn dự án</option>{projects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select><Select label="Nhân viên" value={form.staffId} onChange={(e) => setForm({ ...form, staffId: e.target.value })}><option value="">Chọn nhân viên</option>{staff.filter((item) => item.consentStatus === "consented").map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select><Input label="Tên giọng đọc" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Lan - tư vấn nhẹ nhàng" /><label className="flex cursor-pointer items-center gap-3 rounded-[9px] border border-dashed p-4"><Microphone size={22} color="var(--accent)" /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{file?.name || "Tải mẫu MP3 hoặc WAV lên"}</span><span className="block text-xs" style={{ color: "var(--text-muted)" }}>Bản thu rõ tiếng, không có nhạc nền</span></span><input type="file" accept="audio/mpeg,audio/wav,audio/mp4" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] || null)} /></label><Textarea label="Bằng chứng đồng ý" rows={3} value={form.consentNote} onChange={(e) => setForm({ ...form, consentNote: e.target.value })} placeholder="Ngày ký, hình thức xác nhận và phạm vi nhân viên đã đồng ý..." /><label className="flex items-start gap-2 text-xs" style={{ color: "var(--text-secondary)" }}><input type="checkbox" className="mt-0.5" checked={form.consentConfirmed} onChange={(e) => setForm({ ...form, consentConfirmed: e.target.checked })} /><span>Tôi xác nhận nhân viên đã đồng ý cho sao chép giọng, khớp khẩu hình và sử dụng trong quảng cáo trong 12 tháng.</span></label><Button className="w-full" disabled={!file || !form.staffId || !form.projectId || !form.consentConfirmed || form.consentNote.trim().length < 20} loading={busy === "voice-create"} onClick={() => onRun("voice-create", create, "Đã tạo giọng đọc")}><Waveform size={17} />Xác nhận và tạo giọng</Button></div></aside>
    <section><h2 className="font-bold">Thư viện giọng đọc</h2><p className="mb-4 text-xs" style={{ color: "var(--text-muted)" }}>{voices.length} giọng đọc đang hoạt động</p><div className="grid gap-px overflow-hidden rounded-[9px] border bg-[var(--border)] sm:grid-cols-2 xl:grid-cols-3" style={{ borderColor: "var(--border)" }}>{voices.map((voice) => { const person = staff.find((item) => item.id === voice.staffProfileId); return <article key={voice.id} className="min-h-36 bg-[var(--bg-card)] p-4"><div className="flex items-start justify-between"><div className="flex h-9 w-9 items-center justify-center rounded-[9px] bg-[var(--accent-light)]"><Waveform size={19} color="var(--accent)" /></div><Status value={voice.status} /></div><h3 className="mt-4 font-semibold">{voice.name}</h3><p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>{person?.name || "Giọng hệ thống"} · ElevenLabs</p><p className="mt-3 text-[11px]" style={{ color: voice.providerVoiceId ? "var(--green)" : "var(--warning)" }}>{voice.providerVoiceId ? "Đã sẵn sàng sử dụng" : "Chưa kết nối với ElevenLabs"}</p></article>; })}{voices.length === 0 && <p className="col-span-full bg-[var(--bg-card)] py-16 text-center text-sm" style={{ color: "var(--text-muted)" }}>Chưa có giọng đọc nào.</p>}</div></section>
  </div>;
}

function ProviderReadiness({ providers }: { providers: ProviderStatus | null }) {
  const items = [
    { id: "runway", label: "Runway", purpose: "Tạo cảnh video" },
    { id: "elevenLabs", label: "ElevenLabs", purpose: "Tạo giọng đọc" },
    { id: "sync", label: "Sync Labs", purpose: "Đồng bộ khẩu hình" },
    { id: "ffmpeg", label: "FFmpeg", purpose: "Dựng tệp video cuối" },
  ];
  return <div className="max-w-3xl space-y-5">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><h2 className="font-bold">Trạng thái dịch vụ video</h2><p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>Cấu hình kỹ thuật được quản lý tập trung tại Cài đặt & Kết nối.</p></div>
      <Link href="/system/settings?view=video&scope=account" className="inline-flex min-h-11 items-center justify-center rounded-[9px] bg-[var(--accent)] px-4 text-sm font-semibold text-[var(--accent-foreground)]">Mở cài đặt video</Link>
    </div>
    {!providers ? <div className="flex min-h-48 items-center justify-center"><Spinner size={24} className="animate-spin" /></div> : <>
      <div className="rounded-[9px] border p-4" style={{ borderColor: "var(--border)", background: "var(--bg-subtle)" }}>
        <div className="flex items-center justify-between gap-3"><div><p className="font-semibold">Chế độ vận hành</p><p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>{providers.mockMode ? "Output thử không thể xuất bản" : "Tác vụ có thể gọi dịch vụ thật và phát sinh chi phí"}</p></div><Badge variant={providers.mockMode ? "warning" : "success"}>{providers.mockMode ? "Chế độ thử" : "Dịch vụ thật"}</Badge></div>
        <p className="mt-3 text-xs" style={{ color: "var(--text-muted)" }}>Ngân sách bảo vệ: ${providers.budgetUsd} / dự án</p>
      </div>
      <div className="divide-y border-y" style={{ borderColor: "var(--border)" }}>{items.map((item) => { const status = providers.providers[item.id]; return <div key={item.id} className="flex min-h-16 items-center justify-between gap-3 py-3"><div><p className="font-semibold">{item.label}</p><p className="text-xs" style={{ color: "var(--text-muted)" }}>{item.purpose} · {status?.model || "Không rõ model"}</p></div><Badge variant={status?.configured ? "success" : "neutral"}>{status?.configured ? "Sẵn sàng" : "Chưa cấu hình"}</Badge></div>; })}</div>
    </>}
  </div>;
}
