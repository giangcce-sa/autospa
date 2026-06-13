import { BrandKitManager } from "@/components/modules/brand-kit/BrandKitManager";
import { PageHeader } from "@/components/ui/PageHeader";

export default function BrandKitPage() {
  return (
    <>
      <PageHeader title="Brand Kit" description="Lưu logo, màu sắc thương hiệu để AI áp dụng nhất quán vào mọi nội dung" />
      <BrandKitManager />
    </>
  );
}
