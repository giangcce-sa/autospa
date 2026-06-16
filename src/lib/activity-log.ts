import { prisma } from "@/lib/db";

export type ActivitySeverity = "info" | "success" | "warning" | "danger";
export type JobStatus = "running" | "completed" | "failed" | "skipped";
export type JobTrigger = "cron" | "manual" | "webhook" | "system";

function serialize(value: unknown) {
  if (value === undefined) return undefined;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export async function logActivity(input: {
  type: string;
  title: string;
  detail?: string;
  href?: string;
  severity?: ActivitySeverity;
  source?: string;
  metadata?: unknown;
}) {
  return prisma.activityLog.create({
    data: {
      type: input.type,
      title: input.title,
      detail: input.detail,
      href: input.href,
      severity: input.severity ?? "info",
      source: input.source ?? "system",
      metadata: serialize(input.metadata),
    },
  });
}

export async function startJobRun(name: string, trigger: JobTrigger = "system", summary?: string) {
  return prisma.jobRun.create({
    data: {
      name,
      trigger,
      summary,
      status: "running",
    },
  });
}

export async function finishJobRun(
  id: string,
  input: {
    status: Exclude<JobStatus, "running">;
    summary?: string;
    metrics?: unknown;
    error?: string;
  },
) {
  return prisma.jobRun.update({
    where: { id },
    data: {
      status: input.status,
      summary: input.summary,
      metrics: serialize(input.metrics),
      error: input.error,
      completedAt: new Date(),
    },
  });
}

export async function runLoggedJob<T>(
  name: string,
  trigger: JobTrigger,
  fn: () => Promise<T>,
  summarize?: (result: T) => string,
) {
  const job = await startJobRun(name, trigger);
  try {
    const result = await fn();
    await finishJobRun(job.id, {
      status: "completed",
      summary: summarize?.(result),
      metrics: result,
    });
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await finishJobRun(job.id, {
      status: "failed",
      summary: `${name} failed`,
      error: message,
    }).catch(() => null);
    throw error;
  }
}
