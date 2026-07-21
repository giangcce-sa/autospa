import "server-only";

import { prisma } from "@/lib/db";
import { AccessError, requirePageAccess, requireUser } from "@/lib/page-access";

export async function requireMediaAccess(storageKey: string) {
  const user = await requireUser();
  if (user.role === "owner") return;

  const [image, staffProfile, staffSample, project, asset, version, voice, consent] = await Promise.all([
    prisma.imageGeneration.findFirst({ where: { storageKey }, select: { facebookPageId: true } }),
    prisma.staffVisualProfile.findFirst({
      where: { referenceStorageKey: storageKey },
      select: { facebookPageId: true },
    }),
    prisma.staffVisualSample.findFirst({
      where: { storageKey },
      select: { staff: { select: { facebookPageId: true } } },
    }),
    prisma.videoProject.findFirst({
      where: { outputStorageKey: storageKey },
      select: { facebookPageId: true },
    }),
    prisma.videoAsset.findFirst({
      where: { storageKey },
      select: { project: { select: { facebookPageId: true } } },
    }),
    prisma.videoVersion.findFirst({
      where: { storageKey },
      select: { project: { select: { facebookPageId: true } } },
    }),
    prisma.videoVoiceProfile.findFirst({
      where: { sampleStorageKey: storageKey },
      select: { facebookPageId: true },
    }),
    prisma.videoConsent.findFirst({ where: { storageKey }, select: { facebookPageId: true } }),
  ]);

  const facebookPageId = image?.facebookPageId
    ?? staffProfile?.facebookPageId
    ?? staffSample?.staff.facebookPageId
    ?? project?.facebookPageId
    ?? asset?.project.facebookPageId
    ?? version?.project.facebookPageId
    ?? voice?.facebookPageId
    ?? consent?.facebookPageId;

  if (!facebookPageId) throw new AccessError("Không tìm thấy tài nguyên media được cấp quyền", 404);
  await requirePageAccess(facebookPageId);
}
