import { HolidayCalendar } from "@/components/modules/holidays/HolidayCalendar";
import { PageHeader } from "@/components/ui/PageHeader";
import { requireUser } from "@/lib/page-access";

export default async function HolidaysPage() {
  const user = await requireUser();

  return (
    <>
      <PageHeader
        title="Lịch Dịp Đặc biệt"
        description="AI tự động gợi ý nội dung cho các ngày lễ, dịp đặc biệt trong năm"
      />
      <HolidayCalendar canMutate={user.role === "owner"} />
    </>
  );
}
