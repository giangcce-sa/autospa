import type { Prisma } from "@prisma/client";
import { parseJson } from "./types";

export type VideoProjectWithRelations = Prisma.VideoProjectGetPayload<{
  include: { scenes: true; assets: true; jobs: true; versions: true; performances: true };
}>;

export function serializeProject(project: VideoProjectWithRelations) {
  return {
    ...project,
    storyboard: parseJson(project.storyboard, {}),
    styleSkillIds: parseJson<string[]>(project.styleSkillIds, []),
    qualityReport: parseJson(project.qualityReport, null),
    scenes: project.scenes.map((scene) => ({
      ...scene,
      subtitleData: parseJson(scene.subtitleData, []),
      qaReport: parseJson(scene.qaReport, null),
    })),
    assets: project.assets.map((asset) => ({ ...asset, metadata: parseJson(asset.metadata, {}) })),
    jobs: project.jobs.map((job) => ({
      ...job,
      input: parseJson(job.input, {}),
      output: parseJson(job.output, null),
    })),
    versions: project.versions.map((version) => ({ ...version, snapshot: parseJson(version.snapshot, {}) })),
  };
}
