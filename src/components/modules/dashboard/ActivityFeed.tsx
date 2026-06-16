"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  PaperPlaneTilt, Users, TreeStructure, Bell, CurrencyCircleDollar,
  ArrowRight, Pulse, WarningCircle,
} from "@phosphor-icons/react";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { SkeletonRow } from "@/components/ui/Skeleton";

interface ActivityItem {
  id: string;
  type: "post_published" | "lead_new" | "workflow_run" | "job_run" | "alert" | "revenue" | "review_blocked" | "publish_failed";
  title: string;
  detail?: string;
  href?: string;
  timestamp: string;
  severity?: "info" | "success" | "warning" | "danger";
}

const TYPE_ICON: Record<string, React.ElementType> = {
  post_published: PaperPlaneTilt,
  lead_new: Users,
  workflow_run: TreeStructure,
  job_run: TreeStructure,
  alert: Bell,
  revenue: CurrencyCircleDollar,
  review_blocked: WarningCircle,
  publish_failed: WarningCircle,
};

const SEVERITY_COLOR: Record<string, string> = {
  info: "var(--blue)",
  success: "var(--success)",
  warning: "var(--warning)",
  danger: "var(--danger)",
};

function timeAgo(ts: string): string {
  const ms = Date.now() - new Date(ts).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return "vừa xong";
  if (min < 60) return `${min}p trước`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h trước`;
  return `${Math.floor(hr / 24)}d trước`;
}

export function ActivityFeed() {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard/activity")
      .then((r) => r.json())
      .then((res) => { if (res.success) setItems(res.data); })
      .finally(() => setLoading(false));
  }, []);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Pulse size={14} style={{ color: "var(--accent)" }} weight="fill" />
          <CardTitle>Hoạt động gần đây (24h)</CardTitle>
        </div>
        <Link href="/orchestrator" className="text-[11px] flex items-center gap-0.5 transition-opacity hover:opacity-80" style={{ color: "var(--text-muted)" }}>
          Xem chi tiết <ArrowRight size={10} />
        </Link>
      </CardHeader>

      {loading ? (
        <div className="divide-y" style={{ borderColor: "var(--border)" }}>
          {[1, 2, 3, 4].map((i) => <SkeletonRow key={i} />)}
        </div>
      ) : items.length === 0 ? (
        <p className="text-xs py-6 text-center" style={{ color: "var(--text-muted)" }}>
          Chưa có hoạt động trong 24h qua
        </p>
      ) : (
        <div className="divide-y" style={{ borderColor: "var(--border)" }}>
          {items.map((item) => {
            const Icon = TYPE_ICON[item.type] ?? Pulse;
            const color = SEVERITY_COLOR[item.severity ?? "info"];
            const className = "flex items-start gap-3 py-2.5 -mx-2 px-2 rounded-lg transition-colors hover:bg-[var(--bg-subtle)]";
            const inner = (
              <>
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                  style={{ background: color + "18" }}
                >
                  <Icon size={12} weight="fill" style={{ color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate" style={{ color: "var(--text)" }}>{item.title}</p>
                  {item.detail && (
                    <p className="text-[10px] truncate" style={{ color: "var(--text-muted)" }}>{item.detail}</p>
                  )}
                </div>
                <span className="text-[10px] tabular-nums shrink-0 mt-1" style={{ color: "var(--text-muted)" }}>
                  {timeAgo(item.timestamp)}
                </span>
              </>
            );

            return item.href
              ? <Link key={item.id} href={item.href} className={className}>{inner}</Link>
              : <div key={item.id} className={className}>{inner}</div>;
          })}
        </div>
      )}
    </Card>
  );
}
