import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import test from "node:test";
import {
  APP_ROUTES,
  APP_SECTIONS,
  ROUTES_BY_ID,
  ROUTES_BY_PATH,
  SECTIONS,
  getCommandRoutes,
  getSectionRoutes,
  routeIsActive,
  sectionIsActive,
} from "../src/config/routes.ts";

const appDirectory = join(process.cwd(), "src", "app");

function findPageRoutes(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return findPageRoutes(path);
    if (!entry.isFile() || entry.name !== "page.tsx") return [];
    const folder = relative(appDirectory, directory).split(sep).filter(Boolean);
    const segments = folder.filter((segment) => !segment.startsWith("(") && !segment.startsWith("@"));
    return [segments.length ? `/${segments.join("/")}` : "/"];
  });
}

test("registers every application page exactly once", () => {
  const pageRoutes = findPageRoutes(appDirectory).sort();
  const registeredRoutes = APP_ROUTES.map((route) => route.path).sort();
  assert.deepEqual(registeredRoutes, pageRoutes);
  assert.equal(ROUTES_BY_PATH.size, APP_ROUTES.length);
  assert.equal(ROUTES_BY_ID.size, APP_ROUTES.length);
});

test("defines complete navigation metadata", () => {
  assert.deepEqual(SECTIONS.map((section) => section.id), APP_SECTIONS);
  for (const route of APP_ROUTES) {
    assert.ok(route.id);
    assert.ok(route.path.startsWith("/"));
    assert.ok(route.label);
    assert.ok(route.description);
    assert.ok(route.icon);
    assert.ok(route.scope);
    assert.ok(route.visibility);
    if (route.hub) assert.ok(APP_SECTIONS.includes(route.section));
    if (route.command) assert.notEqual(route.visibility, "hidden");
  }
});

test("keeps each visible route inside one primary section", () => {
  for (const route of APP_ROUTES.filter((route) => route.visibility !== "hidden")) {
    assert.ok(APP_SECTIONS.includes(route.section));
    const matches = APP_SECTIONS.filter((section) => getSectionRoutes(section).some((item) => item.id === route.id));
    assert.deepEqual(matches, [route.section]);
  }
});

test("exposes all command and hub routes through registered paths", () => {
  for (const route of getCommandRoutes()) {
    assert.equal(ROUTES_BY_PATH.get(route.path)?.id, route.id);
  }
  for (const section of APP_SECTIONS) {
    for (const route of [...getSectionRoutes(section, "primary"), ...getSectionRoutes(section, "tool")]) {
      assert.equal(route.section, section);
      assert.equal(ROUTES_BY_PATH.get(route.path)?.id, route.id);
    }
  }
});

test("defines mixed account and Page scopes for Brand Assets", () => {
  const route = ROUTES_BY_ID.get("system-brand-assets");
  assert.ok(route?.views);

  const scopes = Object.fromEntries(route.views.map((view) => [view.id, view.scope]));
  assert.deepEqual(scopes, {
    overview: "account",
    brand: "account",
    kit: "current_page",
    services: "current_page",
    staff: "current_page",
    stories: "current_page",
    style: "current_page",
    learning: "account",
  });
});

test("matches routes and sections without prefix collisions", () => {
  assert.equal(routeIsActive("/", "/"), true);
  assert.equal(routeIsActive("/reports", "/"), false);
  assert.equal(routeIsActive("/reports/detail", "/reports"), true);
  assert.equal(routeIsActive("/reports-old", "/reports"), false);
  assert.equal(sectionIsActive("/quality", "creative"), true);
  assert.equal(sectionIsActive("/facebook-ads", "growth"), true);
  assert.equal(sectionIsActive("/settings", "system"), true);
});
