import type { QualityIssue, QualityReport } from "./types";

interface SceneForQuality {
  id: string;
  kind: string;
  script: string;
  durationSec: number;
  generatedVideoUrl?: string | null;
  sourceVideoUrl?: string | null;
  lipSyncVideoUrl?: string | null;
  audioUrl?: string | null;
  subtitleData: string;
  qaScore?: number | null;
  inputRevision: number;
  videoRevision?: number | null;
  audioRevision?: number | null;
  lipSyncRevision?: number | null;
}

export interface RenderInspection {
  durationSec: number;
  width: number;
  height: number;
  hasAudio: boolean;
}

export function evaluateProjectQuality(input: {
  durationSec: number;
  aspectRatio: string;
  approvalStatus: string;
  outputUrl?: string | null;
  inputRevision: number;
  renderedRevision?: number | null;
  renderInspection?: RenderInspection | null;
  scenes: SceneForQuality[];
}) : QualityReport {
  const issues: QualityIssue[] = [];
  if (!input.scenes.length) issues.push({ code: "NO_SCENES", severity: "blocking", message: "Dự án chưa có cảnh", suggestion: "Tạo hoặc nhập storyboard trước khi render." });
  const actualDuration = input.scenes.reduce((sum, scene) => sum + scene.durationSec, 0);
  if (Math.abs(actualDuration - input.durationSec) > 4) issues.push({ code: "DURATION_MISMATCH", severity: "warning", message: `Storyboard dài ${actualDuration}s, khác mục tiêu ${input.durationSec}s`, suggestion: "Điều chỉnh thời lượng từng cảnh." });
  for (const scene of input.scenes) {
    if (scene.kind === "talking" && !scene.script.trim()) issues.push({ code: "MISSING_SCRIPT", severity: "blocking", sceneId: scene.id, message: "Cảnh nói chưa có lời thoại", suggestion: "Thêm lời thoại rồi tạo voice." });
    if (scene.kind === "talking" && (!scene.audioUrl || scene.audioRevision !== scene.inputRevision)) issues.push({ code: "MISSING_VOICE", severity: "blocking", sceneId: scene.id, message: "Voice thiếu hoặc không khớp phiên bản lời thoại", suggestion: "Tạo lại voice bằng ElevenLabs." });
    if (scene.kind === "talking" && (!scene.lipSyncVideoUrl || scene.lipSyncRevision !== scene.inputRevision)) issues.push({ code: "MISSING_LIPSYNC", severity: "blocking", sceneId: scene.id, message: "Lip-sync thiếu hoặc không khớp phiên bản cảnh", suggestion: "Chạy lại Sync Labs cho cảnh này." });
    if (scene.kind !== "talking" && !scene.sourceVideoUrl && (!scene.generatedVideoUrl || scene.videoRevision !== scene.inputRevision)) issues.push({ code: "MISSING_VIDEO", severity: "blocking", sceneId: scene.id, message: "Video thiếu hoặc không khớp phiên bản scene", suggestion: "Tạo lại cảnh bằng Runway hoặc tải clip thật lên." });
    if (scene.qaScore != null && scene.qaScore < 70) issues.push({ code: "LOW_SCENE_SCORE", severity: "warning", sceneId: scene.id, message: `Chất lượng cảnh chỉ đạt ${scene.qaScore}/100`, suggestion: "Xem báo cáo cảnh và tạo lại phần bị lỗi." });
  }
  if (!input.outputUrl) issues.push({ code: "NOT_RENDERED", severity: "info", message: "Chưa có bản render cuối", suggestion: "Render sau khi hoàn tất các cảnh." });
  if (input.outputUrl && input.renderedRevision !== input.inputRevision) issues.push({ code: "STALE_RENDER", severity: "blocking", message: "Bản render không khớp dữ liệu hiện tại", suggestion: "Render lại dự án trước khi duyệt." });
  if (input.outputUrl && !input.outputUrl.startsWith("mock://") && !input.renderInspection) {
    issues.push({ code: "OUTPUT_NOT_INSPECTED", severity: "blocking", message: "File render chưa được kiểm tra kỹ thuật", suggestion: "Chạy lại QA cho bản render hiện tại." });
  }
  if (input.renderInspection) {
    const inspection = input.renderInspection;
    const expectedRatio = input.aspectRatio === "9:16" ? 9 / 16 : input.aspectRatio === "1:1" ? 1 : 16 / 9;
    const actualRatio = inspection.width > 0 && inspection.height > 0 ? inspection.width / inspection.height : 0;
    if (!inspection.width || !inspection.height || Math.abs(actualRatio - expectedRatio) > 0.03) {
      issues.push({ code: "OUTPUT_RATIO_INVALID", severity: "blocking", message: `Tỉ lệ file render ${inspection.width}x${inspection.height} không đúng ${input.aspectRatio}`, suggestion: "Kiểm tra preset render và xuất lại video." });
    }
    if (Math.abs(inspection.durationSec - actualDuration) > 2) {
      issues.push({ code: "OUTPUT_DURATION_INVALID", severity: "blocking", message: `File render dài ${inspection.durationSec.toFixed(1)}s, storyboard dài ${actualDuration}s`, suggestion: "Kiểm tra timeline và render lại." });
    }
    if (!inspection.hasAudio) issues.push({ code: "OUTPUT_AUDIO_MISSING", severity: "blocking", message: "File render không có audio stream", suggestion: "Kiểm tra voice/nhạc nền và render lại." });
  }
  const penalty = issues.reduce((sum, issue) => sum + (issue.severity === "blocking" ? 18 : issue.severity === "warning" ? 7 : 2), 0);
  const score = Math.max(0, 100 - penalty);
  return { score, passed: !issues.some((issue) => issue.severity === "blocking") && score >= 75, issues, ...(input.renderInspection ? { inspection: input.renderInspection } : {}) };
}
