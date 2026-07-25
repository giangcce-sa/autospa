"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { WORKFLOW_NAMES, type OverridableOutcomeStatus } from "@/lib/ai-runtime-types";

interface ActionResult {
  success?: boolean;
  error?: string;
}

async function mutate(path: string, body?: Record<string, unknown>, method = "POST") {
  const response = await fetch(path, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const result = await response.json() as ActionResult;
  if (!response.ok || !result.success) throw new Error(result.error || "Không thể thực hiện tác vụ");
}

export function TeachSkillAction() {
  const router = useRouter();
  const [instruction, setInstruction] = useState("");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");

  const submit = async () => {
    if (!instruction.trim()) return;
    setLoading(true);
    setNotice("");
    try {
      await mutate("/api/brain", { action: "teach", instruction, source: "canonical_ai_rooms" });
      setInstruction("");
      setNotice("Đã tạo skill để owner review.");
      router.refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Không thể dạy skill");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-4">
      <h2 className="text-sm font-bold">Dạy kỹ năng mới</h2>
      <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">AI phân loại nội dung thành BrainSkill draft; owner vẫn phải review permission, risk và playbook.</p>
      <Textarea className="mt-3" label="Hướng dẫn kỹ năng" rows={3} value={instruction} onChange={(event) => setInstruction(event.target.value)} placeholder="Mô tả tín hiệu, cách xử lý và tiêu chí thành công..." />
      <div className="mt-3 flex items-center gap-3">
        <Button size="sm" loading={loading} onClick={submit} disabled={!instruction.trim()}>Tạo skill draft</Button>
        {notice ? <p className="text-xs text-[var(--text-muted)]" role="status">{notice}</p> : null}
      </div>
    </div>
  );
}

export function BrainSkillActions({ id, currentStatus }: { id: string; currentStatus: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  const updateStatus = async (status: "draft" | "active" | "paused" | "deprecated") => {
    setLoading(status);
    setNotice("");
    try {
      await mutate("/api/brain", { id, status, note: "Canonical AI Rooms status update" }, "PATCH");
      router.refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Không thể cập nhật skill");
    } finally {
      setLoading(null);
    }
  };

  const recordOutcome = async (status: "success" | "fail") => {
    setLoading(status);
    setNotice("");
    try {
      await mutate("/api/brain", { action: "outcome", skillId: id, status, notes: "Manual outcome from canonical AI Rooms" });
      router.refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Không thể ghi outcome");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      {currentStatus !== "active" ? <Button size="sm" loading={loading === "active"} onClick={() => updateStatus("active")}>Kích hoạt</Button> : null}
      {currentStatus === "active" ? <Button size="sm" variant="secondary" loading={loading === "paused"} onClick={() => updateStatus("paused")}>Tạm dừng</Button> : null}
      {currentStatus !== "deprecated" ? <Button size="sm" variant="secondary" loading={loading === "deprecated"} onClick={() => updateStatus("deprecated")}>Ngừng dùng</Button> : null}
      <Button size="sm" variant="secondary" loading={loading === "success"} onClick={() => recordOutcome("success")}>Outcome tốt</Button>
      <Button size="sm" variant="danger" loading={loading === "fail"} onClick={() => recordOutcome("fail")}>Outcome kém</Button>
      {notice ? <p className="w-full text-xs text-[var(--rose)]" role="status">{notice}</p> : null}
    </div>
  );
}

export function OrchestratorActions({ hasUnacknowledgedAlerts }: { hasUnacknowledgedAlerts: boolean }) {
  const router = useRouter();
  const [running, setRunning] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  const run = async (path: string, key: string, body?: Record<string, unknown>) => {
    setRunning(key);
    setNotice("");
    try {
      await mutate(path, body);
      setNotice("Tác vụ đã hoàn tất và record mới đã được persist.");
      router.refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Không thể chạy tác vụ");
    } finally {
      setRunning(null);
    }
  };

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-4">
      <h2 className="text-sm font-bold">Tác vụ owner</h2>
      <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">Chạy Orchestrator có thể thực thi workflow và agent theo automation level hiện tại. Monitor có thể tạo alert, gửi thông báo và trigger workflow. Refresh và GET chỉ đọc dữ liệu persisted.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" loading={running === "orchestrator"} onClick={() => run("/api/orchestrator", "orchestrator")}>Chạy orchestrator</Button>
        {WORKFLOW_NAMES.map((name) => (
          <Button key={name} size="sm" variant="secondary" loading={running === name} onClick={() => run("/api/workflows", name, { name, trigger: "Manual trigger from canonical AI Rooms" })}>
            {name}
          </Button>
        ))}
        <Button size="sm" variant="secondary" loading={running === "monitor"} onClick={() => run("/api/realtime-alerts", "monitor", { action: "run-now" })}>Chạy monitor</Button>
        {hasUnacknowledgedAlerts ? <Button size="sm" variant="secondary" loading={running === "ack-all"} onClick={() => run("/api/realtime-alerts", "ack-all", { action: "acknowledge-all" })}>Đánh dấu tất cả đã xem</Button> : null}
      </div>
      {notice ? <p className="mt-3 text-xs text-[var(--text-muted)]" role="status">{notice}</p> : null}
    </div>
  );
}

export function OperationsActions({ adsEnabled, spaConfigured }: { adsEnabled: boolean; spaConfigured: boolean }) {
  const router = useRouter();
  const [running, setRunning] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  const run = async (key: string, path: string, body?: Record<string, unknown>) => {
    setRunning(key);
    setNotice("");
    try {
      await mutate(path, body);
      setNotice("Tác vụ hoàn tất; màn hình đã tải lại dữ liệu persisted.");
      router.refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Không thể chạy tác vụ");
    } finally {
      setRunning(null);
    }
  };

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-4">
      <h2 className="text-sm font-bold">Tác vụ Operations owner-only</h2>
      <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">Ads dry-run vẫn đọc Meta và persist JobRun/AdOptimizationLog. Spa test và pull gọi provider. Các thao tác này chỉ chạy khi owner bấm nút; SSR và GET không chạy chúng.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" loading={running === "ads"} disabled={!adsEnabled} onClick={() => run("ads", "/api/automation/ads-run")}>Chạy Ads dry-run</Button>
        <Button size="sm" variant="secondary" loading={running === "spa-test"} disabled={!spaConfigured} onClick={() => run("spa-test", "/api/spa", { action: "test-connection" })}>Kiểm tra kết nối Spa</Button>
        <Button size="sm" variant="secondary" loading={running === "spa-pull"} disabled={!spaConfigured} onClick={() => run("spa-pull", "/api/spa", { action: "pull-revenue" })}>Đồng bộ doanh thu Spa</Button>
      </div>
      {notice ? <p className="mt-3 text-xs text-[var(--text-muted)]" role="status">{notice}</p> : null}
    </div>
  );
}

export function RealtimeAlertAction({ id }: { id: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");

  const acknowledge = async () => {
    setLoading(true);
    setNotice("");
    try {
      await mutate("/api/realtime-alerts", { action: "acknowledge", id });
      router.refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Không thể đánh dấu alert");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="shrink-0">
      <Button size="sm" variant="secondary" loading={loading} onClick={acknowledge}>Đã xem</Button>
      {notice ? <p className="mt-1 max-w-40 text-[10px] text-[var(--rose)]" role="status">{notice}</p> : null}
    </div>
  );
}

export function ApprovalActions({ id }: { id: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  const decide = async (decision: "approved" | "rejected") => {
    setLoading(decision);
    setNotice("");
    try {
      await mutate("/api/approvals", { id, decision });
      router.refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Không thể xử lý approval");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div>
      <div className="flex gap-2">
        <Button size="sm" loading={loading === "approved"} onClick={() => decide("approved")}>Duyệt và thực thi</Button>
        <Button size="sm" variant="danger" loading={loading === "rejected"} onClick={() => decide("rejected")}>Từ chối</Button>
      </div>
      {notice ? <p className="mt-2 text-xs text-[var(--rose)]" role="status">{notice}</p> : null}
    </div>
  );
}

export function OutcomeOverrideAction({ id, currentStatus }: { id: string; currentStatus: string | null }) {
  const router = useRouter();
  const [status, setStatus] = useState<OverridableOutcomeStatus>(
    currentStatus === "success" || currentStatus === "fail" || currentStatus === "neutral" ? currentStatus : "neutral",
  );
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");

  const submit = async () => {
    if (!notes.trim()) return;
    setLoading(true);
    setNotice("");
    try {
      await mutate("/api/ceo-decisions", { action: "override-outcome", id, status, notes });
      setNotes("");
      router.refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Không thể override outcome");
    } finally {
      setLoading(false);
    }
  };

  return (
    <details className="mt-3">
      <summary className="cursor-pointer text-xs font-semibold text-[var(--text-secondary)]">Owner override outcome</summary>
      <div className="mt-2 grid gap-2 sm:grid-cols-[140px_1fr_auto]">
        <label className="space-y-1.5 text-[13px] font-semibold text-[var(--text-secondary)]">
          Outcome
          <select className="mt-1.5 min-h-11 w-full rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] px-3 text-sm" value={status} onChange={(event) => setStatus(event.target.value as OverridableOutcomeStatus)}>
            <option value="success">Thành công</option>
            <option value="fail">Thất bại</option>
            <option value="neutral">Trung tính</option>
          </select>
        </label>
        <Input label="Lý do audit" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Bắt buộc" />
        <Button size="sm" loading={loading} disabled={!notes.trim()} onClick={submit}>Lưu</Button>
      </div>
      {notice ? <p className="mt-2 text-xs text-[var(--rose)]" role="status">{notice}</p> : null}
    </details>
  );
}
