import { CEOMemoryView } from "@/components/modules/ceo-memory/CEOMemoryView";
import { PageHeader } from "@/components/ui/PageHeader";

export default function CEOMemoryPage() {
  return (
    <>
      <PageHeader
        title="CEO Memory"
        description="Quyết định AI Council qua thời gian + kết quả thực tế. Council mới luôn tham khảo lịch sử"
      />
      <CEOMemoryView />
    </>
  );
}
