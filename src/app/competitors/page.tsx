import { CompetitorsPageClient } from "@/components/modules/competitors/CompetitorsPageClient";
import { PageHeader } from "@/components/ui/PageHeader";

export default function CompetitorsPage() {
  return (
    <>
      <PageHeader
        title="Intelligence"
        description="Multi-source: FB Ads Library + Google Trends + Đối thủ — Intelligence Agent tổng hợp insight"
      />
      <CompetitorsPageClient />
    </>
  );
}
