import type { Metadata } from "next";
import { HubPage } from "@/components/modules/hubs/HubPage";

export const metadata: Metadata = {
  title: "Hệ thống",
  description: "Cấu hình thương hiệu, kết nối và công cụ vận hành AutoSpa.",
};

export default function SystemPage() {
  return <HubPage sectionId="system" systemMode />;
}
