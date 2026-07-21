import type { Metadata } from "next";
import { AutoSpaUIDemo } from "@/components/modules/ui-demo/AutoSpaUIDemo";

export const metadata: Metadata = {
  title: "AutoSpa UI Demo",
  description: "Bản demo giao diện AutoSpa đơn giản hóa",
};

export default function UIDemoPage() {
  return <AutoSpaUIDemo />;
}
