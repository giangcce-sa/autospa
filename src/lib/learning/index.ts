import { learnContentPatterns } from "./content-memory";
import { learnLeadAttribution } from "./lead-attribution";
import { learnFromAbTests } from "./ab-autolearn";
import { evaluateDecisionOutcomes } from "./decision-outcome";
import { learnCustomerBehavior } from "./customer-behavior";
import { learnFromCompetitors } from "./competitor-learning";

export interface LearningRunResult {
  content: { updated: number; insights: string[] };
  lead: { updated: number; insights: string[] };
  ab: { processed: number; insights: string[] };
  decision: { evaluated: number; insights: string[] };
  behavior: { updated: number; insights: string[] };
  competitor: { updated: number; insights: string[] };
  totalInsights: number;
  durationMs: number;
}

export async function runAllLearningLoops(): Promise<LearningRunResult> {
  const start = Date.now();

  const [content, lead, ab, decision, behavior, competitor] = await Promise.allSettled([
    learnContentPatterns(),
    learnLeadAttribution(),
    learnFromAbTests(),
    evaluateDecisionOutcomes(),
    learnCustomerBehavior(),
    learnFromCompetitors(),
  ]);

  const safeContent = content.status === "fulfilled" ? content.value : { updated: 0, insights: [] };
  const safeLead = lead.status === "fulfilled" ? lead.value : { updated: 0, insights: [] };
  const safeAb = ab.status === "fulfilled" ? ab.value : { processed: 0, insights: [] };
  const safeDecision = decision.status === "fulfilled" ? decision.value : { evaluated: 0, insights: [] };
  const safeBehavior = behavior.status === "fulfilled" ? behavior.value : { updated: 0, insights: [] };
  const safeCompetitor = competitor.status === "fulfilled" ? competitor.value : { updated: 0, insights: [] };

  const totalInsights =
    safeContent.insights.length +
    safeLead.insights.length +
    safeAb.insights.length +
    safeDecision.insights.length +
    safeBehavior.insights.length +
    safeCompetitor.insights.length;

  return {
    content: safeContent,
    lead: safeLead,
    ab: safeAb,
    decision: safeDecision,
    behavior: safeBehavior,
    competitor: safeCompetitor,
    totalInsights,
    durationMs: Date.now() - start,
  };
}

export { getContentContext } from "./content-memory";
export { getSourceWeights } from "./lead-attribution";
export { getBehaviorInsights } from "./customer-behavior";
export { getDecisionTrackRecord } from "./decision-outcome";
export { getCompetitorContext, getCompetitorMemory } from "./competitor-learning";
