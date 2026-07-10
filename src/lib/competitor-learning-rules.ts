export function calculateCompetitorEngagement(likes: number, comments: number, shares: number) {
  return likes + comments * 2 + shares * 3;
}

export function competitorViralLevel(score: number): "low" | "medium" | "high" {
  if (score >= 500) return "high";
  if (score >= 120) return "medium";
  return "low";
}
