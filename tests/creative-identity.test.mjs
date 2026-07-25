import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("content handoff finalizes the existing generation without regenerating", async () => {
  const generator = await source("src/components/modules/content/ContentGenerator.tsx");
  const handler = generator.slice(
    generator.indexOf("const handleSaveAndSend"),
    generator.indexOf("const handleCopy"),
  );

  assert.match(handler, /await saveFeedback\(undefined, true\)/);
  assert.match(handler, /feedback\.postId/);
  assert.match(handler, /onGoToImage\?\.\(postId\)/);
  assert.match(handler, /onGoToPublish\?\.\(postId\)/);
  assert.equal(handler.includes('fetch("/api/content"'), false);
});

test("content feedback creates and links at most one Post in its transaction", async () => {
  const generation = await source("src/app/api/content/route.ts");
  const route = await source("src/app/api/content/feedback/route.ts");

  assert.equal(generation.includes("prisma.post.create"), false);
  assert.match(generation, /postId: null/);
  assert.match(route, /prisma\.\$transaction\(async \(tx\) =>/);
  assert.match(route, /where: \{ id: generationId, postId: null \}/);
  assert.match(route, /data: \{ postId: created\.id \}/);
  assert.match(route, /await tx\.post\.delete\(\{ where: \{ id: created\.id \} \}\)/);
  assert.match(route, /data: \{\s*postId,/);
});

test("content workspace passes the finalized Post identity to image and publishing", async () => {
  const workspace = await source("src/components/modules/content/ContentWorkspace.tsx");

  assert.match(workspace, /const handleGoToImage = \(id: string\) => \{/);
  assert.match(workspace, /setPostId\(id\);\s*navigate\("image", id\);/);
  assert.match(workspace, /const handleGoToPublish = \(id = postId\) => \{/);
});

test("PublishManager uses server-loaded Posts and aborts stale legacy fallback loads", async () => {
  const manager = await source("src/components/modules/publish/PublishManager.tsx");

  assert.match(manager, /const controller = new AbortController\(\)/);
  assert.match(manager, /const resolvedPostId = initialPost\?\.id \?\? initialPostId/);
  assert.match(manager, /setPostId\(resolvedPostId\)/);
  assert.match(manager, /setCaption\(initialPost\?\.caption \?\? ""\)/);
  assert.match(manager, /setImageUrl\(initialPost\?\.imageUrl \?\?/);
  assert.match(manager, /if \(!resolvedPostId \|\| initialPost\) return \(\) => controller\.abort\(\)/);
  assert.match(manager, /fetch\(`\/api\/publish\?postId=\$\{resolvedPostId\}`/);
  assert.match(manager, /signal: controller\.signal/);
  assert.match(manager, /controller\.abort\(\)/);
  assert.equal(manager.includes('fetch("/api/reviewer"'), false);
  assert.match(manager, /if \(data\.data\?\.id\) \{\s*setPostId\(data\.data\.id\);\s*onPostIdChange\?\.\(data\.data\.id\);\s*\}\s*if \(res\.status === 422/);
});

test("publishing returns the persisted Post identity when review blocks", async () => {
  const route = await source("src/app/api/publish/route.ts");
  const blocked = route.slice(
    route.indexOf('if (review?.status === "fail"'),
    route.indexOf("const results:"),
  );

  assert.match(blocked, /data: \{ id: reviewPostId \}/);
  assert.match(blocked, /error: "REVIEW_BLOCKED"/);
});

test("image results reset when either Page or Post identity changes", async () => {
  const generator = await source("src/components/modules/images/ImageGenerator.tsx");

  assert.match(generator, /setResult\(null\);\s*setActiveVariant\(0\);[\s\S]*?\}, \[facebookPageId, postId\]\);/);
});

test("only explicit image selection attaches an image to a Post", async () => {
  const generation = await source("src/app/api/openai/route.ts");
  const edit = await source("src/app/api/images/edit/route.ts");
  const select = await source("src/app/api/images/select/route.ts");

  assert.equal(generation.includes("prisma.post.update"), false);
  assert.equal(edit.includes("prisma.post.update"), false);
  assert.match(generation, /postId: null/);
  assert.match(edit, /postId: null/);
  assert.match(select, /prisma\.\$transaction\(async \(tx\) =>/);
  assert.match(select, /tx\.imageGeneration\.updateMany\(\{/);
  assert.match(select, /OR: \[\{ postId: null \}, \{ postId: post\.id \}\]/);
  assert.match(select, /tx\.post\.update\(\{/);
  assert.match(select, /data: \{ imageUrl: generation\.imageUrl, imagePrompt: generation\.finalPrompt \}/);
});

test("image preview state reaches publishing only after explicit selection", async () => {
  const generator = await source("src/components/modules/images/ImageGenerator.tsx");
  const matches = generator.match(/onImageSet\?\.|onImageSet\(/g) ?? [];

  assert.equal(matches.length, 1);
  assert.match(generator, /if \(onImageSet\) onImageSet\(selectedImageUrl\);\s*onGoToPublish\?\.\(\);/);
});

test("publish retry skips channels with persisted external identities", async () => {
  const service = await source("src/lib/publishing/service.ts");

  assert.match(service, /select: \{ fbPostId: true, igPostId: true, tiktokVideoId: true \}/);
  assert.match(service, /channel === "facebook"[\s\S]*?post\.fbPostId/);
  assert.match(service, /channel === "instagram"[\s\S]*?post\.igPostId/);
  assert.match(service, /channel === "tiktok"[\s\S]*?post\.tiktokVideoId/);
  assert.match(service, /if \(existingExternalId\) \{[\s\S]*?status: "succeeded"[\s\S]*?externalId: existingExternalId/);
  assert.match(service, /if \(previous\?\.status === "succeeded" \|\| previous\?\.status === "needs_reconciliation"\) return previous/);
});
