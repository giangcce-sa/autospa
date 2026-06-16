import { PromotionManager } from "@/components/modules/promotions/PromotionManager";
import { PageHeader } from "@/components/ui/PageHeader";

export default function PromotionsPage() {
  return (
    <>
      <PageHeader
        title="Flash Deal Manager"
        description="Tạo chương trình khuyến mãi — AI viết caption, auto-post lên Facebook / Zalo"
      />
      <PromotionManager />
    </>
  );
}
