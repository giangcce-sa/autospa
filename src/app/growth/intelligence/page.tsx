import { GrowthIntelligenceWorkspace, type GrowthIntelligenceWorkspaceProps } from "@/components/modules/growth/GrowthIntelligenceWorkspace";

export default function Page({ searchParams }: GrowthIntelligenceWorkspaceProps) {
  return <GrowthIntelligenceWorkspace searchParams={searchParams} />;
}
