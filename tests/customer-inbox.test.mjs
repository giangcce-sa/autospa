import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("canonical Customer Inbox renders its production dispatcher", async () => {
  const page = await source("src/app/customers/inbox/page.tsx");
  const workspace = await source("src/components/modules/inbox/CustomerInboxWorkspace.tsx");

  assert.match(page, /<CustomerInboxWorkspace searchParams=\{searchParams\}/);
  assert.equal(page.includes("<WorkspacePage"), false);
  assert.match(workspace, /parseWorkspaceUrl\(params, \{/);
  assert.match(workspace, /await resolveWorkspaceAccess\(route, state, effectiveScope\)/);
  assert.match(workspace, /<WorkspaceShell route=\{route\} state=\{access\.state\} pages=\{access\.pages\} effectiveScope=\{effectiveScope\} visibleViewIds=\{access\.visibleViewIds\} dashboard wide>/);
});

test("canonical Inbox server-loads Page messages, selected record, and account rules", async () => {
  const workspace = await source("src/components/modules/inbox/CustomerInboxWorkspace.tsx");
  const reader = await source("src/lib/customer-inbox.ts");

  assert.match(workspace, /messages = await getInboxMessages\(pageId\)/);
  assert.match(workspace, /selectedMessage = await getInboxMessage\(pageId, access\.state\.id\)/);
  assert.match(workspace, /const rules = access\.state\.view === "rules" \? await getMessageRules\(\) : undefined/);
  assert.match(reader, /where: \{ facebookPageId \}/);
  assert.match(reader, /findUnique\(\{\s*where: \{ id \}/);
  assert.match(reader, /message\.facebookPageId !== facebookPageId/);
  assert.match(reader, /throw new AccessError\("Tin nhắn thuộc Facebook Page khác", 403\)/);
});

test("canonical Inbox is truthful about flat messages and unowned appointments", async () => {
  const route = await source("src/config/routes.ts");
  const workspace = await source("src/components/modules/inbox/CustomerInboxWorkspace.tsx");
  const view = await source("src/components/modules/inbox/CustomerInboxView.tsx");

  assert.match(route, /id: "conversation", label: "Chi tiết tin nhắn"/);
  assert.match(route, /id: "rules"[\s\S]*?scope: "account"/);
  assert.match(workspace, /Lịch hẹn chưa có ownership theo Facebook Page/);
  assert.match(view, /Dữ liệu hiện chưa có thread hội thoại đầy đủ/);
  assert.match(view, /Có reply được lưu/);
  assert.equal(view.includes("đang chờ phản hồi"), false);
});

test("Inbox list, detail, and mobile back navigation preserve canonical state", async () => {
  const view = await source("src/components/modules/inbox/CustomerInboxView.tsx");

  assert.match(view, /new URLSearchParams\(\{ view: nextView, scope: "current", pageId: facebookPageId \}\)/);
  assert.match(view, /if \(messageId\) params\.set\("id", messageId\)/);
  assert.match(view, /if \(status\) params\.set\("status", status\)/);
  assert.match(view, /if \(query\.trim\(\)\) params\.set\("q", query\.trim\(\)\)/);
  assert.match(view, /backHref=\{hrefFor\("queue"\)\}/);
  assert.match(view, /md:grid-cols-\[minmax\(16rem,0\.82fr\)_minmax\(0,1\.18fr\)\]/);
  assert.match(view, /xl:grid-cols-\[minmax\(17rem,0\.78fr\)_minmax\(22rem,1\.22fr\)_minmax\(15rem,0\.62fr\)\]/);
  assert.match(view, /hidden md:block/);
  assert.match(view, /Persisted facts/);
  assert.match(view, /Không suy diễn Customer, Lead, assignee hoặc channel delivery/);
  assert.equal(view.includes("online"), false);
  assert.equal(view.includes("được phân công"), false);
});

test("Inbox viewer UI is read-only and canonical actions always send the authorized Page", async () => {
  const view = await source("src/components/modules/inbox/CustomerInboxView.tsx");
  const rules = await source("src/components/modules/inbox/MessageRules.tsx");

  assert.match(view, /body: JSON\.stringify\(\{ action, facebookPageId, \.\.\.body \}\)/);
  assert.match(view, /canMutate \? <Button/);
  assert.match(view, /Bạn có quyền xem nhưng không có quyền soạn, đồng bộ hoặc gửi reply/);
  assert.match(rules, /initialRules\?: Rule\[\]; canMutate\?: boolean/);
  assert.match(rules, /if \(!initialRules\) load\(\)/);
  assert.match(rules, /rules\.length > 0 && canMutate &&/);
});

test("Inbox APIs authorize reads and owner mutations without trusting client message text", async () => {
  const inbox = await source("src/app/api/inbox/route.ts");
  const rules = await source("src/app/api/message-rules/route.ts");

  assert.match(inbox, /if \(facebookPageId\) await requirePageAccess\(facebookPageId\)/);
  assert.match(inbox, /else await requireUser\(\{ owner: true \}\)/);
  assert.match(inbox, /export async function POST[\s\S]*?await requireUser\(\{ owner: true \}\)/);
  assert.match(inbox, /await requireInboxMessage\(messageId, facebookPageId\)/);
  assert.match(inbox, /storedMessage\.message/);
  assert.match(inbox, /message\.facebookPageId !== facebookPageId/);
  assert.match(inbox, /where: \{ senderId: conv\.senderId, message: conv\.message, facebookPageId: page\.id \}/);
  assert.match(rules, /export async function GET[\s\S]*?await requireUser\(\)/);
  assert.match(rules, /export async function POST[\s\S]*?await requireUser\(\{ owner: true \}\)/);
});

test("Messenger send claims a stored reply before the external call and restores it on failure", async () => {
  const inbox = await source("src/app/api/inbox/route.ts");
  const handler = inbox.slice(inbox.indexOf('if (action === "send-fb-reply")'), inbox.indexOf("// Sync real inbox messages"));

  assert.match(handler, /updateMany\(\{\s*where: \{ id: msg\.id, isRead: false \}/);
  assert.match(handler, /if \(!claimed\.count\)/);
  assert.match(handler, /await replyToFbConversation\(/);
  assert.match(handler, /catch \(error\) \{\s*await prisma\.inboxMessage\.updateMany\(\{ where: \{ id: msg\.id, isRead: true \}, data: \{ isRead: false \} \}\)/);
});
