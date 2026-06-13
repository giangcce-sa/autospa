import { InboxView } from "@/components/modules/inbox/InboxView";
import { PageHeader } from "@/components/ui/PageHeader";

export default function InboxPage() {
  return (
    <>
      <PageHeader
        title="Auto Inbox"
        description="AI trả lời tin nhắn Facebook và quản lý yêu cầu đặt lịch"
      />
      <InboxView />
    </>
  );
}
