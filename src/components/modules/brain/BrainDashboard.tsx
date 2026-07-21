"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Brain, Sparkle, ShieldCheck, ClockCounterClockwise, CheckCircle,
  PauseCircle, PlayCircle, WarningCircle, ArrowsClockwise,
  GraduationCap, MapTrifold, ListChecks, Pulse, SealCheck,
} from "@phosphor-icons/react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import { formatDateTime } from "@/lib/utils";

type Tab = "map" | "skills" | "teach" | "runs";

interface BrainSkill {
  id: string;
  name: string;
  description: string | null;
  domain: string;
  category: string;
  tags: string[];
  inputSignals: string[];
  triggerType: string;
  triggerConfig: Record<string, unknown>;
  playbook: string;
  tools: string[];
  successMetric: string | null;
  permissionLevel: string;
  riskLevel: string;
  confidence: number;
  classificationConfidence: number;
  status: string;
  learnedFrom: string;
  councilNotes: string | null;
  updatedAt: string;
  lastRun?: { status: string; startedAt: string } | null;
  lastOutcome?: { status: string; createdAt: string; notes: string | null } | null;
}

interface BrainMapNode {
  domain: string;
  label: string;
  description: string;
  color: string;
  total: number;
  active: number;
  draft: number;
  skills: Array<{
    id: string;
    name: string;
    category: string;
    confidence: number;
    riskLevel: string;
    permissionLevel: string;
    status: string;
    updatedAt: string;
  }>;
}

interface Summary {
  counts: { total: number; active: number; draft: number; highRisk: number };
  map: BrainMapNode[];
  skills: BrainSkill[];
  recentRuns: Array<{ id: string; action: string; status: string; startedAt: string; skill: { name: string; domain: string } }>;
  recentOutcomes: Array<{ id: string; metric: string; status: string; notes: string | null; createdAt: string; skill: { name: string; domain: string } }>;
}

const TABS: Array<{ id: Tab; label: string; icon: React.ElementType }> = [
  { id: "map", label: "Brain Map", icon: MapTrifold },
  { id: "skills", label: "Skills", icon: ListChecks },
  { id: "teach", label: "Teach", icon: GraduationCap },
  { id: "runs", label: "Runs", icon: Pulse },
];

const STATUS_LABEL: Record<string, string> = {
  active: "Đang dùng",
  draft: "Nháp",
  paused: "Tạm dừng",
  deprecated: "Cũ",
};

const RISK_LABEL: Record<string, string> = {
  low: "Rủi ro thấp",
  medium: "Cần giám sát",
  high: "Rủi ro cao",
};

function badgeStyle(tone: string) {
  if (tone === "active" || tone === "success") return { background: "var(--accent-light)", color: "var(--accent)" };
  if (tone === "draft" || tone === "queued" || tone === "pending") return { background: "var(--amber-light)", color: "var(--amber)" };
  if (tone === "high" || tone === "fail" || tone === "failed") return { background: "var(--rose-light)", color: "var(--rose)" };
  if (tone === "supervised" || tone === "auto") return { background: "var(--premium-light)", color: "var(--premium)" };
  return { background: "var(--bg-subtle)", color: "var(--text-secondary)" };
}

function Pill({ children, tone = "default" }: { children: React.ReactNode; tone?: string }) {
  return (
    <span className="inline-flex items-center px-2 py-1 rounded-md text-[11px] font-semibold" style={badgeStyle(tone)}>
      {children}
    </span>
  );
}

function confidencePct(value: number) {
  return `${Math.round(value * 100)}%`;
}

export function BrainDashboard() {
  const [tab, setTab] = useState<Tab>("map");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [teaching, setTeaching] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [teachResult, setTeachResult] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/brain");
      const json = await res.json();
      if (json.success) setSummary(json.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const teach = async () => {
    if (!instruction.trim()) return;
    setTeaching(true);
    setTeachResult(null);
    try {
      const res = await fetch("/api/brain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "teach", instruction, source: "manual" }),
      });
      const json = await res.json();
      if (json.success) {
        setTeachResult(`Đã học skill "${json.data.name}" vào nhóm ${json.data.domain}. Trạng thái: ${STATUS_LABEL[json.data.status] ?? json.data.status}.`);
        setInstruction("");
        await load();
        setTab("map");
      } else {
        setTeachResult(json.error ?? "Không tạo được skill");
      }
    } finally {
      setTeaching(false);
    }
  };

  const updateStatus = async (id: string, status: string) => {
    setSavingId(id);
    try {
      await fetch("/api/brain", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status, note: `Set ${status} from Brain dashboard` }),
      });
      await load();
    } finally {
      setSavingId(null);
    }
  };

  const recordOutcome = async (skillId: string, status: "success" | "fail" | "neutral") => {
    setSavingId(skillId);
    try {
      await fetch("/api/brain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "outcome", skillId, status, notes: "Manual feedback từ Brain dashboard" }),
      });
      await load();
    } finally {
      setSavingId(null);
    }
  };

  const skills = useMemo(() => {
    const list = summary?.skills ?? [];
    if (filter === "all") return list;
    return list.filter((skill) => skill.domain === filter || skill.status === filter || skill.riskLevel === filter);
  }, [summary, filter]);

  return (
    <>
      <PageHeader
        title="AutoSpa Brain"
        description="Dạy skill mới, phân nhóm tự động, theo dõi sơ đồ bộ não và hiệu quả sau khi chạy."
        action={
          <Button variant="secondary" onClick={load} loading={loading}>
            <ArrowsClockwise size={14} /> Làm mới
          </Button>
        }
      />

      <div className="space-y-5 max-w-7xl">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <MetricCard icon={Brain} label="Tổng skill" value={summary?.counts.total ?? 0} color="var(--premium)" />
          <MetricCard icon={SealCheck} label="Đang dùng" value={summary?.counts.active ?? 0} color="var(--accent)" />
          <MetricCard icon={ClockCounterClockwise} label="Đang nháp" value={summary?.counts.draft ?? 0} color="var(--amber)" />
          <MetricCard icon={WarningCircle} label="Rủi ro cao" value={summary?.counts.highRisk ?? 0} color="var(--rose)" />
        </div>

        <div className="flex flex-wrap gap-2">
          {TABS.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setTab(item.id)}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-md text-xs font-semibold transition-colors"
                style={tab === item.id
                  ? { background: "var(--accent)", color: "white" }
                  : { background: "var(--bg-card)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}
              >
                <Icon size={14} weight="fill" />
                {item.label}
              </button>
            );
          })}
        </div>

        {tab === "map" && <BrainMap nodes={summary?.map ?? []} loading={loading} />}
        {tab === "skills" && (
          <SkillsList
            skills={skills}
            filter={filter}
            setFilter={setFilter}
            savingId={savingId}
            updateStatus={updateStatus}
            recordOutcome={recordOutcome}
          />
        )}
        {tab === "teach" && (
          <TeachPanel
            instruction={instruction}
            setInstruction={setInstruction}
            teaching={teaching}
            teachResult={teachResult}
            teach={teach}
          />
        )}
        {tab === "runs" && <RunsPanel summary={summary} />}
      </div>
    </>
  );
}

function MetricCard({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: number; color: string }) {
  return (
    <Card padding="sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>{label}</p>
          <p className="text-2xl font-extrabold tabular-nums mt-1" style={{ color: "var(--text)" }}>{value}</p>
        </div>
        <div className="w-9 h-9 rounded-md flex items-center justify-center" style={{ background: `color-mix(in srgb, ${color} 14%, transparent)`, color }}>
          <Icon size={18} weight="fill" />
        </div>
      </div>
    </Card>
  );
}

function BrainMap({ nodes, loading }: { nodes: BrainMapNode[]; loading: boolean }) {
  if (loading) {
    return <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">{[1, 2, 3, 4, 5, 6].map((i) => <div key={i} className="skeleton h-48 rounded-lg" />)}</div>;
  }

  return (
    <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
      {nodes.map((node) => (
        <Card key={node.domain} className="overflow-hidden">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-md flex items-center justify-center shrink-0" style={{ background: `color-mix(in srgb, ${node.color} 14%, transparent)`, color: node.color }}>
              <Brain size={18} weight="fill" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-base font-bold">{node.label}</h2>
                <Pill tone={node.active > 0 ? "active" : "draft"}>{node.active}/{node.total}</Pill>
              </div>
              <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{node.description}</p>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            {node.skills.length === 0 ? (
              <div className="rounded-md px-3 py-4 text-center" style={{ background: "var(--bg-subtle)" }}>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>Chưa học skill nào trong nhóm này</p>
              </div>
            ) : node.skills.map((skill) => (
              <div key={skill.id} className="rounded-md p-2.5" style={{ background: "var(--bg-subtle)" }}>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold truncate" style={{ color: "var(--text)" }}>{skill.name}</p>
                  <span className="text-[11px] font-bold tabular-nums" style={{ color: node.color }}>{confidencePct(skill.confidence)}</span>
                </div>
                <div className="flex flex-wrap gap-1 mt-2">
                  <Pill tone={skill.status}>{STATUS_LABEL[skill.status] ?? skill.status}</Pill>
                  <Pill tone={skill.riskLevel}>{RISK_LABEL[skill.riskLevel] ?? skill.riskLevel}</Pill>
                </div>
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}

function SkillsList({
  skills,
  filter,
  setFilter,
  savingId,
  updateStatus,
  recordOutcome,
}: {
  skills: BrainSkill[];
  filter: string;
  setFilter: (filter: string) => void;
  savingId: string | null;
  updateStatus: (id: string, status: string) => void;
  recordOutcome: (id: string, status: "success" | "fail" | "neutral") => void;
}) {
  const filters = ["all", "active", "draft", "high", "sales", "content", "ads", "customer", "operation", "brand", "intelligence"];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {filters.map((item) => (
          <button
            key={item}
            onClick={() => setFilter(item)}
            className="px-3 py-1.5 rounded-md text-xs font-semibold"
            style={filter === item ? { background: "var(--accent)", color: "white" } : { background: "var(--bg-card)", color: "var(--text-muted)", border: "1px solid var(--border)" }}
          >
            {item === "all" ? "Tất cả" : item}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {skills.length === 0 ? (
          <Card><p className="text-sm" style={{ color: "var(--text-muted)" }}>Không có kỹ năng nào phù hợp với bộ lọc.</p></Card>
        ) : skills.map((skill) => (
          <Card key={skill.id}>
            <div className="flex flex-col lg:flex-row lg:items-start gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-bold" style={{ color: "var(--text)" }}>{skill.name}</h2>
                  <Pill tone={skill.status}>{STATUS_LABEL[skill.status] ?? skill.status}</Pill>
                  <Pill tone={skill.riskLevel}>{RISK_LABEL[skill.riskLevel] ?? skill.riskLevel}</Pill>
                  <Pill tone={skill.permissionLevel}>{skill.permissionLevel}</Pill>
                </div>
                <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{skill.description ?? skill.playbook.slice(0, 160)}</p>
                <div className="grid md:grid-cols-3 gap-2 mt-3">
                  <Info label="Nhóm" value={`${skill.domain} / ${skill.category}`} />
                  <Info label="Trigger" value={skill.triggerType} />
                  <Info label="Metric" value={skill.successMetric ?? "manual_feedback"} />
                </div>
                <div className="flex flex-wrap gap-1 mt-3">
                  {skill.tags.slice(0, 8).map((tag) => <Pill key={tag}>{tag}</Pill>)}
                </div>
                {skill.councilNotes && (
                  <p className="text-xs mt-3 p-3 rounded-md" style={{ background: "var(--bg-subtle)", color: "var(--text-secondary)" }}>
                    {skill.councilNotes}
                  </p>
                )}
              </div>
              <div className="lg:w-56 space-y-2">
                <div className="rounded-md p-3" style={{ background: "var(--bg-subtle)" }}>
                  <div className="flex items-center justify-between text-xs">
                    <span style={{ color: "var(--text-muted)" }}>Confidence</span>
                    <strong className="tabular-nums" style={{ color: "var(--accent)" }}>{confidencePct(skill.confidence)}</strong>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden mt-2" style={{ background: "var(--bg-card)" }}>
                    <div className="h-full rounded-full" style={{ width: confidencePct(skill.confidence), background: "var(--accent)" }} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {skill.status === "active" ? (
                    <Button size="sm" variant="secondary" disabled={savingId === skill.id} onClick={() => updateStatus(skill.id, "paused")}>
                      <PauseCircle size={13} /> Dừng
                    </Button>
                  ) : (
                    <Button size="sm" disabled={savingId === skill.id} onClick={() => updateStatus(skill.id, "active")}>
                      <PlayCircle size={13} /> Bật
                    </Button>
                  )}
                  <Button size="sm" variant="secondary" disabled={savingId === skill.id} onClick={() => updateStatus(skill.id, "draft")}>
                    <ShieldCheck size={13} /> Nháp
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button size="sm" variant="secondary" disabled={savingId === skill.id} onClick={() => recordOutcome(skill.id, "success")}>
                    <CheckCircle size={13} /> Tốt
                  </Button>
                  <Button size="sm" variant="secondary" disabled={savingId === skill.id} onClick={() => recordOutcome(skill.id, "fail")}>
                    <WarningCircle size={13} /> Kém
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md p-2" style={{ background: "var(--bg-subtle)" }}>
      <p className="text-[10px] font-semibold" style={{ color: "var(--text-muted)" }}>{label}</p>
      <p className="text-xs mt-0.5 truncate" style={{ color: "var(--text)" }}>{value}</p>
    </div>
  );
}

function TeachPanel({
  instruction,
  setInstruction,
  teaching,
  teachResult,
  teach,
}: {
  instruction: string;
  setInstruction: (value: string) => void;
  teaching: boolean;
  teachResult: string | null;
  teach: () => void;
}) {
  const examples = [
    "Lead không trả lời sau 3 ngày thì tạo tin nhắn follow-up nhẹ, không spam, nhắc lại ưu đãi và xin lịch tư vấn.",
    "Nếu engagement bài dịch vụ giảm 30% trong 7 ngày thì đề xuất 5 góc content mới dựa trên bài đối thủ đang viral.",
    "Khi có bình luận tiêu cực chưa trả lời quá 2 giờ, tạo bản nháp phản hồi lịch sự và chuyển vào duyệt việc.",
  ];

  return (
    <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GraduationCap size={16} weight="fill" style={{ color: "var(--accent)" }} />
            Dạy skill mới
          </CardTitle>
        </CardHeader>
        <div className="space-y-3">
          <Textarea
            rows={8}
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder="Mô tả cách bạn muốn bộ não xử lý một tình huống. Ví dụ: Sau 3 ngày lead không trả lời thì..."
          />
          <div className="flex flex-wrap gap-2">
            <Button onClick={teach} loading={teaching} disabled={!instruction.trim()}>
              <Sparkle size={14} weight="fill" /> Học skill
            </Button>
            <Button variant="secondary" onClick={() => setInstruction("")}>Xóa</Button>
          </div>
          {teachResult && (
            <p className="text-sm rounded-md p-3" style={{ background: "var(--accent-light)", color: "var(--accent)" }}>
              {teachResult}
            </p>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ví dụ có thể dạy</CardTitle>
        </CardHeader>
        <div className="space-y-2">
          {examples.map((example) => (
            <button
              key={example}
              onClick={() => setInstruction(example)}
              className="w-full text-left rounded-md p-3 text-sm transition-colors hover:bg-[var(--bg-subtle)]"
              style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}
            >
              {example}
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
}

function RunsPanel({ summary }: { summary: Summary | null }) {
  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Skill runs gần đây</CardTitle>
        </CardHeader>
        <div className="space-y-2">
          {(summary?.recentRuns ?? []).length === 0 ? (
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>Chưa có run nào.</p>
          ) : summary!.recentRuns.map((run) => (
            <div key={run.id} className="rounded-md p-3" style={{ background: "var(--bg-subtle)" }}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>{run.skill.name}</p>
                <Pill tone={run.status}>{run.status}</Pill>
              </div>
              <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{run.action}</p>
              <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>{formatDateTime(run.startedAt)}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Outcomes gần đây</CardTitle>
        </CardHeader>
        <div className="space-y-2">
          {(summary?.recentOutcomes ?? []).length === 0 ? (
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>Chưa có outcome nào.</p>
          ) : summary!.recentOutcomes.map((outcome) => (
            <div key={outcome.id} className="rounded-md p-3" style={{ background: "var(--bg-subtle)" }}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>{outcome.skill.name}</p>
                <Pill tone={outcome.status}>{outcome.status}</Pill>
              </div>
              <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{outcome.metric}</p>
              {outcome.notes && <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>{outcome.notes}</p>}
              <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>{formatDateTime(outcome.createdAt)}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
