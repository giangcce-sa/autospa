import type { Metadata } from "next";
import { HubPage } from "@/components/modules/hubs/HubPage";

export const metadata: Metadata = {
  title: "Tăng trưởng",
  description: "Báo cáo, quảng cáo và công cụ phát triển hoạt động spa.",
};

export default function GrowthPage() {
  return <HubPage sectionId="growth" />;
}
