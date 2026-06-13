import { ZaloManager } from "@/components/modules/zalo/ZaloManager";
import { PageHeader } from "@/components/ui/PageHeader";

export default function ZaloPage() {
  return (
    <>
      <PageHeader title="Zalo OA" description="Đăng nội dung lên Zalo OA song song với Facebook" />
      <ZaloManager />
    </>
  );
}
