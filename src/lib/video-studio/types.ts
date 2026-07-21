export type VideoProvider = "runway" | "elevenlabs" | "sync" | "ffmpeg" | "brain";
export type VideoJobStatus = "queued" | "processing" | "completed" | "failed" | "cancelled";

export interface ProviderTask {
  externalId?: string;
  status: VideoJobStatus;
  progress?: number;
  outputUrl?: string;
  raw?: unknown;
  costUsd?: number;
  error?: string;
}

export interface StoryboardSceneInput {
  title: string;
  kind: "talking" | "broll" | "title" | "cta";
  purpose: string;
  durationSec: number;
  script: string;
  visualPrompt: string;
  cameraDirection: string;
}

export interface StoryboardResult {
  title: string;
  strategy: string;
  hook: string;
  caption: string;
  hashtags: string[];
  scenes: StoryboardSceneInput[];
}

export interface QualityIssue {
  code: string;
  severity: "info" | "warning" | "blocking";
  sceneId?: string;
  message: string;
  suggestion: string;
}

export interface QualityReport {
  score: number;
  passed: boolean;
  issues: QualityIssue[];
  inspection?: {
    durationSec: number;
    width: number;
    height: number;
    hasAudio: boolean;
  };
}

export function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
