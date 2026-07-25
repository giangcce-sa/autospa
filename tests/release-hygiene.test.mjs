import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("release ignores exclude local harness and personal artifacts", async () => {
  const [gitignore, dockerignore, eslintConfig] = await Promise.all([
    source(".gitignore"),
    source(".dockerignore"),
    source("eslint.config.mjs"),
  ]);

  assert.match(gitignore, /^\/\.claude\/$/m);
  assert.match(gitignore, /^\/Don_de_nghi_hoan_tien_Duong_Thi_Dung\.docx$/m);
  assert.match(gitignore, /^!\.env\.example$/m);
  assert.match(gitignore, /^!internal-ai-gateway\/\.env\.example$/m);
  assert.match(gitignore, /^!internal-ai-gateway\/\.env\.vps\.example$/m);
  assert.match(dockerignore, /^\.claude$/m);
  assert.match(dockerignore, /^Don_de_nghi_hoan_tien_Duong_Thi_Dung\.docx$/m);
  assert.match(dockerignore, /^test-results$/m);
  assert.match(dockerignore, /^playwright-report$/m);
  assert.match(eslintConfig, /"\.claude\/\*\*"/);
});

test("CI runs production smoke and preserves failure artifacts", async () => {
  const workflow = await source(".github/workflows/ci.yml");

  assert.equal((workflow.match(/npm audit --omit=dev --audit-level=high/g) ?? []).length, 2);
  assert.match(workflow, /name: Run production smoke/);
  assert.match(workflow, /npm run start -- --hostname 127\.0\.0\.1/);
  assert.match(workflow, /npm run smoke/);
  assert.match(workflow, /if: failure\(\)/);
  assert.match(workflow, /playwright-report\//);
  assert.match(workflow, /test-results\//);
  assert.match(workflow, /\/tmp\/autospa-production\.log/);
});

test("Prisma CLI prefers the direct migration connection", async () => {
  const config = await source("prisma.config.ts");

  assert.match(config, /url: process\.env\.DIRECT_URL \|\| process\.env\.DATABASE_URL/);
});
