import { prisma } from "./db";
import { postToZalo } from "./zalo";

function randomCode(): string {
  return Math.random().toString(36).toUpperCase().slice(2, 6);
}

const TIMEOUTS: Record<string, number> = {
  content_plan: 12 * 60,
  budget_increase: 2 * 60,
  pause_campaign: 60,
  flash_deal: 30,
};

export async function requestApproval(
  type: string,
  payload: Record<string, unknown>,
  recipientId?: string | null
): Promise<string> {
  const timeoutMin = TIMEOUTS[type] ?? 60;
  const shortCode = randomCode();
  const timeoutAt = new Date(Date.now() + timeoutMin * 60 * 1000);

  const approval = await prisma.pendingApproval.create({
    data: {
      type,
      payload: JSON.stringify(payload),
      shortCode,
      timeoutAt,
    },
  });

  const message = formatApprovalMessage(type, payload, shortCode, timeoutMin);

  if (recipientId) {
    try {
      const msgId = await postToZalo(message, undefined, recipientId);
      await prisma.pendingApproval.update({ where: { id: approval.id }, data: { zaloMessageId: msgId } });
    } catch {
      // Zalo send failed — approval still exists, can be resolved via /api/approvals
    }
  }

  return approval.id;
}

export async function checkApproval(id: string): Promise<"approved" | "rejected" | "pending" | "timed_out"> {
  const approval = await prisma.pendingApproval.findUnique({ where: { id } });
  if (!approval) return "timed_out";
  if (approval.status !== "pending") return approval.status as "approved" | "rejected";
  if (new Date() > approval.timeoutAt) {
    await prisma.pendingApproval.update({ where: { id }, data: { status: "timed_out" } });
    return "timed_out";
  }
  return "pending";
}

export async function resolveApprovalByCode(
  shortCode: string,
  decision: "approved" | "rejected"
): Promise<{ id: string; type: string; payload: Record<string, unknown> } | null> {
  const approval = await prisma.pendingApproval.findUnique({ where: { shortCode } });
  if (!approval || approval.status !== "pending") return null;
  if (new Date() > approval.timeoutAt) {
    await prisma.pendingApproval.update({ where: { id: approval.id }, data: { status: "timed_out" } });
    return null;
  }
  await prisma.pendingApproval.update({
    where: { id: approval.id },
    data: { status: decision, decidedAt: new Date() },
  });
  return { id: approval.id, type: approval.type, payload: JSON.parse(approval.payload) };
}

export async function resolveApproval(id: string, decision: "approved" | "rejected"): Promise<void> {
  await prisma.pendingApproval.update({
    where: { id },
    data: { status: decision, decidedAt: new Date() },
  });
}

function formatApprovalMessage(type: string, payload: Record<string, unknown>, code: string, timeoutMin: number): string {
  const hours = timeoutMin >= 60 ? `${timeoutMin / 60}h` : `${timeoutMin} phút`;
  let detail = "";
  if (type === "budget_increase") {
    detail = `\nTăng ngân sách chiến dịch "${payload.campaignName ?? ""}" từ ${Number(payload.oldBudget ?? 0).toLocaleString("vi-VN")}đ → ${Number(payload.newBudget ?? 0).toLocaleString("vi-VN")}đ/ngày`;
  } else if (type === "pause_campaign") {
    detail = `\nTạm dừng chiến dịch "${payload.campaignName ?? ""}" (CTR: ${payload.ctr ?? "?"}, Chi: ${Number(payload.spend ?? 0).toLocaleString("vi-VN")}đ)`;
  } else if (type === "content_plan") {
    detail = `\nDuyệt kế hoạch nội dung ngày mai`;
  } else if (type === "flash_deal") {
    detail = `\nChạy flash deal: ${payload.description ?? ""}`;
  }
  return `🤖 AutoSpa cần duyệt:${detail}\n\nGõ Y${code} để đồng ý, N${code} để từ chối.\nHết hạn sau ${hours}.`;
}
