import test from "node:test";
import assert from "node:assert/strict";
import { parseWorkspaceUrl, workspaceScopesForRoute, workspaceSearchParams } from "../src/lib/workspace-url.ts";

const options = { views: ["overview", "editor"], defaultView: "overview", defaultScope: "current" };

test("workspace URL parser validates view and scope", () => {
  assert.deepEqual(parseWorkspaceUrl({ view: "editor", scope: "all", pageId: "page-1" }, options), {
    view: "editor",
    scope: "all",
    pageId: "page-1",
    id: undefined,
    status: undefined,
    q: undefined,
    step: undefined,
  });
  assert.equal(parseWorkspaceUrl({ view: "unknown", scope: "unknown" }, options).view, "overview");
  assert.equal(parseWorkspaceUrl({ view: "unknown", scope: "unknown" }, options).scope, "current");
});

test("workspace URL serialization preserves stable state", () => {
  assert.equal(workspaceSearchParams({ view: "editor", scope: "current", pageId: "page-1", id: "post-1" }).toString(), "view=editor&scope=current&pageId=page-1&id=post-1");
});

test("workspace scope policy rejects unsupported URL scopes", () => {
  assert.deepEqual(workspaceScopesForRoute("current_page"), ["current"]);
  assert.deepEqual(workspaceScopesForRoute("current_or_all"), ["current", "all"]);
  assert.deepEqual(workspaceScopesForRoute("account"), ["account"]);

  const state = parseWorkspaceUrl(
    { view: "editor", scope: "all", pageId: "page-1" },
    {
      ...options,
      allowedScopes: workspaceScopesForRoute("current_page"),
    },
  );

  assert.equal(state.scope, "current");
});
