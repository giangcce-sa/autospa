import { prisma } from "@/lib/db";
import { generateContent, getBrandContext } from "@/lib/claude";
import { NextRequest, NextResponse } from "next/server";

const DEFAULT_HOLIDAYS = [
  { name: "Tết Nguyên Đán", date: "01-29", description: "Năm mới âm lịch - dịp lớn nhất trong năm" },
  { name: "Valentine", date: "02-14", description: "Ngày lễ tình nhân" },
  { name: "Quốc tế Phụ nữ", date: "03-08", description: "Ngày 8/3 - dịp vàng cho spa" },
  { name: "Giỗ tổ Hùng Vương", date: "04-18", description: "Lễ quốc gia" },
  { name: "30/4 - 1/5", date: "04-30", description: "Nghỉ lễ dài - khách đi spa nhiều" },
  { name: "Tết Đoan Ngọ", date: "06-10", description: "Tết mùng 5 tháng 5 âm" },
  { name: "Ngày gia đình Việt Nam", date: "06-28", description: "28/6 - combo gia đình" },
  { name: "Trung Thu", date: "09-07", description: "Tết Trung thu - gói quà tặng" },
  { name: "Quốc khánh", date: "09-02", description: "2/9 - nghỉ lễ" },
  { name: "Phụ nữ Việt Nam", date: "10-20", description: "Ngày 20/10 - dịp vàng cho spa" },
  { name: "Halloween", date: "10-31", description: "Halloween - chương trình đặc biệt" },
  { name: "Black Friday", date: "11-28", description: "Khuyến mãi lớn cuối năm" },
  { name: "Giáng sinh", date: "12-25", description: "Noel - gói quà & combo đặc biệt" },
  { name: "Tất niên", date: "12-31", description: "Cuối năm - cảm ơn khách hàng" },
];

export async function GET() {
  try {
    let holidays = await prisma.holidayEvent.findMany({ orderBy: { date: "asc" } });

    if (holidays.length === 0) {
      await prisma.holidayEvent.createMany({
        data: DEFAULT_HOLIDAYS.map((h) => ({ ...h, isVietnamese: true, isActive: true })),
      });
      holidays = await prisma.holidayEvent.findMany({ orderBy: { date: "asc" } });
    }

    type Holiday = { id: string; name: string; date: string; description: string | null; isActive: boolean; isVietnamese: boolean };
    const now = new Date();
    const upcoming = (holidays as Holiday[])
      .filter((h) => h.isActive)
      .map((h) => {
        const [month, day] = h.date.split("-").map(Number);
        let eventDate = new Date(now.getFullYear(), month - 1, day);
        if (eventDate < now) eventDate = new Date(now.getFullYear() + 1, month - 1, day);
        const daysUntil = Math.ceil((eventDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return { ...h, daysUntil, eventDate: eventDate.toISOString() };
      })
      .sort((a, b) => a.daysUntil - b.daysUntil);

    return NextResponse.json({ data: upcoming, success: true });
  } catch {
    return NextResponse.json({ error: "Lỗi khi tải dữ liệu", success: false }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { action, holidayId, name, date, description } = await req.json();

    if (action === "generate-content") {
      const holiday = await prisma.holidayEvent.findUnique({ where: { id: holidayId } });
      if (!holiday) return NextResponse.json({ error: "Không tìm thấy sự kiện", success: false }, { status: 404 });

      const brandContext = await getBrandContext();
      const systemPrompt = `Bạn là chuyên gia viết content marketing cho spa.
${brandContext ? `Thông tin spa:\n${brandContext}` : ""}
Viết bằng tiếng Việt, thân thiện, có cảm xúc, phù hợp dịp lễ.`;

      const prompt = `Viết 3 bài đăng Facebook cho spa nhân dịp ${holiday.name} (${holiday.description}).
Mỗi bài có: nội dung + 5-8 hashtag phù hợp.
Format:
BÀI 1:
[nội dung]
HASHTAG: [hashtag1] [hashtag2]...

BÀI 2:
...`;

      const result = await generateContent(prompt, systemPrompt);
      return NextResponse.json({ data: { content: result, holiday: holiday.name }, success: true });
    }

    if (action === "add") {
      const event = await prisma.holidayEvent.create({ data: { name, date, description } });
      return NextResponse.json({ data: event, success: true });
    }

    if (action === "toggle") {
      const event = await prisma.holidayEvent.findUnique({ where: { id: holidayId } });
      if (!event) return NextResponse.json({ error: "Không tìm thấy", success: false }, { status: 404 });
      const updated = await prisma.holidayEvent.update({ where: { id: holidayId }, data: { isActive: !event.isActive } });
      return NextResponse.json({ data: updated, success: true });
    }

    return NextResponse.json({ error: "Action không hợp lệ", success: false }, { status: 400 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Lỗi không xác định";
    return NextResponse.json({ error: msg, success: false }, { status: 500 });
  }
}
