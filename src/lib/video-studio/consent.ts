import "server-only";

import { prisma } from "@/lib/db";
import { parseJson } from "./types";

export async function assertStaffConsent(input: { staffId: string; facebookPageId?: string | null; scopes: string[] }) {
  const [staff, consents] = await Promise.all([
    prisma.staffVisualProfile.findFirst({
      where: { id: input.staffId, facebookPageId: input.facebookPageId || null },
      select: { consentStatus: true, isActive: true },
    }),
    prisma.videoConsent.findMany({ where: { subjectType: "staff", subjectId: input.staffId, facebookPageId: input.facebookPageId || null, status: "active" } }),
  ]);
  const now = new Date();
  const valid = consents.some((consent) => {
    const scopes = parseJson<string[]>(consent.scopes, []);
    return Boolean(consent.evidenceHash) && input.scopes.every((scope) => scopes.includes(scope)) && (!consent.expiresAt || consent.expiresAt > now);
  });
  if (!staff?.isActive || staff.consentStatus !== "consented" || !valid) {
    throw new Error(`Nhân viên chưa có consent hợp lệ cho: ${input.scopes.join(", ")}`);
  }
}

export async function assertProjectPublishConsent(projectId: string) {
  const project = await prisma.videoProject.findUnique({
    where: { id: projectId },
    include: { scenes: { select: { staffProfileId: true, kind: true, lipSyncVideoUrl: true, voiceProfileId: true } } },
  });
  if (!project) throw new Error("Không tìm thấy dự án");
  const staffIds = [...new Set(project.scenes.map((scene) => scene.staffProfileId).filter((id): id is string => Boolean(id)))];
  for (const staffId of staffIds) {
    const usesLipSync = project.scenes.some((scene) => scene.staffProfileId === staffId && scene.kind === "talking" && scene.lipSyncVideoUrl);
    await assertStaffConsent({ staffId, facebookPageId: project.facebookPageId, scopes: usesLipSync ? ["advertising", "lip_sync"] : ["advertising", "face_generation"] });
  }
  const voiceIds = [...new Set(project.scenes.map((scene) => scene.voiceProfileId).filter((id): id is string => Boolean(id)))];
  if (voiceIds.length) {
    const activeVoices = await prisma.videoVoiceProfile.count({ where: { id: { in: voiceIds }, status: "active", isActive: true } });
    if (activeVoices !== voiceIds.length) throw new Error("Một hoặc nhiều voice profile đã bị thu hồi");
  }
}
