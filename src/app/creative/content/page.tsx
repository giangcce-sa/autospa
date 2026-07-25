import { CreativeWorkspace, type CreativeWorkspaceProps } from "@/components/modules/creative/CreativeWorkspace";

export default function Page({ searchParams }: Pick<CreativeWorkspaceProps, "searchParams">) {
  return <CreativeWorkspace routeId="creative-content" searchParams={searchParams} />;
}
