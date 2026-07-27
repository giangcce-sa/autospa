/**
 * Write side of the Post brief, mirroring the tolerant read side in
 * `creative-brief.ts`. Reading a stored column must never throw, but accepting
 * untrusted client input must fail loudly: validate first, reject with a
 * user-facing Vietnamese message, then hand back Prisma-ready values.
 *
 * The four list columns (outline, hooks, topicTags, targetChannels) are stored
 * as JSON strings — never as Postgres arrays — so JSON.stringify happens exactly
 * once, here, and no route has to remember it.
 *
 * Pure module (no prisma, no server-only) so routes and tests can import it.
 */

import { BRIEF_LIMITS } from "./creative-brief.ts";
import type { PublishChannel } from "./publishing/service.ts";

export const PUBLISH_CHANNEL_VALUES = [
  "facebook",
  "instagram",
  "tiktok",
  "zalo",
] as const satisfies readonly PublishChannel[];

export const BRIEF_FIELDS = ["title", "summary", "outline", "hooks", "topicTags", "targetChannels"] as const;

export type BriefField = (typeof BRIEF_FIELDS)[number];

/** Prisma-ready brief values: text columns are nullable, list columns are JSON strings. */
export interface BriefWriteData {
  title?: string | null;
  summary?: string | null;
  outline?: string;
  hooks?: string;
  topicTags?: string;
  targetChannels?: string;
}

/**
 * RangeError is this repo's typed 400: `routeErrorResponse` keeps the message
 * and answers 400, so validation failures never fall through to the generic 500.
 */
function reject(message: string): never {
  throw new RangeError(message);
}

/** Trim; blank becomes null so a cleared field clears the column. */
function validateText(value: unknown, maxChars: number, label: string): string | null {
  if (value === null) return null;
  if (typeof value !== "string") reject(`${label} phải là chuỗi ký tự`);
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > maxChars) reject(`${label} tối đa ${maxChars} ký tự`);
  return trimmed;
}

/** Trim every member, drop empties, then enforce the item and length caps. */
function validateList(value: unknown, maxItems: number, maxChars: number, label: string): string[] {
  if (!Array.isArray(value)) reject(`${label} phải là một mảng`);
  const items: string[] = [];
  for (const member of value) {
    if (typeof member !== "string") reject(`${label} chỉ nhận chuỗi ký tự`);
    const trimmed = member.trim();
    if (!trimmed) continue;
    if (trimmed.length > maxChars) reject(`Mỗi mục của ${label} tối đa ${maxChars} ký tự`);
    items.push(trimmed);
  }
  if (items.length > maxItems) reject(`${label} tối đa ${maxItems} mục`);
  return items;
}

/** Only the four supported publish channels, deduplicated, order preserved. */
function validateChannels(value: unknown): PublishChannel[] {
  if (!Array.isArray(value)) reject("Kênh xuất bản phải là một mảng");
  const channels: PublishChannel[] = [];
  for (const member of value) {
    if (typeof member !== "string") reject("Kênh xuất bản chỉ nhận chuỗi ký tự");
    const trimmed = member.trim().toLowerCase();
    if (!trimmed) continue;
    const channel = PUBLISH_CHANNEL_VALUES.find((allowed) => allowed === trimmed);
    if (!channel) reject(`Kênh xuất bản chỉ nhận: ${PUBLISH_CHANNEL_VALUES.join(", ")}`);
    if (!channels.includes(channel)) channels.push(channel);
  }
  return channels;
}

/**
 * Validates the brief fields a client actually sent and returns them ready to
 * spread into a Prisma create/update. A field the client omitted is absent from
 * the result, so partial updates never clobber stored values with defaults.
 * Throws RangeError (→ 400) on any invalid shape, size or channel.
 */
export function briefWriteData(input: unknown, fields: readonly BriefField[] = BRIEF_FIELDS): BriefWriteData {
  const body = (input && typeof input === "object" ? input : {}) as Partial<Record<BriefField, unknown>>;
  const data: BriefWriteData = {};
  const sent = (field: BriefField) => fields.includes(field) && body[field] !== undefined;

  if (sent("title")) data.title = validateText(body.title, BRIEF_LIMITS.title, "Tiêu đề");
  if (sent("summary")) data.summary = validateText(body.summary, BRIEF_LIMITS.summary, "Tóm tắt");
  if (sent("outline")) {
    data.outline = JSON.stringify(validateList(body.outline, BRIEF_LIMITS.outlineItems, BRIEF_LIMITS.itemLength, "Dàn ý"));
  }
  if (sent("hooks")) {
    data.hooks = JSON.stringify(validateList(body.hooks, BRIEF_LIMITS.hookItems, BRIEF_LIMITS.itemLength, "Hook mở bài"));
  }
  if (sent("topicTags")) {
    data.topicTags = JSON.stringify(validateList(body.topicTags, BRIEF_LIMITS.topicTagItems, BRIEF_LIMITS.tagLength, "Thẻ chủ đề"));
  }
  if (sent("targetChannels")) {
    data.targetChannels = JSON.stringify(validateChannels(body.targetChannels));
  }
  return data;
}

/**
 * Same caps, clamping instead of rejecting — for model output, where a slightly
 * over-long line is not a client error worth failing the whole generation over.
 */
export function clampBriefText(value: unknown, maxChars: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.length > maxChars ? trimmed.slice(0, maxChars).trim() : trimmed;
}

/** Clamping counterpart of validateList: trim, drop empties, truncate, cap length. */
export function clampBriefList(values: unknown, maxItems: number, maxChars: number): string[] {
  if (!Array.isArray(values)) return [];
  const items: string[] = [];
  for (const value of values) {
    const item = clampBriefText(value, maxChars);
    if (item) items.push(item);
    if (items.length === maxItems) break;
  }
  return items;
}
