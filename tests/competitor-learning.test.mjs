import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  calculateCompetitorEngagement,
  competitorViralLevel,
} from "../src/lib/competitor-learning-rules.ts";

describe("competitor learning helpers", () => {
  it("weights comments and shares above likes", () => {
    assert.equal(calculateCompetitorEngagement(100, 10, 5), 135);
  });

  it("classifies medium and high viral levels", () => {
    assert.equal(competitorViralLevel(119), "low");
    assert.equal(competitorViralLevel(120), "medium");
    assert.equal(competitorViralLevel(500), "high");
  });
});
