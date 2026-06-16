"use client";

import { cn } from "@/lib/utils";
import { TrendUp, TrendDown, Minus } from "@phosphor-icons/react";
import Link from "next/link";
import { useCountUp } from "@/lib/use-count-up";

interface StatProps {
  label: string;
  value: number | string;
  icon?: React.ElementType;
  color?: string;            // accent color for icon badge
  href?: string;             // optional link wrap
  sparkline?: number[];      // 7-day data for inline trend
  deltaPct?: number;         // % change vs prev period
  premium?: boolean;         // use premium gold styling
  format?: (n: number) => string;
  className?: string;
}

export function Stat({
  label,
  value,
  icon: Icon,
  color,
  href,
  sparkline,
  deltaPct,
  premium,
  format,
  className,
}: StatProps) {
  const isNum = typeof value === "number";
  const numericValue = isNum ? value : 0;
  const display = useCountUp(numericValue, { duration: 800, skip: !isNum });
  const shownValue = isNum
    ? (format ? format(Math.round(display)) : Math.round(display).toLocaleString("vi-VN"))
    : String(value);

  const iconColor = premium ? "var(--premium)" : (color ?? "var(--accent)");
  const iconBg = premium ? "var(--premium-light)" : `${iconColor}1A`;

  const content = (
    <div
      className={cn(
        "rounded-xl p-4 transition-all duration-200",
        href && "card-hover",
        className
      )}
      style={{
        background: "var(--bg-card)",
        border: premium ? "1px solid var(--premium)" : "1px solid var(--border)",
        boxShadow: premium ? "var(--shadow-premium)" : "var(--shadow-sm)",
      }}
    >
      <div className="flex items-start justify-between mb-2">
        {Icon && (
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: iconBg }}
          >
            <Icon size={13} style={{ color: iconColor }} weight="fill" />
          </div>
        )}
        {typeof deltaPct === "number" && (
          <TrendIndicator deltaPct={deltaPct} />
        )}
      </div>

      <p className="stat-num text-2xl font-bold tracking-tight" style={{ color: "var(--text)" }}>
        {shownValue}
      </p>
      <p className="text-[11px] mt-1 leading-tight" style={{ color: "var(--text-muted)" }}>
        {label}
      </p>

      {sparkline && sparkline.length >= 2 && (
        <div className="mt-2.5 -mx-1">
          <Sparkline data={sparkline} color={iconColor} />
        </div>
      )}
    </div>
  );

  if (href) return <Link href={href}>{content}</Link>;
  return content;
}

function TrendIndicator({ deltaPct }: { deltaPct: number }) {
  const positive = deltaPct > 0;
  const neutral = deltaPct === 0;
  const color = neutral ? "var(--text-muted)" : positive ? "var(--success)" : "var(--danger)";
  const Icon = neutral ? Minus : positive ? TrendUp : TrendDown;
  return (
    <span
      className="inline-flex items-center gap-0.5 text-[10px] font-semibold tabular-nums px-1.5 py-0.5 rounded-full"
      style={{ background: color + "1A", color }}
    >
      <Icon size={9} weight="bold" />
      {Math.abs(deltaPct).toFixed(0)}%
    </span>
  );
}

function Sparkline({ data, color }: { data: number[]; color: string }) {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const w = 100;
  const h = 24;
  const stepX = w / (data.length - 1);

  const points = data
    .map((v, i) => {
      const x = i * stepX;
      const y = h - ((v - min) / range) * h;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const areaPath = `M 0,${h} L ${points.split(" ").join(" L ")} L ${w},${h} Z`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="w-full" style={{ height: 24 }}>
      <defs>
        <linearGradient id={`spark-grad-${color}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#spark-grad-${color})`} />
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
