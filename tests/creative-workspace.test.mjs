import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("canonical Content, Images, and Publishing render the production Creative dispatcher", async () => {
  for (const path of [
    "src/app/creative/ideas/page.tsx",
    "src/app/creative/content/page.tsx",
    "src/app/creative/images/page.tsx",
    "src/app/creative/video/page.tsx",
    "src/app/creative/publishing/page.tsx",
  ]) {
    const page = await source(path);
    assert.match(page, /<CreativeWorkspace routeId=/, `${path} must render CreativeWorkspace`);
    assert.equal(page.includes("<WorkspacePage"), false, `${path} must not use the handoff shell`);
  }
});

test("Creative dispatcher resolves URL scope and checks record ownership server-side", async () => {
  const workspace = await source("src/components/modules/creative/CreativeWorkspace.tsx");

  assert.match(workspace, /parseWorkspaceUrl\(params, \{/);
  assert.match(workspace, /await resolveWorkspaceAccess\(route, state\)/);
  assert.match(workspace, /const recordId = creativeRecordIdForView\(routeId, access\.state\.view, access\.state\.id\)/);
  assert.match(workspace, /where: \{ id: recordId \}/);
  assert.match(workspace, /prisma\.videoProject\.findUnique\(\{/);
  assert.match(workspace, /prisma\.post\.findUnique\(\{/);
  assert.match(workspace, /record\.facebookPageId !== pageId/);
  assert.match(workspace, /message="Bản ghi không thuộc Facebook Page đang chọn"/);
});

test("Ideas research is server-loaded, Page-scoped, and owner-only", async () => {
  const workspace = await source("src/components/modules/creative/CreativeWorkspace.tsx");
  const service = await source("src/lib/content-research.ts");
  const route = await source("src/app/api/content-research/route.ts");
  const view = await source("src/components/modules/content-research/ContentResearch.tsx");

  assert.match(workspace, /await getResearchDrafts\(pageId, 30\)/);
  assert.match(workspace, /mode=\{mode\} initialDrafts=\{drafts\}/);
  assert.match(service, /generateContentPlan\(\s*facebookPageId: string,/);
  assert.match(service, /where: \{ facebookPageId, status: "published" \}/);
  assert.match(service, /qualityNotes: `AI-RESEARCH: \$\{idea\.topic\}`,\s*facebookPageId,/);
  assert.match(service, /postId: post\.id,\s*facebookPageId,/);
  assert.match(service, /getResearchDrafts\(facebookPageId: string, limit = 30\)/);
  assert.match(service, /scheduledAt: draft\.scheduledAt\?\.toISOString\(\) \?\? null/);
  assert.match(route, /requireExplicitPageAccess\(input\.facebookPageId, \{ owner: true \}\)/);
  assert.match(route, /post\.facebookPageId !== page!\.id/);
  assert.match(route, /daysAhead: z\.coerce\.number\(\)\.int\(\)\.min\(1\)\.max\(30\)/);
  assert.match(view, /mode\?: "overview" \| "research" \| "backlog"/);
  assert.match(view, /initialDrafts\?: ResearchDraftData\[\]/);
  assert.match(view, /canMutate &&/);
});

test("canonical Content restores persisted Posts and preserves lifecycle while editing", async () => {
  const workspace = await source("src/components/modules/creative/CreativeWorkspace.tsx");
  const editor = await source("src/components/modules/creative/CreativeContentEditor.tsx");
  const quality = await source("src/components/modules/quality/QualityChecker.tsx");
  const publish = await source("src/app/api/publish/route.ts");

  assert.match(workspace, /select: \{[\s\S]*?caption: true,[\s\S]*?hashtags: true,[\s\S]*?postType: true,/);
  // Props are asserted individually so formatting can change but the wiring cannot.
  assert.match(workspace, /<CreativeContentEditor[\s\S]{0,240}?facebookPageId=\{pageId\}[\s\S]{0,240}?post=\{post\}[\s\S]{0,240}?canMutate=\{canMutate\}/);
  assert.match(workspace, /initialCaption=\{post\?\.caption\}/);
  assert.match(workspace, /initialHashtags=\{post\?\.hashtags \?\? undefined\}/);
  assert.equal(quality.includes("/api/publish?postId="), false);
  assert.match(editor, /action: "update",\s*postId: post\.id,/);
  assert.match(publish, /if \(action === "update" \|\| action === "schedule" \|\| action === "draft"\)/);
  assert.match(publish, /action === "update"\s*\? \{\}\s*: \{/);
  assert.match(publish, /const reviewInputChanged = \(caption !== undefined && caption !== post\.caption\)/);
  assert.match(publish, /if \(reviewInputChanged\) await tx\.contentReview\.deleteMany\(\{ where: \{ postId: post\.id \} \}\)/);
  assert.match(workspace, /select: \{[\s\S]*?imageUrl: true,[\s\S]*?scheduledAt: true,[\s\S]*?service: \{ select: \{ name: true \} \},[\s\S]*?review: \{ select: \{ status: true, score: true, issues: true \} \}/);
  assert.match(workspace, /scheduledAt: postData\.scheduledAt\?\.toISOString\(\) \?\? null/);
  assert.match(workspace, /postReview = review \? parsePostReview\(review\) : null/);
  assert.match(workspace, /initialPost=\{post\} initialReview=\{postReview\}/);
  assert.match(editor, /new URLSearchParams\(\{ view, scope: "current", pageId: facebookPageId, id: postId \}\)/);
  assert.match(editor, /navigate\("\/creative\/images", "create", post\.id\)/);
  assert.match(editor, /navigate\("\/creative\/publishing", "composer", post\.id\)/);
});

test("canonical Library and Calendar keep Page filters and view state in the URL", async () => {
  const route = await source("src/app/api/content/list/route.ts");
  const library = await source("src/components/modules/library/LibraryView.tsx");
  const calendar = await source("src/components/modules/publish/CalendarView.tsx");

  assert.match(library, /if \(facebookPageId\) params\.set\("facebookPageId", facebookPageId\)/);
  assert.match(library, /if \(status\) params\.set\("status", status\)/);
  assert.match(library, /if \(nextQuery\.trim\(\)\) params\.set\("q", nextQuery\.trim\(\)\)/);
  assert.match(library, /signal: controller\.signal/);
  assert.match(library, /if \(!response\.ok \|\| !payload\?\.success\) throw new Error/);
  assert.match(library, /setError\(cause instanceof Error \? cause\.message : "Không tải được thư viện nội dung"\)/);
  assert.match(route, /caption: \{ contains: query, mode: "insensitive" \}/);
  assert.match(calendar, /if \(facebookPageId\) params\.set\("facebookPageId", facebookPageId\)/);
  assert.match(calendar, /params\.set\("month", `\$\{nextYear\}-\$\{String\(nextMonth \+ 1\)\.padStart\(2, "0"\)\}`\)/);
  assert.match(library, /\/creative\/publishing\?\$\{params\.toString\(\)\}/);
  assert.match(calendar, /\/creative\/publishing\?view=composer&scope=current/);
});

test("canonical Publishing is server-loaded, Page-scoped, and syncs id to URL", async () => {
  const composer = await source("src/components/modules/creative/CreativePublishingComposer.tsx");
  const manager = await source("src/components/modules/publish/PublishManager.tsx");

  assert.match(composer, /new URLSearchParams\(\{ view: "composer", scope: "current", pageId: facebookPageId \}\)/);
  assert.match(composer, /initialPostId=\{postId\}[\s\S]*?initialPost=\{initialPost\}[\s\S]*?initialReview=\{initialReview\}[\s\S]*?facebookPageId=\{facebookPageId\}/);
  assert.match(manager, /if \(!resolvedPostId \|\| initialPost\) return \(\) => controller\.abort\(\)/);
  assert.match(manager, /if \(facebookPageId\) params\.set\("facebookPageId", facebookPageId\)/);
  assert.match(manager, /facebookPageId: \(facebookPageId \?\? selectedPageId\) \|\| undefined/);
  assert.match(manager, /disabled=\{Boolean\(facebookPageId\)\}/);
  assert.match(manager, /\/system\/settings\?view=channels&scope=account/);
});

test("canonical Video maps URL views and keeps viewers read-only", async () => {
  const workspace = await source("src/components/modules/creative/CreativeWorkspace.tsx");
  const adapter = await source("src/components/modules/creative/CreativeVideoStudio.tsx");
  const studio = await source("src/components/modules/video-studio/VideoStudio.tsx");

  assert.match(workspace, /<VideoView view=\{access\.state\.view\}/);
  assert.match(adapter, /canonicalView=\{view\}/);
  assert.match(adapter, /canMutate=\{canMutate\}/);
  assert.match(adapter, /new URLSearchParams\(\{ view: nextView, scope: "current", pageId: facebookPageId \}\)/);
  assert.match(adapter, /initialProjectId=\{projectId\}/);
  assert.match(adapter, /initialSceneId=\{sceneId\}/);
  assert.match(adapter, /params\.set\("id", nextProjectId\)/);
  assert.match(adapter, /params\.set\("step", nextSceneId\)/);
  assert.match(studio, /canonicalView === "overview" && <VideoOverview/);
  assert.match(studio, /canonicalView === "review" && <VideoReview/);
  assert.match(studio, /canonicalView === "jobs" && <VideoJobs/);
  assert.match(studio, /canMutate\s*\? <ProjectWorkspace/);
  assert.match(studio, /: <VideoProjectReadOnly/);
  assert.match(studio, /loadProject\(selectedId, controller\.signal\)/);
  assert.match(studio, /return \(\) => controller\.abort\(\)/);
  assert.match(studio, /onSceneIdChange\?\.\(item\.id\)/);
});

test("Video publish and approval gates remain server-enforced", async () => {
  const update = await source("src/app/api/video-studio/projects/[id]/route.ts");
  const publish = await source("src/app/api/video-studio/projects/[id]/publish/route.ts");

  assert.match(update, /requirePageAccess\(existing\.facebookPageId, \{ owner: true \}\)/);
  assert.match(update, /existing\.renderedRevision !== existing\.inputRevision/);
  assert.match(update, /approvedRevision: existing\.inputRevision/);
  assert.match(publish, /requirePageAccess\(project\.facebookPageId, \{ owner: true \}\)/);
  assert.match(publish, /project\.outputUrl\.startsWith\("mock:\/\/"\)/);
  assert.match(publish, /project\.renderedRevision !== project\.inputRevision \|\| project\.approvedRevision !== project\.inputRevision/);
  assert.match(publish, /assertProjectPublishConsent\(project\.id\)/);
  assert.match(publish, /idempotencyKey: `publish:\$\{id\}:\$\{project\.inputRevision\}:\$\{targets\.join\(","\)\}`/);
});

test("canonical Images serves server-loaded galleries to viewers and keeps mutations owner-only", async () => {
  const workspace = await source("src/components/modules/creative/CreativeWorkspace.tsx");
  const reader = await source("src/lib/image-history.ts");
  const route = await source("src/app/api/images/history/route.ts");
  const library = await source("src/components/modules/images/ImageLibrary.tsx");

  assert.match(workspace, /await getImageHistoryPage\(pageId, \{ take: access\.state\.view === "overview" \? 8 : 24 \}\)/);
  assert.match(workspace, /view === "create"\) return canMutate \? <ImageGenerator facebookPageId=\{pageId\} postId=\{postId\} showHistory=\{false\} \/> : <ReadOnlyMessage \/>/);
  assert.match(await source("src/components/modules/images/ImageGenerator.tsx"), /if \(!showHistory\) \{[\s\S]*?setHistory\(\[\]\);[\s\S]*?setPreviewImage\(null\)/);
  assert.match(workspace, /canReview=\{view === "review" && canMutate\}/);
  assert.match(reader, /findFirst\(\{\s*where: \{ id: options\.cursor, facebookPageId \}/);
  assert.match(reader, /throw new AccessError\("Cursor hình ảnh không hợp lệ", 400\)/);
  assert.match(reader, /orderBy: \[\{ createdAt: "desc" \}, \{ id: "desc" \}\]/);
  assert.match(reader, /options\.cursor \? \{ cursor: \{ id: options\.cursor \}, skip: 1 \} : \{\}/);
  assert.match(route, /await requirePageAccess\(facebookPageId\)/);
  assert.match(route, /getImageHistoryPage\(facebookPageId/);
  assert.match(library, /params = new URLSearchParams\(\{ facebookPageId, take: "24", cursor: nextCursor \}\)/);
  assert.match(library, /canReview &&/);
});

test("canonical Content opens Page-scoped Bulk, experiments, and review", async () => {
  const workspace = await source("src/components/modules/creative/CreativeWorkspace.tsx");
  const bulk = await source("src/components/modules/bulk/BulkGenerator.tsx");
  const route = await source("src/app/api/bulk/route.ts");

  assert.match(workspace, /await getBulkPlans\(pageId\)/);
  assert.match(workspace, /<BulkGenerator facebookPageId=\{pageId\} canMutate=\{canMutate\} initialPlans=\{bulkPlans\} \/>/);
  assert.match(bulk, /facebookPageId: providedPageId/);
  assert.match(bulk, /initialPlans\?: BulkPlanData\[\]/);
  assert.match(bulk, /canMutate \? \(/);
  assert.match(route, /requireExplicitPageAccess\(input\.facebookPageId, \{ owner: true \}\)/);
  assert.match(route, /parseGeneratedBulkPosts\(result, input\)/);
  assert.match(workspace, /<AbTestView facebookPageId=\{pageId\} canMutate=\{canMutate\} \/>/);
  assert.match(workspace, /canMutate \? \([\s\S]*?<QualityChecker[\s\S]*?facebookPageId=\{pageId\}[\s\S]*?postId=\{postId\}[\s\S]*?initialCaption=\{post\?\.caption\}[\s\S]*?\) : <ReadOnlyMessage \/>/);
});

test("A/B experiments authorize Page reads and owner mutations", async () => {
  const route = await source("src/app/api/ab-test/route.ts");
  const view = await source("src/components/modules/ab-test/AbTestView.tsx");

  assert.match(route, /requireExplicitPageAccess\(facebookPageId\)/);
  assert.match(route, /requireExplicitPageAccess\(rawPageId, \{ owner: true \}\)/);
  assert.match(route, /where: \{ abGroupId, facebookPageId: page!\.id \}/);
  assert.match(route, /where: \{ id: winnerId, abGroupId, facebookPageId \}/);
  assert.match(route, /where: \{ abGroupId, facebookPageId, id: \{ not: winnerId \} \}/);
  assert.match(view, /new URLSearchParams\(\{ facebookPageId \}\)/);
  assert.match(view, /body: JSON\.stringify\(\{ action: "judge", abGroupId, facebookPageId \}\)/);
  assert.match(view, /canMutate &&/);
});

test("Quality review authorizes the selected Page and rejects foreign Posts", async () => {
  const route = await source("src/app/api/quality/route.ts");
  const view = await source("src/components/modules/quality/QualityChecker.tsx");

  assert.match(route, /requireExplicitPageAccess\(facebookPageId, \{ owner: true \}\)/);
  assert.match(route, /post\.facebookPageId !== page!\.id/);
  assert.match(route, /Bài viết không thuộc Facebook Page đang chọn/);
  assert.match(view, /facebookPageId: providedPageId/);
  assert.match(view, /body: JSON\.stringify\(\{ caption, hashtags, postId, facebookPageId \}\)/);
  // The guarantee is that the request cannot fire without a selected Page; the
  // condition may also disable for other reasons (empty caption, in flight).
  assert.match(view, /disabled=\{[^}]*!facebookPageId[^}]*\}/);
  assert.match(view, /if \(!caption\.trim\(\) \|\| !facebookPageId\) return;/, "the handler itself also refuses");
});

test("Creative navigation drops stale record identity outside record views", async () => {
  const workspace = await source("src/components/modules/creative/CreativeWorkspace.tsx");
  const shell = await source("src/components/workspace/WorkspaceShell.tsx");
  const scopeControl = await source("src/components/workspace/WorkspaceScopeControl.tsx");

  assert.match(workspace, /const recordId = creativeRecordIdForView\(routeId, access\.state\.view, access\.state\.id\)/);
  assert.match(workspace, /routeId === "creative-content"\) return view === "editor" \|\| view === "review" \? id : undefined/);
  assert.match(scopeControl, /scope: "current", pageId, id: undefined, step: undefined/);
  assert.match(scopeControl, /workspaceSearchParams\(\{ \.\.\.state, scope, pageId, id: undefined, step: undefined \}\)/);
  assert.match(shell, /workspaceViewState\(route, \{ \.\.\.state, view: view\.id, scope, pageId \}\)/);
  assert.match(shell, /month: state\.view === "calendar" \? state\.month : undefined/);
});

test("Creative mutations are owner-only and library reads do not delete retained data", async () => {
  const generation = await source("src/app/api/content/route.ts");
  const feedback = await source("src/app/api/content/feedback/route.ts");
  const list = await source("src/app/api/content/list/route.ts");
  const select = await source("src/app/api/images/select/route.ts");
  const publish = await source("src/app/api/publish/route.ts");
  const workspace = await source("src/components/modules/creative/CreativeWorkspace.tsx");

  assert.match(generation, /requirePageAccess\(facebookPageId, \{ owner: true \}\)/);
  assert.match(feedback, /requirePageAccess\(generation\.facebookPageId, \{ owner: true \}\)/);
  assert.match(list, /requirePageAccess\(post\.facebookPageId, \{ owner: true \}\)/);
  assert.equal(list.includes("deleteMany"), false);
  assert.match(select, /requirePageAccess\(post\.facebookPageId, \{ owner: true \}\)/);
  assert.match(publish, /export async function POST[\s\S]*?requireUser\(\{ owner: true \}\)/);
  assert.match(workspace, /<LibraryView[\s\S]*?facebookPageId=\{pageId\}[\s\S]*?canonical[\s\S]*?canMutate=\{canMutate\}/);
});
