import { CouncilView } from "@/components/modules/council/CouncilView";
import { PageHeader } from "@/components/ui/PageHeader";

export default function CouncilPage() {
  return (
    <>
      <PageHeader
        title="AI Council"
        description="Bàn luận chiến lược với 2 AI — Claude đề xuất, GPT phản biện, tổng hợp quyết định"
      />
      <CouncilView />
    </>
  );
}
