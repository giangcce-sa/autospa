import type { Metadata } from "next";
import { SystemOverview } from "@/components/modules/hubs/SystemOverview";
import { getSystemOverview } from "@/lib/system-overview";

export const metadata: Metadata = {
  title: "Hệ thống",
  description: "Readiness cấu hình, thương hiệu, dữ liệu và AI của AutoSpa.",
};

export default async function SystemPage() {
  return <SystemOverview data={await getSystemOverview()} />;
}
