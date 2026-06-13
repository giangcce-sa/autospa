import { BrandManager } from "@/components/modules/brand/BrandManager";
import { PageHeader } from "@/components/ui/PageHeader";

export default function BrandPage() {
  return (
    <>
      <PageHeader
        title="Thương hiệu"
        description="Thông tin về spa để AI hiểu và sinh nội dung đúng thương hiệu"
      />
      <BrandManager />
    </>
  );
}
