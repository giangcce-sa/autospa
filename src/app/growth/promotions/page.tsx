import { GrowthPromotionsWorkspace, type GrowthPromotionsWorkspaceProps } from "@/components/modules/growth/GrowthPromotionsWorkspace";

export default function Page({ searchParams }: GrowthPromotionsWorkspaceProps) {
  return <GrowthPromotionsWorkspace searchParams={searchParams} />;
}
