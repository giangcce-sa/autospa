import Link from "next/link";
import { notFound } from "next/navigation";
import { WarningCircle } from "@phosphor-icons/react/dist/ssr";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { CouncilView } from "@/components/modules/council/CouncilView";
import { WorkspacePermissionState } from "@/components/workspace/WorkspacePermissionState";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";
import { ROUTES_BY_ID } from "@/config/routes";
import { getAutomationOperationsData } from "@/lib/automation-operations";
import {
  getAIRoomApprovalsData,
  getAIRoomBrainData,
  getAIRoomCouncilData,
  getAIRoomMemoryData,
  getAIRoomOrchestratorData,
  getAIRoomsOverview,
  type AIRoomApproval,
  type AIRoomDecision,
  type AIRoomJobRun,
  type AIRoomsProvenance,
  type AIRoomWorkflowRun,
} from "@/lib/ai-rooms";
import { AccessError } from "@/lib/page-access";
import { resolveWorkspaceAccess } from "@/lib/workspace-access";
import { formatDateTime } from "@/lib/utils";
import { parseWorkspaceUrl, workspaceScopesForRoute } from "@/lib/workspace-url";
import { ApprovalActions, BrainSkillActions, OperationsActions, OrchestratorActions, OutcomeOverrideAction, RealtimeAlertAction, TeachSkillAction } from "./AIRoomActions";

export interface AIRoomsWorkspaceProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function AIRoomsWorkspace({ searchParams }: AIRoomsWorkspaceProps) {
  const route = ROUTES_BY_ID.get("system-ai-rooms");
  if (!route || route.kind !== "workspace" || !route.views?.length || !route.defaultView) notFound();

  const params = await searchParams;
  const requestedView = typeof params.view === "string" && route.views.some((view) => view.id === params.view)
    ? params.view
    : route.defaultView;
  const requestedViewConfig = route.views.find((view) => view.id === requestedView) ?? route.views[0];
  const effectiveScope = requestedViewConfig.scope ?? route.scope;
  const allowedScopes = workspaceScopesForRoute(effectiveScope);
  const state = parseWorkspaceUrl(params, {
    views: route.views.map((view) => view.id),
    defaultView: route.defaultView,
    defaultScope: allowedScopes[0],
    allowedScopes,
  });
  const currentView = route.views.find((view) => view.id === state.view) ?? route.views[0];

  let access: Awaited<ReturnType<typeof resolveWorkspaceAccess>>;
  try {
    access = await resolveWorkspaceAccess(route, state, effectiveScope);
  } catch (error) {
    if (error instanceof AccessError && error.status === 403) {
      return <WorkspacePermissionState route={route} message={error.message} />;
    }
    throw error;
  }

  const status = typeof params.status === "string" ? params.status : undefined;
  return (
    <WorkspaceShell route={route} state={access.state} pages={access.pages} effectiveScope={effectiveScope} visibleViewIds={access.visibleViewIds}>
      {currentView.id === "overview" ? (
        <OverviewContent data={await getAIRoomsOverview()} canMutate={access.canMutate} />
      ) : currentView.id === "council" ? (
        <CouncilContent data={await getAIRoomCouncilData()} canMutate={access.canMutate} />
      ) : currentView.id === "brain" ? (
        <BrainContent
          data={await getAIRoomBrainData({
            domain: access.state.domain,
            category: access.state.category,
            status: access.state.status,
            risk: access.state.risk,
            q: access.state.q,
          })}
          canMutate={access.canMutate}
        />
      ) : currentView.id === "memory" ? (
        <MemoryContent data={await getAIRoomMemoryData(status)} canMutate={access.canMutate} />
      ) : currentView.id === "orchestrator" ? (
        <OrchestratorContent data={await getAIRoomOrchestratorData(access.canMutate)} canMutate={access.canMutate} />
      ) : currentView.id === "approvals" ? (
        <ApprovalsContent data={await getAIRoomApprovalsData()} canMutate={access.canMutate} />
      ) : currentView.id === "operations" ? (
        <OperationsContent data={await getAutomationOperationsData()} />
      ) : null}
    </WorkspaceShell>
  );
}

type OverviewData = Awaited<ReturnType<typeof getAIRoomsOverview>>;
type CouncilData = Awaited<ReturnType<typeof getAIRoomCouncilData>>;
type BrainData = Awaited<ReturnType<typeof getAIRoomBrainData>>;
type MemoryData = Awaited<ReturnType<typeof getAIRoomMemoryData>>;
type OrchestratorData = Awaited<ReturnType<typeof getAIRoomOrchestratorData>>;
type ApprovalsData = Awaited<ReturnType<typeof getAIRoomApprovalsData>>;
type OperationsData = Awaited<ReturnType<typeof getAutomationOperationsData>>;

function OverviewContent({ data, canMutate }: { data: OverviewData; canMutate: boolean }) {
  return (
    <section className="space-y-4">
      <ProvenanceNotice provenance={data.provenance} />
      <PermissionNotice canMutate={canMutate} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Quyết định persisted" value={data.counts.decisions} />
        <Metric label="Skill đang active" value={data.counts.activeSkills} />
        <Metric label="Approval còn hiệu lực" value={data.counts.pendingApprovals} />
        <Metric label="Workflow đang running" value={data.counts.runningWorkflows} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <RoomLink href="/system/ai-rooms?view=council&scope=account" title="Phòng tư vấn" description="Tạo bản tổng hợp và lưu CEODecision." />
        <RoomLink href="/system/ai-rooms?view=brain&scope=account" title="Kỹ năng" description="BrainSkill, run và outcome persisted." />
        <RoomLink href="/system/ai-rooms?view=memory&scope=account" title="Quyết định" description="Theo dõi outcome và provenance đã lưu." />
        <RoomLink href="/system/ai-rooms?view=orchestrator&scope=account" title="Điều phối" description="OrchestratorRun, WorkflowRun và JobRun." />
        <RoomLink href="/system/ai-rooms?view=approvals&scope=account" title="Phê duyệt" description="Review đề xuất trước execution." />
        <RoomLink href="/system/settings?view=providers&scope=account" title="Cấu hình AI" description="Provider và secret chỉ cấu hình trong Settings." />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <DecisionList title="Quyết định gần đây" decisions={data.recentDecisions} />
        <ApprovalList title="Approval gần đây" approvals={data.recentApprovals} canMutate={false} />
        <JobList title="Job gần đây" jobs={data.recentJobs} />
      </div>
    </section>
  );
}

function CouncilContent({ data, canMutate }: { data: CouncilData; canMutate: boolean }) {
  return (
    <section className="space-y-4">
      <ProvenanceNotice provenance={data.provenance} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Metric label="Council decisions persisted" value={data.total} />
        <Metric label="Quyền hiện tại" value={canMutate ? "Owner" : "Viewer"} />
      </div>
      <CouncilView canMutate={canMutate} />
      <DecisionList title="Kết quả Council đã lưu" decisions={data.decisions} />
    </section>
  );
}

function BrainContent({ data, canMutate }: { data: BrainData; canMutate: boolean }) {
  const categories = data.filters.domain ? data.taxonomy[data.filters.domain]?.categories ?? [] : [];
  return (
    <section className="space-y-4">
      <ProvenanceNotice provenance={data.provenance} />
      <PermissionNotice canMutate={canMutate} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Metric label="Tổng skill" value={data.counts.total} />
        <Metric label="Active" value={data.counts.active} />
        <Metric label="Draft" value={data.counts.draft} />
        <Metric label="High risk" value={data.counts.highRisk} />
        <Metric label="Khớp bộ lọc" value={data.counts.filtered} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {data.map.map((domain) => (
          <Link
            key={domain.domain}
            href={brainFilterHref({ domain: domain.domain })}
            className={`rounded-lg border p-4 ${data.filters.domain === domain.domain ? "border-[var(--accent)] bg-[var(--accent-light)]" : "border-[var(--border)] bg-[var(--bg-card)]"}`}
          >
            <div className="flex items-center justify-between gap-2"><h2 className="text-sm font-bold">{domain.label}</h2><strong>{domain.total}</strong></div>
            <p className="mt-2 text-xs leading-5 text-[var(--text-muted)]">{domain.description}</p>
            <p className="mt-2 text-[11px] text-[var(--text-secondary)]">{domain.active} active · {domain.draft} draft</p>
          </Link>
        ))}
      </div>

      <form action="/system/ai-rooms" className="grid gap-3 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-4 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_1fr_2fr_auto]">
        <input type="hidden" name="view" value="brain" />
        <input type="hidden" name="scope" value="account" />
        <FilterSelect name="domain" label="Domain" value={data.filters.domain ?? ""} options={data.map.map((domain) => ({ value: domain.domain, label: domain.label }))} />
        <FilterSelect name="category" label="Category" value={data.filters.category ?? ""} options={categories.map((category) => ({ value: category, label: category }))} disabled={!data.filters.domain} />
        <FilterSelect name="status" label="Status" value={data.filters.status ?? ""} options={["draft", "active", "paused", "deprecated"].map((value) => ({ value, label: value }))} />
        <FilterSelect name="risk" label="Risk" value={data.filters.risk ?? ""} options={["low", "medium", "high"].map((value) => ({ value, label: value }))} />
        <label className="text-xs font-semibold text-[var(--text-secondary)]">Tìm skill<input name="q" defaultValue={data.filters.q ?? ""} className="mt-1.5 min-h-11 w-full rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] px-3 text-sm" placeholder="Tên hoặc mô tả" /></label>
        <div className="flex items-end gap-2"><Button type="submit" size="sm">Lọc</Button><Link href={brainFilterHref({})} className="pb-2 text-xs font-semibold text-[var(--text-muted)] underline">Xóa</Link></div>
      </form>

      {canMutate ? <TeachSkillAction /> : null}
      <div className="space-y-3">
        {data.skills.length ? data.skills.map((skill) => (
          <article key={skill.id} className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2"><h3 className="text-base font-bold">{skill.name}</h3><StateBadge status={skill.status} /><StateBadge status={skill.riskLevel} /><StateBadge status={skill.permissionLevel} /></div>
                <p className="mt-1 text-xs text-[var(--text-muted)]">{skill.domain} / {skill.category} · learned from {skill.learnedFrom} · {skill.versionCount} versions · {skill.feedbackCount} feedback</p>
              </div>
              <div className="text-xs text-[var(--text-muted)] sm:text-right"><p>Confidence {Math.round(skill.confidence * 100)}% · classification {Math.round(skill.classificationConfidence * 100)}%</p><time>{formatDateTime(skill.updatedAt)}</time></div>
            </div>
            {skill.description ? <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">{skill.description}</p> : null}
            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              <BrainMetadata label="Trigger" value={`${skill.triggerType}${Object.keys(skill.triggerConfig).length ? ` · ${JSON.stringify(skill.triggerConfig)}` : ""}`} />
              <BrainMetadata label="Success metric" value={skill.successMetric ?? "Chưa cấu hình"} />
              <BrainMetadata label="Input signals" value={skill.inputSignals.join(", ") || "Chưa có"} />
              <BrainMetadata label="Tools" value={skill.tools.join(", ") || "Chưa có"} />
            </div>
            <details className="mt-3 rounded-md bg-[var(--bg-subtle)] p-3"><summary className="cursor-pointer text-xs font-bold">Playbook và provenance</summary><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[var(--text-secondary)]">{skill.playbook}</p>{skill.tags.length ? <p className="mt-2 text-xs text-[var(--text-muted)]">Tags: {skill.tags.join(", ")}</p> : null}{skill.councilNotes ? <p className="mt-2 text-xs leading-5 text-[var(--warning)]">Council: {skill.councilNotes}</p> : null}</details>
            <div className="mt-3 grid gap-2 text-xs lg:grid-cols-2">
              <RuntimeFact label="Latest run" detail={skill.latestRun ? `${skill.latestRun.action} · ${skill.latestRun.status}${skill.latestRun.error ? ` · ${skill.latestRun.error}` : ""}` : "Chưa có run"} />
              <RuntimeFact label="Latest outcome" detail={skill.latestOutcome ? `${skill.latestOutcome.metric} · ${skill.latestOutcome.status} · confidence ${skill.latestOutcome.confidenceDelta >= 0 ? "+" : ""}${skill.latestOutcome.confidenceDelta}` : "Chưa có outcome"} />
            </div>
            {canMutate ? <BrainSkillActions id={skill.id} currentStatus={skill.status} /> : null}
          </article>
        )) : <EmptyBox>Không có BrainSkill phù hợp bộ lọc.</EmptyBox>}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg-card)]"><PanelTitle>Skill runs persisted</PanelTitle>{data.runs.length ? data.runs.map((run) => <CompactRow key={run.id} title={run.skillName} detail={`${run.action} · ${run.status}${run.error ? ` · ${run.error}` : ""}`} date={run.startedAt} />) : <EmptyText>Chưa có BrainSkillRun.</EmptyText>}</div>
        <div className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg-card)]"><PanelTitle>Outcomes persisted</PanelTitle>{data.outcomes.length ? data.outcomes.map((outcome) => <CompactRow key={outcome.id} title={outcome.skillName} detail={`${outcome.metric} · ${outcome.status}${outcome.deltaPct == null ? "" : ` · ${outcome.deltaPct}%`}${outcome.notes ? ` · ${outcome.notes}` : ""}`} date={outcome.createdAt} />) : <EmptyText>Chưa có BrainSkillOutcome.</EmptyText>}</div>
      </div>
    </section>
  );
}

function MemoryContent({ data, canMutate }: { data: MemoryData; canMutate: boolean }) {
  return (
    <section className="space-y-4">
      <ProvenanceNotice provenance={data.provenance} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"><Metric label="Tổng quyết định" value={data.counts.total} /><Metric label="Success" value={data.counts.success} /><Metric label="Fail" value={data.counts.fail} /><Metric label="Neutral" value={data.counts.neutral} /><Metric label="Pending" value={data.counts.pending} /></div>
      <div className="flex flex-wrap gap-2"><FilterLink status={null} current={data.filter} /><FilterLink status="success" current={data.filter} /><FilterLink status="fail" current={data.filter} /><FilterLink status="neutral" current={data.filter} /><FilterLink status="pending" current={data.filter} /></div>
      <DecisionList title="Bộ nhớ quyết định" decisions={data.decisions} canOverride={canMutate} />
    </section>
  );
}

function OrchestratorContent({ data, canMutate }: { data: OrchestratorData; canMutate: boolean }) {
  const ownerData = canMutate ? data.ownerData : null;
  return (
    <section className="space-y-4">
      <ProvenanceNotice provenance={data.provenance} />
      <PermissionNotice canMutate={canMutate} />
      <div className="rounded-lg border border-[var(--warning)] bg-[var(--bg-card)] p-4">
        <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-sm font-bold">Execution policy hiệu lực</h2><StateBadge status={data.automationLevel} /></div>
        <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{data.executionWarning}</p>
        <Link href="/system/settings?view=automation&scope=account" className="mt-2 inline-block text-xs font-semibold text-[var(--accent)] underline">Mở Automation Settings</Link>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Metric label="Workflow persisted" value={data.workflowTotal} /><Metric label="Workflow running" value={data.runningWorkflowCount} /><Metric label="Latest orchestrator" value={data.latest ? formatDateTime(data.latest.runAt) : "Chưa chạy"} /><Metric label="Alert chưa xem" value={ownerData?.unacknowledged ?? (canMutate ? 0 : "Owner only")} /></div>
      {canMutate ? <OrchestratorActions hasUnacknowledgedAlerts={Boolean(ownerData?.unacknowledged)} /> : null}
      <OrchestratorRunPanel run={data.latest} />
      {ownerData ? <OwnerRuntimePanel ownerData={ownerData} /> : null}
      <div className="grid gap-4 xl:grid-cols-[3fr_2fr]"><WorkflowList workflows={data.workflows} /><JobList title="Job history" jobs={data.jobs} /></div>
    </section>
  );
}

function ApprovalsContent({ data, canMutate }: { data: ApprovalsData; canMutate: boolean }) {
  return (
    <section className="space-y-4">
      <ProvenanceNotice provenance={data.provenance} />
      <PermissionNotice canMutate={canMutate} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Metric label="Pending hiệu lực" value={data.counts.pending} /><Metric label="Quá timeout nhưng chưa persist" value={data.counts.timedOut} /><Metric label="Approved" value={data.counts.approved} /><Metric label="Rejected" value={data.counts.rejected} /></div>
      <ApprovalList title="Approval history" approvals={data.approvals} canMutate={canMutate} />
    </section>
  );
}

function OperationsContent({ data }: { data: OperationsData }) {
  const sync = data.spa.sync;
  return (
    <section className="space-y-4">
      <ProvenanceNotice provenance={data.provenance} />
      <div className="rounded-lg border border-[var(--warning)] bg-[var(--bg-card)] p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold">Ads deployment policy hiệu lực</h2>
          <div className="flex flex-wrap gap-2"><StateBadge status={data.ads.policy.executionMode} /><StateBadge status={data.ads.policy.effectiveAutomationLevel} />{data.ads.policy.forcedDryRun ? <StateBadge status="forced_dry_run" /> : null}</div>
        </div>
        <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">Emergency stop: {data.ads.policy.emergencyStop ? "đang bật" : "đang tắt"}. Operations chỉ cho phép chạy Ads dry-run; không có control thực thi Ads live tại đây.</p>
        <p className="mt-1 text-xs text-[var(--text-muted)]">Pause CTR dưới {data.ads.policy.pauseCtr}% · scale trên {data.ads.policy.scaleCtr}% với ROAS tối thiểu {data.ads.policy.minRoas} · cooldown {data.ads.policy.cooldownHours} giờ · trần ngân sách {formatVnd(data.ads.policy.maxBudget)}</p>
        <div className="mt-3 flex flex-wrap gap-3 text-xs font-semibold"><Link href="/system/settings?view=ads&scope=account" className="text-[var(--accent)] underline">Ads Settings</Link><Link href="/system/settings?view=automation&scope=account" className="text-[var(--accent)] underline">Automation Settings</Link></div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Metric label="Approval còn hiệu lực" value={data.approvals.length} />
        <Metric label="Ads log hôm nay (HCM)" value={data.adLogsCountToday} />
        <Metric label="Ads Page ready" value={`${data.ads.readyPageCount}/${data.ads.pages.length}`} />
        <Metric label="Hội thoại đang mở" value={data.leadConversations.length} />
        <Metric label="Lead đến hạn nurture" value={data.nurtureDueCount} />
      </div>

      <OperationsActions adsEnabled={data.ads.configuredPageCount > 0} spaConfigured={data.spa.configured} />

      <div className="grid gap-4 xl:grid-cols-[3fr_2fr]">
        <div className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg-card)]">
          <PanelTitle>Ads readiness persisted theo Page</PanelTitle>
          {data.ads.pages.length ? data.ads.pages.map((page) => (
            <article key={page.id} className="border-b border-[var(--border)] p-4 last:border-b-0">
              <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-sm font-bold">{page.pageName}</h3><p className="mt-1 text-xs text-[var(--text-muted)]">{page.adAccountId ?? "Chưa có Ad Account"} · snapshot {page.readinessCheckedAt ? formatDateTime(page.readinessCheckedAt) : "chưa kiểm tra"}</p></div><StateBadge status={page.writeBlocker ? "blocked" : "ready"} /></div>
              <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2"><RuntimeFact label="Readiness" detail={`${page.readinessStatus} · account ${page.accountStatus ?? "unavailable"} · ${page.currency ?? "currency unavailable"} · ${page.timezone ?? "timezone unavailable"}`} /><RuntimeFact label="Allowlist" detail={`Page ${page.pageAllowlisted ? "có" : "không"} · Ad Account ${page.adAccountAllowlisted ? "có" : "không"}`} /></div>
              {page.writeBlocker ? <p className="mt-3 rounded-md bg-[var(--bg-subtle)] p-3 text-xs text-[var(--warning)]">Blocker: {page.writeBlocker}</p> : null}
            </article>
          )) : <EmptyText>Chưa có Facebook Page active để đánh giá Ads readiness.</EmptyText>}
        </div>

        <div className="space-y-4">
          <div className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg-card)]">
            <PanelTitle>Spa sync persisted</PanelTitle>
            <div className="space-y-3 p-4 text-xs">
              <RuntimeFact label="Cấu hình" detail={data.spa.configured ? "Spa API URL đã cấu hình" : "Chưa cấu hình Spa API URL"} />
              <RuntimeFact label="Đồng bộ cuối" detail={sync?.lastSyncAt ? formatDateTime(sync.lastSyncAt) : "Chưa có lần đồng bộ"} />
              <RuntimeFact label="Doanh thu persisted hôm nay" detail={sync ? formatVnd(sync.revenueToday) : "Unavailable"} />
              <RuntimeFact label="Booking persisted hôm nay" detail={sync ? String(sync.bookingCountToday) : "Unavailable"} />
              {sync?.lastError ? <p className="rounded-md bg-[var(--bg-subtle)] p-3 text-[var(--rose)]">Lỗi gần nhất: {sync.lastError}</p> : null}
              <div className="flex flex-wrap gap-3 font-semibold"><Link href="/system/settings?view=connections&scope=account" className="text-[var(--accent)] underline">Connections Settings</Link><Link href="/system/settings?view=channels&scope=account" className="text-[var(--accent)] underline">Channels Settings</Link></div>
            </div>
          </div>
          <JobList title="Ads optimization jobs" jobs={data.adsJobs.map((job) => ({ ...job, name: "ads_optimize" }))} />
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg-card)]"><PanelTitle>Lead conversations đang mở</PanelTitle>{data.leadConversations.length ? data.leadConversations.map((conversation) => <CompactRow key={conversation.id} title={conversation.collectedName ?? conversation.lead.name} detail={`${conversation.collectedService ?? "Chưa rõ dịch vụ"} · step ${conversation.step}${conversation.facebookPageId ? ` · Page ${conversation.facebookPageId}` : " · Page unavailable"}`} date={conversation.updatedAt} />) : <EmptyText>Không có cuộc hội thoại đang mở.</EmptyText>}</div>
        <div className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg-card)]"><PanelTitle>Nurture pipeline persisted</PanelTitle>{data.nurtureLeads.length ? data.nurtureLeads.map((lead) => <CompactRow key={lead.id} title={lead.name} detail={`${lead.service ?? "Chưa rõ dịch vụ"} · ${lead.channelType ?? "channel unavailable"} · bước ${lead.nurtureStep + 1}${lead.due ? " · đến hạn" : ""}`} date={lead.nurtureSentAt ?? lead.createdAt} />) : <EmptyText>Không có lead trong nurture pipeline.</EmptyText>}</div>
      </div>

      <div className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg-card)]"><PanelTitle>Nhật ký Ads optimization persisted</PanelTitle>{data.adLogs.length ? data.adLogs.map((log) => <CompactRow key={log.id} title={log.campaignName} detail={`${log.action} · ${log.reason}${log.oldValue || log.newValue ? ` · ${log.oldValue ?? "—"} → ${log.newValue ?? "—"}` : ""}`} date={log.createdAt} />) : <EmptyText>Chưa có AdOptimizationLog.</EmptyText>}</div>
    </section>
  );
}

function ProvenanceNotice({ provenance }: { provenance: AIRoomsProvenance }) {
  return <div className="flex items-start gap-3 rounded-lg border border-[var(--border)] bg-[var(--bg-subtle)] p-4"><WarningCircle size={18} className="mt-0.5 shrink-0 text-[var(--warning)]" aria-hidden="true" /><div><p className="text-sm font-semibold">Dữ liệu persisted cấp tài khoản</p><p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">Nguồn: {provenance.source} · scope: {provenance.scope} · đọc lúc {formatDateTime(provenance.asOf)}</p>{provenance.warning ? <p className="mt-1 text-xs text-[var(--warning)]">{provenance.warning}</p> : null}</div></div>;
}

function PermissionNotice({ canMutate }: { canMutate: boolean }) {
  return <p className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-4 text-sm text-[var(--text-secondary)]">{canMutate ? "Owner có thể thực hiện mutation đã được audit qua các control bên dưới." : "Viewer chỉ có quyền đọc. Các control gọi provider, workflow, approval và override được ẩn; API vẫn enforce owner."}</p>;
}

function DecisionList({ title, decisions, canOverride = false }: { title: string; decisions: AIRoomDecision[]; canOverride?: boolean }) {
  return <div className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg-card)]"><PanelTitle>{title}</PanelTitle>{decisions.length ? decisions.map((decision) => <article key={decision.id} className="border-b border-[var(--border)] p-4 last:border-b-0"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-bold">{decision.topic}</h3><div className="flex gap-2"><StateBadge status={decision.source} /><StateBadge status={decision.outcomeStatus ?? "unmeasured"} /></div></div><p className="mt-2 line-clamp-4 text-sm leading-6 text-[var(--text-secondary)]">{decision.synthesis}</p><p className="mt-2 text-xs text-[var(--text-muted)]">{formatDateTime(decision.createdAt)}{decision.outcomeMetric ? ` · ${decision.outcomeMetric}` : " · Chưa có metric outcome"}</p>{canOverride ? <OutcomeOverrideAction id={decision.id} currentStatus={decision.outcomeStatus} /> : null}</article>) : <EmptyText>Chưa có CEODecision phù hợp.</EmptyText>}</div>;
}

function ApprovalList({ title, approvals, canMutate }: { title: string; approvals: AIRoomApproval[]; canMutate: boolean }) {
  return <div className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg-card)]"><PanelTitle>{title}</PanelTitle>{approvals.length ? approvals.map((approval) => <article key={approval.id} className="border-b border-[var(--border)] p-4 last:border-b-0"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-bold">{approval.type}</h3><StateBadge status={approval.effectiveStatus} /></div><p className="mt-1 text-xs text-[var(--text-muted)]">Mã {approval.shortCode} · tạo {formatDateTime(approval.createdAt)} · timeout {formatDateTime(approval.timeoutAt)}</p>{approval.summary ? <p className="mt-2 text-sm text-[var(--text-secondary)]">{approval.summary}</p> : null}{approval.executionError ? <p className="mt-2 text-xs text-[var(--rose)]">{approval.executionError}</p> : null}{canMutate && approval.effectiveStatus === "pending" ? <div className="mt-3"><ApprovalActions id={approval.id} /></div> : null}</article>) : <EmptyText>Chưa có PendingApproval persisted.</EmptyText>}</div>;
}

function OrchestratorRunPanel({ run }: { run: OrchestratorData["latest"] }) {
  if (!run) return <EmptyBox>Chưa có OrchestratorRun. GET và refresh không tự tạo run.</EmptyBox>;
  if (!run.available || !run.signals || !run.priorities || !run.actions) {
    return <EmptyBox>OrchestratorRun gần nhất có persisted JSON không hợp lệ; signals, priorities và actions được giữ unavailable thay vì quy về 0.</EmptyBox>;
  }
  const signals = run.signals;
  return (
    <div className="space-y-4 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="text-sm font-bold">Orchestrator run gần nhất</h2><p className="mt-1 text-xs text-[var(--text-muted)]">Persisted {formatDateTime(run.runAt)}</p></div><StateBadge status={run.mode} /></div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Metric label="Doanh thu 7 ngày" value={formatVnd(signals.revenue.last7)} /><Metric label="Forecast 7 ngày" value={formatVnd(signals.forecast.next7Predicted)} /><Metric label="Lead nóng chưa chốt" value={signals.leads.hotUnclosed} /><Metric label="Đối thủ viral" value={signals.competitor.surgeCount} /></div>
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="overflow-hidden rounded-lg border border-[var(--border)]"><PanelTitle>Priorities đã xếp hạng</PanelTitle>{run.priorities.length ? run.priorities.map((priority, index) => <article key={`${priority.agent}-${index}`} className="border-b border-[var(--border)] p-4 last:border-b-0"><div className="flex items-center justify-between gap-2"><h3 className="text-sm font-bold">{index + 1}. {priority.agent}</h3><strong className="text-sm">{priority.score}/100</strong></div><p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">{priority.reason}</p><p className="mt-1 text-xs text-[var(--text-muted)]">Đề xuất: {priority.recommendedAction}</p></article>) : <EmptyText>Run này không có priority.</EmptyText>}</div>
        <div className="overflow-hidden rounded-lg border border-[var(--border)]"><PanelTitle>Action states persisted</PanelTitle>{run.actions.length ? run.actions.map((action, index) => <article key={`${action.agent}-${index}`} className="border-b border-[var(--border)] p-4 last:border-b-0"><div className="flex items-center justify-between gap-2"><h3 className="text-sm font-bold">{action.agent}</h3><StateBadge status={action.status} /></div><p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">{action.action}</p></article>) : <EmptyText>Run này không có action.</EmptyText>}</div>
      </div>
      <details className="rounded-lg bg-[var(--bg-subtle)] p-4"><summary className="cursor-pointer text-sm font-bold">Full signal snapshot</summary><div className="mt-3 grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-3"><SignalFact label="Revenue delta" value={formatPercent(signals.revenue.deltaPct)} /><SignalFact label="Lead mới hôm nay" value={signals.leads.newToday} /><SignalFact label="Lead lạnh chưa nurture" value={signals.leads.coldNoNurture} /><SignalFact label="Inbox chưa đọc" value={signals.inbox.unread} /><SignalFact label="Comment tiêu cực" value={signals.comments.negativeUnreplied} /><SignalFact label="Approval chờ >24h" value={signals.approvals.pendingOver24h} /><SignalFact label="Bài lịch ngày mai" value={signals.posts.scheduledTomorrow} /><SignalFact label="Engagement 7d" value={Math.round(signals.posts.engagement7dAvg)} /><SignalFact label="Engagement 14d prior" value={Math.round(signals.posts.engagement14dPriorAvg)} /><SignalFact label="Forecast vs average" value={formatPercent(signals.forecast.vsAverage)} /><SignalFact label="Decision fail 30d" value={signals.pendingDecisionFails} /></div></details>
    </div>
  );
}

function OwnerRuntimePanel({ ownerData }: { ownerData: NonNullable<OrchestratorData["ownerData"]> }) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <div className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg-card)]"><PanelTitle>Realtime alerts owner-only</PanelTitle>{ownerData.alerts.length ? ownerData.alerts.map((alert) => <article key={alert.id} className="flex items-start gap-3 border-b border-[var(--border)] p-4 last:border-b-0"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-bold">{alert.type}</h3><StateBadge status={alert.severity} />{alert.acknowledged ? <StateBadge status="acknowledged" /> : null}</div><p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">{alert.signal}</p><p className="mt-1 text-[10px] text-[var(--text-muted)]">{formatDateTime(alert.detectedAt)}{alert.workflowRunId ? ` · workflow ${alert.workflowRunId}` : ""}</p></div>{!alert.acknowledged ? <RealtimeAlertAction id={alert.id} /> : null}</article>) : <EmptyText>Chưa có RealtimeAlert.</EmptyText>}</div>
      <div className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg-card)]"><PanelTitle>API quota owner-only</PanelTitle>{ownerData.quotas.length ? ownerData.quotas.map((quota) => <article key={quota.key} className="border-b border-[var(--border)] p-4 last:border-b-0"><div className="flex items-center justify-between gap-3"><h3 className="break-all text-xs font-bold">{quota.key}</h3><span className="shrink-0 text-xs tabular-nums">{quota.used}/{quota.limit}</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--bg-subtle)]"><div className="h-full bg-[var(--accent)]" style={{ width: `${Math.min(100, Math.max(0, quota.pct))}%` }} /></div><p className="mt-1 text-[10px] text-[var(--text-muted)]">{quota.pct}% · reset trong {quota.windowEndsIn}s</p></article>) : <EmptyText>Chưa có quota bucket persisted.</EmptyText>}</div>
    </div>
  );
}

function WorkflowList({ workflows }: { workflows: AIRoomWorkflowRun[] }) {
  return <div className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg-card)]"><PanelTitle>Workflow history</PanelTitle>{workflows.length ? workflows.map((workflow) => <details key={workflow.id} className="border-b border-[var(--border)] p-4 last:border-b-0"><summary className="cursor-pointer list-none"><div className="flex items-start justify-between gap-3"><div><h3 className="text-sm font-semibold">{workflow.name}</h3><p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">{workflow.trigger} · {formatDateTime(workflow.startedAt)}</p></div><StateBadge status={workflow.status} /></div></summary><div className="mt-3 space-y-2">{workflow.steps === null ? <p className="rounded-md bg-[var(--bg-subtle)] p-3 text-xs text-[var(--warning)]">Persisted workflow steps không hợp lệ và được giữ unavailable.</p> : workflow.steps.length ? workflow.steps.map((step, index) => <article key={`${step.agent}-${index}`} className="rounded-md bg-[var(--bg-subtle)] p-3"><div className="flex flex-wrap items-center justify-between gap-2"><h4 className="text-xs font-bold">{step.label}</h4><div className="flex items-center gap-2"><StateBadge status={step.status} /><span className="text-[10px] text-[var(--text-muted)]">{step.durationMs}ms</span></div></div><p className={`mt-2 whitespace-pre-wrap text-xs leading-5 ${step.status === "failed" ? "text-[var(--rose)]" : "text-[var(--text-secondary)]"}`}>{step.output}</p></article>) : <p className="text-xs text-[var(--text-muted)]">Workflow chưa persist stage nào.</p>}{workflow.plan ? <div className="rounded-md border border-[var(--border)] p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-muted)]">Plan</p><p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-[var(--text-secondary)]">{workflow.plan}</p></div> : null}</div></details>) : <EmptyText>Chưa có WorkflowRun.</EmptyText>}</div>;
}

function JobList({ title, jobs }: { title: string; jobs: AIRoomJobRun[] }) {
  return <div className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg-card)]"><PanelTitle>{title}</PanelTitle>{jobs.length ? jobs.map((job) => <CompactRow key={job.id} title={job.name} detail={`${job.trigger} · ${job.status}${job.summary ? ` · ${job.summary}` : ""}`} date={job.startedAt} />) : <EmptyText>Chưa có JobRun.</EmptyText>}</div>;
}

function brainFilterHref(filters: { domain?: string; category?: string; status?: string; risk?: string; q?: string }) {
  const params = new URLSearchParams({ view: "brain", scope: "account" });
  for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value);
  return `/system/ai-rooms?${params.toString()}`;
}

function FilterSelect({ name, label, value, options, disabled = false }: { name: string; label: string; value: string; options: Array<{ value: string; label: string }>; disabled?: boolean }) {
  return <label className="text-xs font-semibold text-[var(--text-secondary)]">{label}<select name={name} defaultValue={value} disabled={disabled} className="mt-1.5 min-h-11 w-full rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] px-3 text-sm"><option value="">Tất cả</option>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;
}

function BrainMetadata({ label, value }: { label: string; value: string }) { return <div className="rounded-md bg-[var(--bg-subtle)] p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-muted)]">{label}</p><p className="mt-1 break-words text-xs leading-5 text-[var(--text-secondary)]">{value}</p></div>; }
function SignalFact({ label, value }: { label: string; value: string | number }) { return <p className="flex items-center justify-between gap-3 rounded-md bg-[var(--bg-card)] p-3 text-[var(--text-secondary)]"><span>{label}</span><strong className="text-[var(--text)]">{value}</strong></p>; }
function formatVnd(value: number) { return `${Math.round(value).toLocaleString("vi-VN")}đ`; }
function formatPercent(value: number) { return `${value >= 0 ? "+" : ""}${Math.round(value * 100)}%`; }
function RuntimeFact({ label, detail }: { label: string; detail: string }) { return <p className="rounded-md border border-[var(--border)] p-3 text-[var(--text-secondary)]"><strong>{label}:</strong> {detail}</p>; }
function CompactRow({ title, detail, date }: { title: string; detail: string; date: string }) { return <article className="border-b border-[var(--border)] p-4 last:border-b-0"><div className="flex items-start justify-between gap-3"><div><h3 className="text-sm font-semibold">{title}</h3><p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">{detail}</p></div><time className="shrink-0 text-[10px] text-[var(--text-muted)]">{formatDateTime(date)}</time></div></article>; }
function Metric({ label, value }: { label: string; value: string | number }) { return <article className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-4"><p className="text-2xl font-extrabold">{typeof value === "number" ? value.toLocaleString("vi-VN") : value}</p><p className="mt-1 text-xs text-[var(--text-muted)]">{label}</p></article>; }
function PanelTitle({ children }: { children: React.ReactNode }) { return <div className="border-b border-[var(--border)] p-4"><h2 className="text-sm font-bold">{children}</h2></div>; }
function EmptyText({ children }: { children: React.ReactNode }) { return <p className="p-8 text-center text-sm text-[var(--text-muted)]">{children}</p>; }
function EmptyBox({ children }: { children: React.ReactNode }) { return <p className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-8 text-center text-sm text-[var(--text-muted)]">{children}</p>; }
function StateBadge({ status }: { status: string }) { const variant = status === "completed" || status === "success" || status === "approved" || status === "active" ? "success" : status === "failed" || status === "fail" || status === "rejected" ? "danger" : status === "pending" || status === "running" || status === "high" || status === "timed_out" ? "warning" : "neutral"; return <Badge variant={variant}>{status}</Badge>; }
function RoomLink({ href, title, description }: { href: string; title: string; description: string }) { return <Link href={href} className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-5 hover:bg-[var(--bg-subtle)]"><h3 className="font-bold">{title}</h3><p className="mt-1 text-sm text-[var(--text-muted)]">{description}</p></Link>; }
function FilterLink({ status, current }: { status: string | null; current: string | null }) { const href = status ? `/system/ai-rooms?view=memory&scope=account&status=${status}` : "/system/ai-rooms?view=memory&scope=account"; return <Link href={href} className={`rounded-full px-3 py-2 text-xs font-semibold ${current === status ? "bg-[var(--accent)] text-white" : "bg-[var(--bg-subtle)] text-[var(--text-secondary)]"}`}>{status ?? "Tất cả"}</Link>; }
