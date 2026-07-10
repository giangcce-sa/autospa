import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";

export async function acquireAutomationLock(id: string, ttlMinutes = 15) {
  const owner = randomUUID();
  const lockedUntil = new Date(Date.now() + ttlMinutes * 60_000);
  try {
    await prisma.automationLock.create({ data: { id, owner, lockedUntil } });
    return owner;
  } catch {
    const updated = await prisma.automationLock.updateMany({
      where: { id, lockedUntil: { lt: new Date() } },
      data: { owner, lockedUntil },
    });
    return updated.count === 1 ? owner : null;
  }
}

export async function releaseAutomationLock(id: string, owner: string) {
  await prisma.automationLock.deleteMany({ where: { id, owner } });
}
