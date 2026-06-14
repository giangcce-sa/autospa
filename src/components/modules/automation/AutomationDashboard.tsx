"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import {
  CheckCircle, XCircle, Clock, Robot, Megaphone,
  ArrowsClockwise, ChatCircleDots, Warning, Spinner,
} from "@phosphor-icons/react";

interface Approval {
  id: string;
  type: string;
  payload: string;
  shortCode: string;
  timeoutAt: string;
  createdAt: string;
}

interface AdLog {
  id: string;
  campaignName: string;
  action: string;
  reason: string;
  oldValue: string | null;
  newValue: string | null;
  createdAt: string;
}

interface SpaSync {
  lastSyncAt: string | null;
  revenueToday: number;
  bookingCountToday: number;
  lastError: string | null;
  lastPublishRun: string | null;
  lastAdsOptRun: string | null;
}

interface LeadConv {
  id: string;
  senderId: string;
  step: number;
  collectedName: string | null;
  collectedService: string | null;
  updatedAt: string;
  lead: { name: string; phone: string | null };
}

interface NurtureLead {
  id: string;
  name: string;
  service: string | null;
  channelType: string | null;
  nurtureStep: number;
  nurtureSentAt: string | null;
  createdAt: string;
}

interface DashData {
  approvals: Approval[];
  adLogs: AdLog[];
  adLogsCountToday: number;
  spaSync: SpaSync | null;
  leadConversations: LeadConv[];
  nurtureLeads: NurtureLead[];
  nurtureDueCount: number;
}

const ACTION_LABELS: Record<string, string> = {
  paused: "Tạm dừng",
  scaled_budget: "Tăng ngân sách",
  flagged_refresh: "Cần đổi creative",
  skipped: "Bỏ qua",
  pending_approval: "Chờ duyệt",
};

const ACTION_BADGE: Record<string, "danger" | "success" | "warning" | "neutral" | "info"> = {
  paused: "danger",
  scaled_budget: "success",
  flagged_refresh: "warning",
  skipped: "neutral",
  pending_approval: "info",
};

const TYPE_LABELS: Record<string, string> = {
  content_plan: "Kế hoạch nội dung",
  budget_increase: "Tăng ngân sách",
  pause_campaign: "Tạm dừng chiến dịch",
  flash_deal: "Flash deal",
};

const STEP_LABELS = ["Khởi tạo", "Hỏi tên", "Hỏi dịch vụ", "Hỏi lịch", "Hoàn tất"];

function timeAgo(dateStr: string): string {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return "vừa xong";
  if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`;
  return `${Math.floor(diff / 86400)} ngày trước`;
}

function timeLeft(dateStr: string): string {
  const diff = (new Date(dateStr).getTime() - Date.now()) / 1000;
  if (diff <= 0) return "Hết hạn";
  if (diff < 3600) return `còn ${Math.floor(diff / 60)} phút`;
  return `còn ${Math.floor(diff / 3600)}h`;
}

function StatCard({ icon, label, value, sub, color }: {
  icon: React.ReactNode; label: string; value: string | number; sub?: string; color?: string;
}) {
  return (
    <div className="rounded-xl p-4 flex flex-col gap-1" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
      <div className="flex items-center gap-2 mb-1" style={{ color: color ?? "var(--text-muted)" }}>
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="text-2xl font-bold" style={{ color: "var(--text)" }}>{value}</p>
      {sub && <p className="text-xs" style={{ color: "var(--text-muted)" }}>{sub}</p>}
    </div>
  );
}

export function AutomationDashboard() {
  const [data, setData] = useState<DashData | null>(null);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/automation");
    const json = await res.json();
    if (json.success) setData(json.data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const resolve = async (id: string, decision: "approved" | "rejected") => {
    setResolving(id + decision);
    await fetch("/api/approvals", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, decision }),
    });
    await load();
    setResolving(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20" style={{ color: "var(--text-muted)" }}>
        <Spinner size={24} className="animate-spin" />
      </div>
    );
  }

  const { approvals = [], adLogs = [], adLogsCountToday = 0, spaSync, leadConversations = [], nurtureLeads = [], nurtureDueCount = 0 } = data ?? {};

  return (
    <div className="space-y-5">
      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard
          icon={<Warning size={14} />}
          label="Chờ duyệt"
          value={approvals.length}
          sub={approvals.length > 0 ? "cần xử lý" : "không có gì"}
          color={approvals.length > 0 ? "var(--amber)" : undefined}
        />
        <StatCard
          icon={<Megaphone size={14} />}
          label="Tối ưu ads hôm nay"
          value={adLogsCountToday}
          sub="hành động"
        />
        <StatCard
          icon={<ChatCircleDots size={14} />}
          label="Lead đang chat"
          value={leadConversations.length}
          sub="cuộc hội thoại"
        />
        <StatCard
          icon={<Robot size={14} />}
          label="Cần nurture"
          value={nurtureDueCount}
          sub={`/ ${nurtureLeads.length} đang theo dõi`}
          color={nurtureDueCount > 0 ? "var(--blue)" : undefined}
        />
        <StatCard
          icon={<ArrowsClockwise size={14} />}
          label="Doanh thu hôm nay"
          value={spaSync ? `${spaSync.revenueToday.toLocaleString("vi-VN")}đ` : "—"}
          sub={spaSync?.bookingCountToday ? `${spaSync.bookingCountToday} lịch hẹn` : "chưa đồng bộ"}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Pending Approvals */}
        <Card>
          <CardHeader>
            <CardTitle>Chờ duyệt</CardTitle>
            <Button size="sm" variant="secondary" onClick={load}>
              <ArrowsClockwise size={13} />
            </Button>
          </CardHeader>
          {approvals.length === 0 ? (
            <p className="px-5 pb-5 text-sm" style={{ color: "var(--text-muted)" }}>Không có approval nào đang chờ.</p>
          ) : (
            <div className="divide-y" style={{ borderColor: "var(--border)" }}>
              {approvals.map((a) => {
                let payloadObj: Record<string, unknown> = {};
                try { payloadObj = JSON.parse(a.payload); } catch {}
                return (
                  <div key={a.id} className="px-5 py-3.5 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium" style={{ color: "var(--text)" }}>
                          {TYPE_LABELS[a.type] ?? a.type}
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                          Mã: <span className="font-mono font-bold">{a.shortCode}</span> · {timeLeft(a.timeoutAt)}
                        </p>
                      </div>
                      <Badge variant="warning">Chờ duyệt</Badge>
                    </div>
                    {payloadObj.campaignName != null && (
                      <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                        {`Chiến dịch: ${String(payloadObj.campaignName)}`}
                        {payloadObj.oldBudget != null && payloadObj.newBudget != null
                          ? ` · ${Number(payloadObj.oldBudget).toLocaleString("vi-VN")}đ → ${Number(payloadObj.newBudget).toLocaleString("vi-VN")}đ`
                          : null}
                      </p>
                    )}
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => resolve(a.id, "approved")}
                        loading={resolving === a.id + "approved"}
                      >
                        <CheckCircle size={13} /> Duyệt
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => resolve(a.id, "rejected")}
                        loading={resolving === a.id + "rejected"}
                      >
                        <XCircle size={13} /> Từ chối
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Spa Sync + Lead Convs */}
        <div className="space-y-4">
          {/* Spa Sync Status */}
          <Card>
            <CardHeader>
              <CardTitle>Đồng bộ Spa</CardTitle>
              <Button
                size="sm"
                variant="secondary"
                onClick={async () => {
                  await fetch("/api/spa?action=pull-revenue");
                  load();
                }}
              >
                <ArrowsClockwise size={13} /> Đồng bộ ngay
              </Button>
            </CardHeader>
            <div className="px-5 pb-4 space-y-2 text-sm">
              {spaSync?.lastError && (
                <div className="rounded-lg px-3 py-2 text-xs" style={{ background: "color-mix(in srgb, var(--rose) 10%, transparent)", color: "var(--rose)" }}>
                  Lỗi gần nhất: {spaSync.lastError}
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>Lần đồng bộ cuối</p>
                  <p style={{ color: "var(--text)" }}>{spaSync?.lastSyncAt ? timeAgo(spaSync.lastSyncAt) : "Chưa có"}</p>
                </div>
                <div>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>Lịch hẹn hôm nay</p>
                  <p style={{ color: "var(--text)" }}>{spaSync?.bookingCountToday ?? 0}</p>
                </div>
                <div>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>Đăng bài cuối</p>
                  <p style={{ color: "var(--text)" }}>{spaSync?.lastPublishRun ? timeAgo(spaSync.lastPublishRun) : "Chưa có"}</p>
                </div>
                <div>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>Tối ưu ads cuối</p>
                  <p style={{ color: "var(--text)" }}>{spaSync?.lastAdsOptRun ? timeAgo(spaSync.lastAdsOptRun) : "Chưa có"}</p>
                </div>
              </div>
            </div>
          </Card>

          {/* Active Lead Conversations */}
          <Card>
            <CardHeader>
              <CardTitle>Lead đang chat <Robot size={14} /></CardTitle>
            </CardHeader>
            {leadConversations.length === 0 ? (
              <p className="px-5 pb-4 text-sm" style={{ color: "var(--text-muted)" }}>Không có cuộc hội thoại nào đang mở.</p>
            ) : (
              <div className="divide-y" style={{ borderColor: "var(--border)" }}>
                {leadConversations.map((conv) => (
                  <div key={conv.id} className="px-5 py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: "var(--text)" }}>
                        {conv.collectedName ?? conv.lead.name}
                      </p>
                      <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
                        {conv.collectedService ?? "Chưa rõ dịch vụ"} · {timeAgo(conv.updatedAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="info">{STEP_LABELS[conv.step] ?? `Bước ${conv.step}`}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Ad Optimization Log */}
      <Card>
        <CardHeader>
          <CardTitle>Nhật ký tối ưu quảng cáo</CardTitle>
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>{adLogs.length} hành động gần nhất</span>
        </CardHeader>
        {adLogs.length === 0 ? (
          <p className="px-5 pb-5 text-sm" style={{ color: "var(--text-muted)" }}>Chưa có lịch sử tối ưu.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  <th className="text-left py-2 px-4" style={{ color: "var(--text-muted)" }}>Chiến dịch</th>
                  <th className="text-left py-2 px-3" style={{ color: "var(--text-muted)" }}>Hành động</th>
                  <th className="text-left py-2 px-3 hidden sm:table-cell" style={{ color: "var(--text-muted)" }}>Lý do</th>
                  <th className="text-left py-2 px-3 hidden md:table-cell" style={{ color: "var(--text-muted)" }}>Giá trị</th>
                  <th className="text-right py-2 px-4" style={{ color: "var(--text-muted)" }}>Thời gian</th>
                </tr>
              </thead>
              <tbody>
                {adLogs.map((log) => (
                  <tr key={log.id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td className="py-2.5 px-4 font-medium max-w-[160px] truncate" style={{ color: "var(--text)" }}>
                      {log.campaignName}
                    </td>
                    <td className="py-2.5 px-3">
                      <Badge variant={ACTION_BADGE[log.action] ?? "neutral"}>
                        {ACTION_LABELS[log.action] ?? log.action}
                      </Badge>
                    </td>
                    <td className="py-2.5 px-3 hidden sm:table-cell max-w-[200px] truncate" style={{ color: "var(--text-secondary)" }}>
                      {log.reason}
                    </td>
                    <td className="py-2.5 px-3 hidden md:table-cell" style={{ color: "var(--text-secondary)" }}>
                      {log.oldValue && log.newValue ? `${log.oldValue} → ${log.newValue}` : log.newValue ?? "—"}
                    </td>
                    <td className="py-2.5 px-4 text-right whitespace-nowrap" style={{ color: "var(--text-muted)" }}>
                      <Clock size={11} className="inline mr-1" />
                      {timeAgo(log.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Lead Nurture Pipeline */}
      <Card>
        <CardHeader>
          <CardTitle>Lead Nurture Pipeline</CardTitle>
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            {nurtureDueCount > 0 ? `${nurtureDueCount} cần gửi hôm nay` : "Không có gì hôm nay"}
          </span>
        </CardHeader>
        {nurtureLeads.length === 0 ? (
          <p className="px-5 pb-5 text-sm" style={{ color: "var(--text-muted)" }}>Không có lead nào trong nurture pipeline.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  <th className="text-left py-2 px-4" style={{ color: "var(--text-muted)" }}>Khách hàng</th>
                  <th className="text-left py-2 px-3" style={{ color: "var(--text-muted)" }}>Dịch vụ</th>
                  <th className="text-left py-2 px-3" style={{ color: "var(--text-muted)" }}>Kênh</th>
                  <th className="text-left py-2 px-3" style={{ color: "var(--text-muted)" }}>Bước</th>
                  <th className="text-right py-2 px-4" style={{ color: "var(--text-muted)" }}>Lần cuối</th>
                </tr>
              </thead>
              <tbody>
                {nurtureLeads.map((lead) => {
                  const delay = [1, 3, 7][lead.nurtureStep] ?? 7;
                  const threshold = new Date(Date.now() - delay * 24 * 60 * 60 * 1000);
                  const lastContact = lead.nurtureSentAt ?? lead.createdAt;
                  const isDue = new Date(lastContact) <= threshold;
                  return (
                    <tr key={lead.id} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td className="py-2.5 px-4 font-medium" style={{ color: "var(--text)" }}>
                        {lead.name}
                      </td>
                      <td className="py-2.5 px-3" style={{ color: "var(--text-secondary)" }}>
                        {lead.service ?? "—"}
                      </td>
                      <td className="py-2.5 px-3">
                        <Badge variant={lead.channelType === "zalo" ? "info" : "neutral"}>
                          {lead.channelType === "zalo" ? "Zalo" : "Facebook"}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-3">
                        <Badge variant={isDue ? "warning" : "neutral"}>
                          {isDue ? `Bước ${lead.nurtureStep + 1} — cần gửi` : `Bước ${lead.nurtureStep + 1}`}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-4 text-right whitespace-nowrap" style={{ color: "var(--text-muted)" }}>
                        <Clock size={11} className="inline mr-1" />
                        {timeAgo(lead.nurtureSentAt ?? lead.createdAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
