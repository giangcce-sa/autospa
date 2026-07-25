import { AIRoomsWorkspace, type AIRoomsWorkspaceProps } from "@/components/modules/ai-rooms/AIRoomsWorkspace";

export default function Page({ searchParams }: AIRoomsWorkspaceProps) {
  return <AIRoomsWorkspace searchParams={searchParams} />;
}
