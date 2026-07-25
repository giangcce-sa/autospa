import { GrowthAdsWorkspace, type GrowthAdsWorkspaceProps } from "@/components/modules/growth/GrowthAdsWorkspace";

export default function Page({ searchParams }: GrowthAdsWorkspaceProps) {
  return <GrowthAdsWorkspace searchParams={searchParams} />;
}
