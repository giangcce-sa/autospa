import { SalePageClient } from "@/components/modules/sale/SalePageClient";
import { PageHeader } from "@/components/ui/PageHeader";

export default function SalePage() {
  return (
    <>
      <PageHeader title="Chốt Sale AI" description="Quản lý leads + tự ping khách cũ — không chờ khách inbox" />
      <SalePageClient />
    </>
  );
}
