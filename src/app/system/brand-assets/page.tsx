import { BrandAssetsWorkspace, type BrandAssetsWorkspaceProps } from "@/components/modules/brand-assets/BrandAssetsWorkspace";

export default function Page({ searchParams }: BrandAssetsWorkspaceProps) {
  return <BrandAssetsWorkspace searchParams={searchParams} />;
}
