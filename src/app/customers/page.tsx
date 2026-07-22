import type { Metadata } from "next";
import { HubPage } from "@/components/modules/hubs/HubPage";

export const metadata: Metadata = {
  title: "Khách hàng",
  description: "Theo dõi hội thoại, lịch hẹn và quan hệ khách hàng.",
};

export default function CustomersPage() {
  return <HubPage sectionId="customers" />;
}
