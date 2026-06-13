import { ListeningDashboard } from "@/components/modules/listening/ListeningDashboard";
import { PageHeader } from "@/components/ui/PageHeader";

export default function ListeningPage() {
  return (
    <>
      <PageHeader title="Social Listening" description="Theo dõi đề cập thương hiệu, phát hiện khủng hoảng và xu hướng ngành spa" />
      <ListeningDashboard />
    </>
  );
}
