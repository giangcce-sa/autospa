import "server-only";

import { prisma } from "@/lib/db";
import { toAutomationSettingsDto } from "./automation-policy";

const automationSettingsSelect = {
  webhookVerifyToken: true,
  webhookMode: true,
  autoReplyComments: true,
  autoReplyMessages: true,
  leadHandoffMode: true,
  leadHandoffLink: true,
  automationLevel: true,
  zaloApprovalRecipient: true,
} as const;

export async function getAutomationSettings() {
  const settings = await prisma.settings.findUnique({
    where: { id: "1" },
    select: automationSettingsSelect,
  });
  return toAutomationSettingsDto(settings);
}
