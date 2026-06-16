"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Eye, Megaphone, PencilSimple, Flame, Robot, ArrowRight,
} from "@phosphor-icons/react";

interface AgentStatus {
  key: string;
  label: string;
  icon: React.ElementType;
  color: string;
  href: string;
  status: "active" | "idle" | "warning";
  statusLabel: string;
  detail: string;
}

export function AITeamStatus() {
  const [agents, setAgents] = useState<AgentStatus[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/orchestrator")
      .then((r) => r.json())
      .then((res) => {
        const plan = res.data?.plan;
        const priorities: string[] = plan?.priorities?.map((p: { agent: string }) => p.agent) ?? [];
        const actions: { agent: string; action: string; status: string }[] = plan?.actions ?? [];

        const base: Omit<AgentStatus, "status" | "statusLabel" | "detail">[] = [
          { key: "intelligence", label: "Intelligence Agent", icon: Eye, color: "var(--amber)", href: "/competitors" },
          { key: "ads_creative", label: "Ads Agent", icon: Megaphone, color: "var(--blue)", href: "/facebook-ads" },
          { key: "content_research", label: "Content Agent", icon: PencilSimple, color: "var(--accent)", href: "/content-research" },
          { key: "proactive_sales", label: "Sales Agent", icon: Flame, color: "var(--rose)", href: "/sale" },
          { key: "orchestrator", label: "Orchestrator", icon: Robot, color: "var(--premium)", href: "/orchestrator" },
        ];

        const result = base.map((b) => {
          const isPriority = priorities.includes(b.key);
          const action = actions.find((a) => a.agent === b.key);
          let status: AgentStatus["status"] = "idle";
          let statusLabel = "Đang chờ";
          let detail = "Không có việc cần làm";

          if (b.key === "orchestrator") {
            status = plan ? "active" : "idle";
            statusLabel = plan ? "Đã phân tích" : "Chưa chạy";
            detail = plan ? `Mode: ${plan.mode === "auto" ? "Tự động" : "Đề xuất"}` : "Chưa có dữ liệu";
          } else if (isPriority) {
            status = "warning";
            statusLabel = "Cần kích hoạt";
            const p = plan?.priorities?.find((pr: { agent: string; reason: string }) => pr.agent === b.key);
            detail = p?.reason ?? "Phát hiện tín hiệu bất thường";
          } else if (action?.status === "executed") {
            status = "active";
            statusLabel = "Đã thực thi";
            detail = action.action;
          } else {
            status = "idle";
            statusLabel = "Bình thường";
            detail = "Tất cả chỉ số ổn định";
          }

          return { ...b, status, statusLabel, detail };
        });

        setAgents(result);
      })
      .catch(() => setAgents([]))
      .finally(() => setLoading(false));
  }, []);

  const statusBg: Record<AgentStatus["status"], string> = {
    active: "var(--success-light)",
    warning: "var(--warning-light)",
    idle: "var(--bg-subtle)",
  };
  const statusTextColor: Record<AgentStatus["status"], string> = {
    active: "var(--success)",
    warning: "var(--warning)",
    idle: "var(--text-muted)",
  };
  const statusDotClass: Record<AgentStatus["status"], string> = {
    active: "status-dot-active",
    warning: "status-dot-warning",
    idle: "",
  };

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="skeleton h-12 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {agents.map((a) => {
        const Icon = a.icon;
        return (
          <Link
            key={a.key}
            href={a.href}
            className="flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all hover:bg-[var(--bg-subtle)] group"
            style={{ border: "1px solid var(--border)", background: "var(--bg-card)" }}
          >
            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: a.color + "18" }}>
              <Icon size={13} weight="fill" style={{ color: a.color }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold truncate" style={{ color: "var(--text)" }}>{a.label}</p>
              <p className="text-[10px] truncate" style={{ color: "var(--text-muted)" }}>{a.detail}</p>
            </div>
            <span
              className="flex items-center gap-1.5 text-[9px] font-semibold px-2 py-1 rounded-full shrink-0"
              style={{ background: statusBg[a.status], color: statusTextColor[a.status] }}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusDotClass[a.status]}`}
                style={{ background: statusTextColor[a.status] }}
              />
              {a.statusLabel}
            </span>
            <ArrowRight size={10} style={{ color: "var(--text-muted)", flexShrink: 0 }} className="opacity-0 group-hover:opacity-100 transition-opacity" />
          </Link>
        );
      })}
    </div>
  );
}
