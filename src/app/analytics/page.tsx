import { AnalyticsDashboard } from "@/components/modules/analytics/AnalyticsDashboard";
import { PageHeader } from "@/components/ui/PageHeader";

export default function AnalyticsPage() {
  return (
    <>
      <PageHeader title="Analytics" description="Theo dõi hiệu quả bài đăng — reach, tương tác, giờ đăng tốt nhất" />
      <AnalyticsDashboard />
    </>
  );
}
