import { AbTestView } from "@/components/modules/ab-test/AbTestView";
import { PageHeader } from "@/components/ui/PageHeader";

export default function AbTestPage() {
  return (
    <>
      <PageHeader
        title="A/B Testing"
        description="So sánh hai phiên bản caption sau 48h — tìm ra bài nào hiệu quả hơn"
      />
      <AbTestView />
    </>
  );
}
