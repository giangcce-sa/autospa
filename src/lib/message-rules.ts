import { prisma } from "./db";

export interface MatchedRule {
  id: string;
  reply: string;
}

/**
 * Match incoming message text against active MessageRules.
 * Rules ordered by priority desc, first match wins.
 * Channel filter: "facebook" or "zalo" — also matches rules with channel="both".
 */
export async function matchMessageRule(
  text: string,
  channel: "facebook" | "zalo"
): Promise<MatchedRule | null> {
  if (!text?.trim()) return null;

  const rules = await prisma.messageRule.findMany({
    where: {
      isActive: true,
      OR: [{ channel: "both" }, { channel }],
    },
    orderBy: { priority: "desc" },
  });

  const lower = text.toLowerCase();

  for (const rule of rules) {
    const trigger = rule.trigger;
    if (!trigger) continue;

    if (rule.matchMode === "exact") {
      if (lower === trigger.toLowerCase()) return { id: rule.id, reply: rule.reply };
    } else if (rule.matchMode === "regex") {
      try {
        const re = new RegExp(trigger, "i");
        if (re.test(text)) return { id: rule.id, reply: rule.reply };
      } catch {
        // invalid regex — skip
      }
    } else {
      // contains (default)
      if (lower.includes(trigger.toLowerCase())) return { id: rule.id, reply: rule.reply };
    }
  }

  return null;
}
