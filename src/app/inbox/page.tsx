import { InboxPageClient } from "@/components/modules/inbox/InboxPageClient";
import { PageHeader } from "@/components/ui/PageHeader";

export default function InboxPage() {
  return (
    <>
      <PageHeader
        title="Auto Inbox"
        description="AI trả lời tin nhắn Facebook + Zalo, quản lý rule và yêu cầu đặt lịch"
      />
      <InboxPageClient />
    </>
  );
}
