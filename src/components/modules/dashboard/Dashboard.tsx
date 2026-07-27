import Link from "next/link";
import {
  ArrowRight,
  CalendarCheck,
  ChartBar,
  ChatCircleDots,
  CheckCircle,
  Clock,
  CurrencyCircleDollar,
  Envelope,
  FilmSlate,
  HeartStraight,
  Info,
  Megaphone,
  PaperPlaneTilt,
  PencilSimple,
  SealCheck,
  UserPlus,
  UsersThree,
  WarningCircle,
  XCircle,
} from "@phosphor-icons/react/dist/ssr";
import type { TodayData } from "@/lib/today";
import { BUSINESS_TIME_ZONE } from "@/lib/today-policy";

type Icon = typeof CheckCircle;
type Tone = "purple" | "blue" | "rose" | "green" | "amber" | "danger" | "muted";
type TagTone = "amber" | "rose-solid" | "green" | "muted" | "danger" | "blue";
type QueueItem = TodayData["todayQueue"][number];

const TONE_CHIP: Record<Tone, string> = {
  purple: "bg-[var(--purple-light)] text-[var(--purple)]",
  blue: "bg-[var(--blue-light)] text-[var(--blue)]",
  rose: "bg-[var(--rose-light)] text-[var(--rose)]",
  green: "bg-[var(--green-light)] text-[var(--green)]",
  amber: "bg-[var(--amber-light)] text-[var(--amber)]",
  danger: "bg-[var(--danger-light)] text-[var(--danger)]",
  muted: "bg-[var(--bg-subtle)] text-[var(--text-muted)]",
};

const QUEUE_ICON: Record<string, { icon: Icon; tone: Tone }> = {
  approval: { icon: SealCheck, tone: "purple" },
  review: { icon: FilmSlate, tone: "purple" },
  alert: { icon: WarningCircle, tone: "danger" },
  lead: { icon: UserPlus, tone: "green" },
  message: { icon: ChatCircleDots, tone: "blue" },
  appointment: { icon: CalendarCheck, tone: "blue" },
  publish: { icon: PaperPlaneTilt, tone: "amber" },
  care: { icon: HeartStraight, tone: "rose" },
};

const PRIORITY_LABEL: Record<string, { label: string; tone: Tone; stripe: string }> = {
  critical: { label: "Gấp", tone: "danger", stripe: "var(--danger)" },
  high: { label: "Cao", tone: "amber", stripe: "var(--warning)" },
  medium: { label: "Trung bình", tone: "blue", stripe: "var(--blue)" },
  low: { label: "Thấp", tone: "muted", stripe: "var(--border-strong)" },
};

function money(value: number) {
  return `${Math.round(value).toLocaleString("vi-VN")}`;
}

function greetingFor(hour: number) {
  if (hour < 11) return "Chào buổi sáng";
  if (hour < 14) return "Chào buổi trưa";
  if (hour < 18) return "Chào buổi chiều";
  return "Chào buổi tối";
}

function formatTime(asOf: Date) {
  return new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit", timeZone: BUSINESS_TIME_ZONE }).format(asOf);
}

/** Page heading for the Hôm nay workspace — passed to WorkspaceShell as its header. */
export function DashboardHeading({ data, userName }: { data: TodayData; userName?: string | null }) {
  const asOf = new Date(data.context.asOf);
  const rawName = (userName || "bạn").trim().split(/\s+/).slice(-1)[0];
  const firstName = rawName.charAt(0).toUpperCase() + rawName.slice(1);
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hour12: false, timeZone: BUSINESS_TIME_ZONE }).format(asOf),
  );
  const dateLabel = new Intl.DateTimeFormat("vi-VN", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: BUSINESS_TIME_ZONE,
  }).format(asOf);

  return (
    <div>
      <h1 className="text-[23px] font-extrabold leading-tight tracking-tight">
        {greetingFor(hour)}, {firstName}! <span aria-hidden="true">👋</span>
      </h1>
      <p className="mt-1.5 text-[13.5px] text-[var(--text-secondary)]">
        Đây là tổng quan công việc và cơ hội tăng trưởng hôm nay.
      </p>
      <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-[var(--text-muted)]">
        <span className="flex items-center gap-1.5 capitalize"><CalendarCheck size={14} aria-hidden="true" />{dateLabel}</span>
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--success)]" />Cập nhật {formatTime(asOf)}
        </span>
      </p>
    </div>
  );
}

export function Dashboard({ data }: { data: TodayData }) {
  const asOf = new Date(data.context.asOf);
  const refreshedAt = formatTime(asOf);

  const queue = data.todayQueue.slice(0, 5);
  const alerts = data.activity.slice(0, 4);
  const contentReview = data.contentFactory.itemsNeedingReview.slice(0, 3);
  const leads = data.hotLeads.slice(0, 3);
  const adsActions = data.adsCommand.recentActions.slice(0, 3);
  const workflows = data.aiTasks.recentWorkflowRuns.slice(0, 4);

  return (
    <div>
      <section className="grid grid-cols-2 gap-3.5 lg:grid-cols-3 xl:grid-cols-5">
        <Kpi
          icon={CurrencyCircleDollar}
          tone="blue"
          label="Doanh thu hôm nay"
          value={money(data.metrics.revenueToday.value)}
          unit="đ"
          note={`${data.metrics.paidBookingsToday.value} giao dịch đã ghi nhận`}
          className="rise"
        />
        <Kpi
          icon={CalendarCheck}
          tone="purple"
          label="Lịch chờ xác nhận"
          value={String(data.stats.pendingAppointments)}
          note={data.stats.pendingAppointments > 0 ? "Cần xác nhận với khách" : "Không có lịch chờ"}
          noteTone={data.stats.pendingAppointments > 0 ? "warn" : undefined}
          className="rise rise-1"
        />
        <Kpi
          icon={HeartStraight}
          tone="rose"
          label="Khách cần chăm sóc"
          value={String(data.stats.pendingCare)}
          note={`${data.stats.hotLeads} khách cần ưu tiên`}
          noteTone={data.stats.pendingCare > 0 ? "crit" : undefined}
          className="rise rise-2"
        />
        <Kpi
          icon={UserPlus}
          tone="green"
          label="Khách mới hôm nay"
          value={String(data.metrics.leadsToday.value)}
          note={`${data.stats.totalCustomers.toLocaleString("vi-VN")} khách trong hệ thống`}
          className="rise rise-3"
        />
        <Kpi
          icon={Envelope}
          tone="amber"
          label="Tin nhắn chưa đọc"
          value={String(data.metrics.unreadMessages.value)}
          note={data.kpis.pendingApprovals > 0 ? `${data.kpis.pendingApprovals} việc chờ duyệt` : "Không có việc chờ duyệt"}
          noteTone={data.metrics.unreadMessages.value > 0 ? "warn" : undefined}
          className="rise rise-4"
        />
      </section>

      <div className="mt-4 grid items-start gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <Panel className="rise rise-2">
          <PanelHead title="Việc cần ưu tiên hôm nay" meta={`${data.kpis.queueTotal} đang chờ`} />
          {queue.length > 0 ? (
            <ul className="space-y-2.5">
              {queue.map((item) => <TaskRow key={item.id} item={item} />)}
            </ul>
          ) : (
            <Empty icon={CheckCircle} text="Không có việc gấp cần xử lý." tone="green" />
          )}
          {data.kpis.queueTotal > queue.length && (
            <Link href="/?view=queue" className="mt-3 flex min-h-11 items-center justify-center gap-1.5 text-[12.5px] font-bold text-[var(--accent)] hover:opacity-70">
              Xem tất cả công việc <ArrowRight size={14} aria-hidden="true" />
            </Link>
          )}
        </Panel>

        <div className="space-y-4">
          <Panel className="rise rise-3">
            <PanelHead title="Cảnh báo & thông tin quan trọng" link={{ href: "/system", label: "Xem tất cả" }} />
            {alerts.length > 0 ? (
              <ul>
                {alerts.map((item) => (
                  <li key={item.id} className="row-hover -mx-1.5 flex items-center gap-3 rounded-[9px] px-1.5 py-2.5">
                    <Chip icon={severityIcon(item.severity)} tone={severityTone(item.severity)} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold">{item.title}</p>
                      {item.detail && <p className="mt-0.5 truncate text-[11.5px] text-[var(--text-muted)]">{item.detail}</p>}
                    </div>
                    {item.href && (
                      <Link href={item.href} className="shrink-0 rounded-[8px] border border-[var(--border-strong)] px-2.5 py-1.5 text-[12px] font-semibold text-[var(--text-secondary)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]">
                        Xem
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <Empty icon={CheckCircle} text="Không có cảnh báo nào." tone="green" />
            )}
          </Panel>

          <Panel className="rise rise-4">
            <PanelHead title="Tình trạng vận hành" meta={`${refreshedAt} hôm nay`} />
            <ul>
              <OpRow icon={FilmSlate} tone="purple" title="Nội dung" detail={`${data.contentFactory.scheduledToday} lên lịch hôm nay · ${data.contentFactory.reviewBlocked} bị chặn`} />
              <OpRow icon={Megaphone} tone="amber" title="Quảng cáo" detail={`${data.adsCommand.actionsToday} hành động · ${data.adsCommand.pendingApprovals} chờ duyệt`} />
              <OpRow icon={UsersThree} tone="rose" title="Chăm sóc khách" detail={`${data.stats.pendingCare} đang chờ · ${data.stats.hotLeads} cần ưu tiên`} />
              <OpRow
                icon={data.aiTasks.failedJobs > 0 ? XCircle : CheckCircle}
                tone={data.aiTasks.failedJobs > 0 ? "danger" : "green"}
                title="Tác vụ AI"
                detail={data.aiTasks.failedJobs > 0 ? `${data.aiTasks.failedJobs} tác vụ bị lỗi` : "Không có tác vụ lỗi"}
              />
            </ul>
          </Panel>
        </div>
      </div>

      <div className="mt-4 grid items-start gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Panel className="rise rise-3">
          <PanelHead title="Nội dung chờ duyệt" link={{ href: "/creative/content", label: `Tất cả (${data.contentFactory.reviewBlocked})` }} />
          {contentReview.length > 0 ? (
            <ul>
              {contentReview.map((item) => (
                <MiniRow
                  key={item.id}
                  href={item.href}
                  icon={PencilSimple}
                  tone="purple"
                  title={item.caption}
                  meta={item.platform}
                  tag={{ label: "Chờ duyệt", tone: "amber" }}
                />
              ))}
            </ul>
          ) : (
            <Empty icon={CheckCircle} text="Không có nội dung chờ duyệt." tone="green" />
          )}
        </Panel>

        <Panel className="rise rise-3">
          <PanelHead title="Lead cần xử lý" link={{ href: "/customers/sales", label: `Tất cả (${data.leadPipeline.total})` }} />
          {leads.length > 0 ? (
            <ul>
              {leads.map((lead) => (
                <MiniRow
                  key={lead.id}
                  href={lead.href}
                  initials={lead.name}
                  tone={lead.score >= 70 ? "rose" : "amber"}
                  title={lead.name}
                  meta={lead.service || lead.source || lead.stage}
                  tag={{ label: lead.score >= 70 ? "Hot" : "Warm", tone: lead.score >= 70 ? "rose-solid" : "amber" }}
                />
              ))}
            </ul>
          ) : (
            <Empty icon={CheckCircle} text="Không có lead cần xử lý." tone="green" />
          )}
        </Panel>

        <Panel className="rise rise-4">
          <PanelHead title="Quảng cáo gần đây" link={{ href: "/growth/ads", label: "Xem Ads" }} />
          {adsActions.length > 0 ? (
            <ul>
              {adsActions.map((action) => (
                <MiniRow
                  key={action.id}
                  icon={Megaphone}
                  tone="amber"
                  title={action.campaignName || action.action}
                  meta={action.reason || action.action}
                />
              ))}
            </ul>
          ) : (
            <Empty icon={Info} text="Chưa có hành động quảng cáo." tone="muted" />
          )}
        </Panel>

        <Panel className="rise rise-4">
          <PanelHead title="AI Workflow gần đây" link={{ href: "/system/ai-rooms?view=operations&scope=account", label: "Tất cả" }} />
          {workflows.length > 0 ? (
            <ul>
              {workflows.map((run) => (
                <MiniRow
                  key={run.id}
                  icon={statusIcon(run.status)}
                  tone={statusTone(run.status)}
                  title={run.name}
                  meta={run.trigger}
                  tag={{ label: statusLabel(run.status), tone: statusTagTone(run.status) }}
                />
              ))}
            </ul>
          ) : (
            <Empty icon={Info} text="Chưa có workflow nào chạy." tone="muted" />
          )}
        </Panel>
      </div>
    </div>
  );
}

/* ── pieces ─────────────────────────────────────────────── */

function Panel({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return (
    <section className={`surface-hover rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--bg-card)] p-[18px] shadow-[var(--shadow-sm)] ${className}`}>
      {children}
    </section>
  );
}

function PanelHead({ title, meta, link }: { title: string; meta?: string; link?: { href: string; label: string } }) {
  return (
    <div className="mb-3.5 flex items-center justify-between gap-3">
      <h3 className="text-[14.5px] font-bold">{title}</h3>
      {meta && <span className="shrink-0 text-[12px] text-[var(--text-muted)]">{meta}</span>}
      {link && (
        <Link href={link.href} className="shrink-0 text-[12.5px] font-bold text-[var(--accent)] transition-opacity hover:opacity-70">
          {link.label}
        </Link>
      )}
    </div>
  );
}

function Chip({ icon: IconComponent, tone, size = "md" }: { icon: Icon; tone: Tone; size?: "sm" | "md" | "lg" }) {
  const box = size === "lg" ? "h-[38px] w-[38px] rounded-[11px]" : size === "sm" ? "h-[30px] w-[30px] rounded-[8px]" : "h-[34px] w-[34px] rounded-[9px]";
  return (
    <span className={`chip-tone flex shrink-0 items-center justify-center ${box} ${TONE_CHIP[tone]}`}>
      <IconComponent size={size === "lg" ? 19 : size === "sm" ? 15 : 17} weight="bold" aria-hidden="true" />
    </span>
  );
}

function Kpi({
  icon,
  tone,
  label,
  value,
  unit,
  note,
  noteTone,
  className = "",
}: {
  icon: Icon;
  tone: Tone;
  label: string;
  value: string;
  unit?: string;
  note: string;
  noteTone?: "warn" | "crit";
  className?: string;
}) {
  const noteClass = noteTone === "crit" ? "text-[var(--danger)] font-bold" : noteTone === "warn" ? "text-[var(--warning)] font-bold" : "text-[var(--text-muted)]";
  return (
    <article className={`card-hover rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--bg-card)] p-4 shadow-[var(--shadow-sm)] ${className}`}>
      <div className="mb-3 flex items-center justify-between">
        <Chip icon={icon} tone={tone} size="lg" />
      </div>
      <p className="text-[11.5px] font-semibold uppercase tracking-[0.03em] text-[var(--text-muted)]">{label}</p>
      <p className="mt-1 text-[26px] font-extrabold leading-none tabular-nums tracking-tight">
        {value}{unit && <span className="ml-0.5 text-[15px] font-bold text-[var(--text-muted)]">{unit}</span>}
      </p>
      <p className={`mt-1.5 text-[12px] ${noteClass}`}>{note}</p>
    </article>
  );
}

function TaskRow({ item }: { item: QueueItem }) {
  const meta = QUEUE_ICON[item.type] ?? { icon: Info, tone: "muted" as Tone };
  const priority = PRIORITY_LABEL[item.priority] ?? PRIORITY_LABEL.low;
  const isPrimary = item.priority === "critical";
  return (
    <li
      className="row-hover flex items-center gap-3 rounded-[11px] border border-[var(--border)] p-3"
      style={{ borderLeft: `3px solid ${priority.stripe}` }}
    >
      <Chip icon={meta.icon} tone={meta.tone} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13.5px] font-semibold">{item.title}</p>
        <p className="mt-1 flex items-center gap-2 text-[11.5px] text-[var(--text-muted)]">
          <span className="truncate">{item.detail}</span>
          <Tag label={priority.label} tone={priority.tone === "danger" ? "danger" : priority.tone === "amber" ? "amber" : priority.tone === "blue" ? "blue" : "muted"} />
        </p>
      </div>
      <Link
        href={item.href}
        className={`flex min-h-9 shrink-0 items-center rounded-[8px] px-3.5 text-[12.5px] font-bold transition-colors ${
          isPrimary
            ? "bg-[var(--accent)] text-[var(--accent-foreground)] hover:bg-[var(--accent-hover)]"
            : "border border-[var(--border-strong)] text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
        }`}
      >
        {item.primaryAction}
      </Link>
    </li>
  );
}

function OpRow({ icon, tone, title, detail }: { icon: Icon; tone: Tone; title: string; detail: string }) {
  return (
    <li className="row-hover -mx-1.5 flex items-center gap-3 rounded-[9px] px-1.5 py-2.5">
      <Chip icon={icon} tone={tone} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold">{title}</p>
        <p className="mt-0.5 truncate text-[11.5px] text-[var(--text-muted)]">{detail}</p>
      </div>
    </li>
  );
}

function MiniRow({
  href,
  icon,
  initials,
  tone,
  title,
  meta,
  tag,
}: {
  href?: string;
  icon?: Icon;
  initials?: string;
  tone: Tone;
  title: string;
  meta?: string | null;
  tag?: { label: string; tone: TagTone };
}) {
  const body = (
    <>
      {icon && <Chip icon={icon} tone={tone} size="sm" />}
      {initials && (
        <span className={`chip-tone flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${TONE_CHIP[tone]}`}>
          {initials.trim().slice(0, 2).toUpperCase()}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12.5px] font-semibold">{title}</p>
        {meta && <p className="mt-0.5 truncate text-[11px] text-[var(--text-muted)]">{meta}</p>}
      </div>
      {tag && <Tag label={tag.label} tone={tag.tone} />}
    </>
  );
  const className = "row-hover -mx-1.5 flex items-center gap-2.5 rounded-[9px] px-1.5 py-2.5";
  if (href) return <li><Link href={href} className={className}>{body}</Link></li>;
  return <li className={className}>{body}</li>;
}

function Tag({ label, tone }: { label: string; tone: TagTone }) {
  const styles: Record<TagTone, string> = {
    amber: "bg-[var(--amber-light)] text-[var(--amber)]",
    "rose-solid": "bg-[var(--rose)] text-white",
    green: "bg-[var(--green-light)] text-[var(--green)]",
    danger: "bg-[var(--danger-light)] text-[var(--danger)]",
    blue: "bg-[var(--blue-light)] text-[var(--blue)]",
    muted: "bg-[var(--bg-subtle)] text-[var(--text-muted)] border border-[var(--border)]",
  };
  return <span className={`shrink-0 rounded-[5px] px-2 py-0.5 text-[10.5px] font-bold ${styles[tone]}`}>{label}</span>;
}

function Empty({ icon: IconComponent, text, tone }: { icon: Icon; text: string; tone: Tone }) {
  const color = tone === "green" ? "text-[var(--success)]" : "text-[var(--text-muted)]";
  return (
    <div className={`flex items-center gap-2.5 py-6 text-[13px] ${color}`}>
      <IconComponent size={20} weight="fill" aria-hidden="true" />{text}
    </div>
  );
}

/* ── status helpers ─────────────────────────────────────── */

function severityTone(severity?: string | null): Tone {
  if (severity === "critical" || severity === "error") return "danger";
  if (severity === "warning") return "amber";
  if (severity === "success") return "green";
  return "blue";
}

function severityIcon(severity?: string | null): Icon {
  if (severity === "critical" || severity === "error" || severity === "warning") return WarningCircle;
  if (severity === "success") return CheckCircle;
  return Info;
}

function statusTone(status?: string | null): Tone {
  if (status === "failed" || status === "error") return "danger";
  if (status === "running" || status === "pending") return "blue";
  if (status === "completed" || status === "success") return "green";
  return "muted";
}

function statusIcon(status?: string | null): Icon {
  if (status === "failed" || status === "error") return XCircle;
  if (status === "running" || status === "pending") return Clock;
  if (status === "completed" || status === "success") return CheckCircle;
  return ChartBar;
}

function statusLabel(status?: string | null) {
  if (status === "failed" || status === "error") return "Lỗi";
  if (status === "running") return "Đang chạy";
  if (status === "pending") return "Chờ";
  if (status === "completed" || status === "success") return "Hoàn thành";
  return status || "—";
}

function statusTagTone(status?: string | null): TagTone {
  if (status === "failed" || status === "error") return "danger";
  if (status === "running" || status === "pending") return "blue";
  if (status === "completed" || status === "success") return "green";
  return "muted";
}
