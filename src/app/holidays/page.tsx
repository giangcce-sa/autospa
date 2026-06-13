import { HolidayCalendar } from "@/components/modules/holidays/HolidayCalendar";
import { PageHeader } from "@/components/ui/PageHeader";

export default function HolidaysPage() {
  return (
    <>
      <PageHeader
        title="Lịch Dịp Đặc biệt"
        description="AI tự động gợi ý nội dung cho các ngày lễ, dịp đặc biệt trong năm"
      />
      <HolidayCalendar />
    </>
  );
}
