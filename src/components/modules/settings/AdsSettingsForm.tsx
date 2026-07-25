"use client";

import { useMemo, useState } from "react";
import { ShieldCheck, WarningCircle } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { UnsavedChangesGuard } from "@/components/workspace/UnsavedChangesGuard";
import type { AdsOptimizationSettings, AdsSettingsDto } from "@/lib/settings/ads-policy";
import { AdsOptimizationFields } from "./AdsOptimizationFields";

function optimizationValue(settings: AdsSettingsDto): AdsOptimizationSettings {
  return {
    adsOptimizePauseCtr: settings.adsOptimizePauseCtr,
    adsOptimizeScaleCtr: settings.adsOptimizeScaleCtr,
    adsOptimizeFreqLimit: settings.adsOptimizeFreqLimit,
    adsOptimizeScalePct: settings.adsOptimizeScalePct,
    adsOptimizeMinSpend: settings.adsOptimizeMinSpend,
    adsOptimizeMaxBudget: settings.adsOptimizeMaxBudget,
    adsOptimizeCooldownHrs: settings.adsOptimizeCooldownHrs,
    adsOptimizeMinRoas: settings.adsOptimizeMinRoas,
  };
}

const executionLabel = {
  read_only: "Chỉ đọc",
  supervised_manual: "Thủ công có giám sát",
  semi: "Bán tự động",
  full: "Toàn quyền theo policy",
} as const;

const automationLabel = {
  supervised: "Có giám sát",
  semi: "Bán tự động",
  full: "Hoàn toàn",
} as const;

export function AdsSettingsForm({ initialSettings }: { initialSettings: AdsSettingsDto }) {
  const [status, setStatus] = useState(initialSettings);
  const [baseline, setBaseline] = useState(() => optimizationValue(initialSettings));
  const [value, setValue] = useState(() => optimizationValue(initialSettings));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const dirty = useMemo(() => JSON.stringify(value) !== JSON.stringify(baseline), [baseline, value]);

  const save = async () => {
    if (!window.confirm("Lưu ngưỡng tối ưu Ads mới? Các job sau sẽ dùng các giá trị này nhưng vẫn bị deployment safety chặn.")) return;
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/settings/ads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(value),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        setMessage({ type: "error", text: result.error ?? "Không thể lưu cấu hình Ads" });
        return;
      }
      setStatus(result.data);
      const next = optimizationValue(result.data);
      setValue(next);
      setBaseline(next);
      setMessage({ type: "success", text: "Đã lưu ngưỡng tối ưu quảng cáo." });
    } catch {
      setMessage({ type: "error", text: "Không thể kết nối máy chủ." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl space-y-4">
      <UnsavedChangesGuard active={dirty} />
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2"><ShieldCheck size={18} className="text-[var(--accent)]" aria-hidden="true" /><CardTitle>Safety policy hiệu lực</CardTitle></div>
          <Badge variant={status.emergencyStop || status.executionMode === "read_only" ? "danger" : status.forcedDryRun ? "warning" : "success"}>
            {status.emergencyStop ? "Đang khóa khẩn cấp" : status.forcedDryRun ? "Buộc dry-run" : "Mutation được kiểm soát"}
          </Badge>
        </CardHeader>
        <div className="grid gap-px overflow-hidden rounded-md border bg-[var(--border)] sm:grid-cols-2 lg:grid-cols-4" style={{ borderColor: "var(--border)" }}>
          <SafetyItem label="Execution ceiling" value={executionLabel[status.executionMode]} />
          <SafetyItem label="Automation yêu cầu" value={automationLabel[status.requestedAutomationLevel]} />
          <SafetyItem label="Automation hiệu lực" value={automationLabel[status.effectiveAutomationLevel]} />
          <SafetyItem label="Tiền tệ" value={status.currency} />
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Allowlist label="Facebook Page allowlist" values={status.allowedFacebookPageIds} />
          <Allowlist label="Ad Account allowlist" values={status.allowedAdAccountIds} />
        </div>
        <div className="mt-4 flex items-start gap-2 rounded-md border p-3 text-xs" style={{ borderColor: status.emergencyStop ? "var(--danger)" : "var(--border)", background: "var(--bg-subtle)" }}>
          <WarningCircle size={17} className="shrink-0 text-[var(--warning)]" aria-hidden="true" />
          <p className="text-[var(--text-muted)]">Các giá trị trên đến từ deployment và chỉ đọc. Database không thể tắt emergency stop, nới execution ceiling hoặc thêm Page/Ad Account vào allowlist. Resource Ads mới vẫn luôn được tạo ở trạng thái PAUSED.</p>
        </div>
      </Card>

      <AdsOptimizationFields value={value} disabled={saving} onChange={setValue} />

      {message ? <p role={message.type === "error" ? "alert" : "status"} className={`text-sm ${message.type === "success" ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>{message.text}</p> : null}
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={save} loading={saving} disabled={!dirty}>Lưu ngưỡng Ads</Button>
        {dirty ? <span className="text-xs font-semibold text-[var(--warning)]">Có thay đổi chưa lưu</span> : null}
      </div>
    </div>
  );
}

function SafetyItem({ label, value }: { label: string; value: string }) {
  return <div className="bg-[var(--bg-card)] p-3"><p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">{label}</p><p className="mt-1 text-sm font-bold text-[var(--text)]">{value}</p></div>;
}

function Allowlist({ label, values }: { label: string; values: string[] }) {
  return <div className="rounded-md border p-3" style={{ borderColor: "var(--border)" }}><p className="text-xs font-semibold text-[var(--text)]">{label}</p><div className="mt-2 flex flex-wrap gap-1.5">{values.length ? values.map((value) => <Badge key={value} variant="neutral">{value}</Badge>) : <span className="text-xs text-[var(--danger)]">Chưa cấu hình — mutation sẽ bị chặn</span>}</div></div>;
}
