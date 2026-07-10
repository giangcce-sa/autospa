import { prisma } from "./db";
import { postToZalo } from "./zalo";
import { randomBytes } from "node:crypto";
import { sendApprovalMessage } from "./telegram";

function randomCode(): string {
  return randomBytes(5).toString("hex").toUpperCase();
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
  const campaignId = payload.campaignId ? String(payload.campaignId) : null;
  if (campaignId) {
    const existing = await prisma.pendingApproval.findFirst({
      where: {
        type,
        status: "pending",
        timeoutAt: { gt: new Date() },
        payload: { contains: `"campaignId":"${campaignId}"` },
      },
      orderBy: { createdAt: "desc" },
    });
    if (existing) return existing.id;
  }
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

  const telegramDetail = type === "budget_increase"
    ? `Tăng ngân sách "${String(payload.campaignName ?? "")}" từ ${Number(payload.oldBudget ?? 0).toLocaleString("vi-VN")}đ lên ${Number(payload.newBudget ?? 0).toLocaleString("vi-VN")}đ/ngày.`
    : type === "pause_campaign"
      ? `Tạm dừng "${String(payload.campaignName ?? "")}". CTR ${String(payload.ctr ?? "?")}, chi ${Number(payload.spend ?? 0).toLocaleString("vi-VN")}đ.`
      : type === "flash_deal"
        ? `Chạy flash deal: ${String(payload.description ?? "")}`
        : "Phê duyệt yêu cầu vận hành AutoSpa.";
  await sendApprovalMessage({
    approvalId: approval.id,
    title: "AutoSpa cần phê duyệt",
    detail: `${telegramDetail}\n\nHết hạn sau ${timeoutMin >= 60 ? `${timeoutMin / 60} giờ` : `${timeoutMin} phút`}.`,
  }).catch(() => null);

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

export async function findApprovalByCode(shortCode: string): Promise<{ id: string } | null> {
  const approval = await prisma.pendingApproval.findUnique({ where: { shortCode } });
  if (!approval || approval.status !== "pending") return null;
  if (new Date() > approval.timeoutAt) {
    await prisma.pendingApproval.update({ where: { id: approval.id }, data: { status: "timed_out" } });
    return null;
  }
  return { id: approval.id };
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
