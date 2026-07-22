import type { Metadata } from "next";
import { HubPage } from "@/components/modules/hubs/HubPage";

export const metadata: Metadata = {
  title: "Sáng tạo",
  description: "Tạo, kiểm tra và xuất bản nội dung cho spa.",
};

export default function CreativePage() {
  return <HubPage sectionId="creative" relatedToolIds={["staff-visuals"]} />;
}
