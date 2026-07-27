import assert from "node:assert/strict";
import test from "node:test";
import {
  AGENT_DOMAIN,
  pickWorkflowForSignal,
  scoreAgents,
} from "../src/lib/orchestrator-policy.ts";

function signals(overrides = {}) {
  return {
    revenue: { last7: 7_000_000, prev7: 7_000_000, deltaPct: 0 },
    leads: { hotUnclosed: 0, coldNoNurture: 0, newToday: 0 },
    inbox: { unread: 0 },
    comments: { negativeUnreplied: 0 },
    approvals: { pendingOver24h: 0 },
    posts: { scheduledTomorrow: 1, engagement7dAvg: 10, engagement14dPriorAvg: 10 },
    competitor: { surgeCount: 0, topPostId: null },
    forecast: { next7Predicted: 7_000_000, vsAverage: 0 },
    pendingDecisionFails: 0,
    ...overrides,
  };
}

test("Quiet signals produce no agent priorities", () => {
  assert.deepEqual(scoreAgents(signals()), []);
});

test("Stuck approvals over 24h always score 95", () => {
  const out = scoreAgents(signals({ approvals: { pendingOver24h: 3 } }));
  assert.equal(out.length, 1);
  assert.equal(out[0].agent, "approval_review");
  assert.equal(out[0].score, 95);
  assert.match(out[0].reason, /3 yêu cầu chờ duyệt > 24h/);
});

test("Revenue drop beyond 20% pushes ads (90) and promotion (85)", () => {
  const out = scoreAgents(signals({ revenue: { last7: 0, prev7: 0, deltaPct: -0.21 } }));
  assert.deepEqual(out.map((priority) => [priority.agent, priority.score]), [
    ["ads_creative", 90],
    ["promotion", 85],
  ]);
  assert.match(out[0].reason, /giảm 21%/);

  // Exactly -0.2 is not enough.
  assert.deepEqual(scoreAgents(signals({ revenue: { last7: 0, prev7: 0, deltaPct: -0.2 } })), []);
});

test("Forecast more than 30% under average scores promotion 80", () => {
  const out = scoreAgents(signals({ forecast: { next7Predicted: 0, vsAverage: -0.31 } }));
  assert.deepEqual(out.map((priority) => [priority.agent, priority.score]), [["promotion", 80]]);
  assert.deepEqual(scoreAgents(signals({ forecast: { next7Predicted: 0, vsAverage: -0.3 } })), []);
});

test("Hot lead pileup over 10 scores proactive sales 85", () => {
  const out = scoreAgents(signals({ leads: { hotUnclosed: 11, coldNoNurture: 0, newToday: 0 } }));
  assert.deepEqual(out.map((priority) => [priority.agent, priority.score]), [["proactive_sales", 85]]);
  assert.deepEqual(scoreAgents(signals({ leads: { hotUnclosed: 10, coldNoNurture: 0, newToday: 0 } })), []);
});

test("Inbox backlog over 20 scores inbox rules 75", () => {
  const out = scoreAgents(signals({ inbox: { unread: 21 } }));
  assert.deepEqual(out.map((priority) => [priority.agent, priority.score]), [["inbox_rules", 75]]);
  assert.deepEqual(scoreAgents(signals({ inbox: { unread: 20 } })), []);
});

test("Engagement drop beyond 30% scores content research 70; zero averages stay silent", () => {
  const out = scoreAgents(signals({ posts: { scheduledTomorrow: 1, engagement7dAvg: 6.9, engagement14dPriorAvg: 10 } }));
  assert.deepEqual(out.map((priority) => [priority.agent, priority.score]), [["content_research", 70]]);

  assert.deepEqual(scoreAgents(signals({ posts: { scheduledTomorrow: 1, engagement7dAvg: 7, engagement14dPriorAvg: 10 } })), []);
  assert.deepEqual(scoreAgents(signals({ posts: { scheduledTomorrow: 1, engagement7dAvg: 0, engagement14dPriorAvg: 10 } })), []);
});

test("Competitor surge scores intelligence 65 and negatives score approval review 80", () => {
  const surge = scoreAgents(signals({ competitor: { surgeCount: 1, topPostId: "p1" } }));
  assert.deepEqual(surge.map((priority) => [priority.agent, priority.score]), [["intelligence", 65]]);

  const negatives = scoreAgents(signals({ comments: { negativeUnreplied: 2 } }));
  assert.deepEqual(negatives.map((priority) => [priority.agent, priority.score]), [["approval_review", 80]]);
});

test("An empty tomorrow schedule scores content research 60", () => {
  const out = scoreAgents(signals({ posts: { scheduledTomorrow: 0, engagement7dAvg: 10, engagement14dPriorAvg: 10 } }));
  assert.deepEqual(out.map((priority) => [priority.agent, priority.score]), [["content_research", 60]]);
});

test("Priorities come back sorted by score, highest first", () => {
  const out = scoreAgents(signals({
    approvals: { pendingOver24h: 1 },
    revenue: { last7: 0, prev7: 0, deltaPct: -0.5 },
    leads: { hotUnclosed: 11, coldNoNurture: 0, newToday: 0 },
    inbox: { unread: 25 },
    comments: { negativeUnreplied: 1 },
    competitor: { surgeCount: 2, topPostId: "p1" },
    forecast: { next7Predicted: 0, vsAverage: -0.4 },
    posts: { scheduledTomorrow: 0, engagement7dAvg: 5, engagement14dPriorAvg: 10 },
  }));

  const scores = out.map((priority) => priority.score);
  assert.deepEqual(scores, [...scores].sort((a, b) => b - a));
  assert.equal(out[0].agent, "approval_review");
  assert.equal(out[0].score, 95);
  assert.equal(out.length, 10);
});

test("Workflow precedence: revenue drop, then competitor surge (>=2), then engagement drop", () => {
  const everything = signals({
    revenue: { last7: 0, prev7: 0, deltaPct: -0.25 },
    competitor: { surgeCount: 3, topPostId: "p1" },
    posts: { scheduledTomorrow: 1, engagement7dAvg: 5, engagement14dPriorAvg: 10 },
  });
  assert.deepEqual(pickWorkflowForSignal(everything), {
    name: "revenue_drop",
    trigger: "Doanh thu giảm 25% so 7 ngày trước",
  });

  const surge = signals({ competitor: { surgeCount: 2, topPostId: "p1" } });
  assert.deepEqual(pickWorkflowForSignal(surge), {
    name: "competitor_surge",
    trigger: "2 đối thủ có bài viral",
  });
  assert.equal(pickWorkflowForSignal(signals({ competitor: { surgeCount: 1, topPostId: "p1" } })), null);

  const drop = signals({ posts: { scheduledTomorrow: 1, engagement7dAvg: 5, engagement14dPriorAvg: 10 } });
  assert.deepEqual(pickWorkflowForSignal(drop), { name: "engagement_drop", trigger: "Engagement giảm 50%" });

  assert.equal(pickWorkflowForSignal(signals()), null);
});

test("Every agent maps to a Brain domain", () => {
  assert.deepEqual(AGENT_DOMAIN, {
    ads_creative: "ads",
    proactive_sales: "sales",
    content_research: "content",
    intelligence: "intelligence",
    promotion: "content",
    inbox_rules: "customer",
    approval_review: "operation",
  });
});
