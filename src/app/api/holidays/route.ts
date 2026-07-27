import { generateContent, getBrandContext } from "@/lib/claude";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/page-access";
import { routeErrorResponse } from "@/lib/api-response";
import { nextAnnualBusinessOccurrence } from "@/lib/today-policy";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const monthDaySchema = z.string().regex(/^\d{2}-\d{2}$/).refine((value) => {
  try {
    nextAnnualBusinessOccurrence(value, new Date("2024-01-01T00:00:00.000Z"));
    return true;
  } catch {
    return false;
  }
}, "Ngày không hợp lệ");

const requestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("generate-content"), holidayId: z.string().trim().min(1) }),
  z.object({ action: z.literal("toggle"), holidayId: z.string().trim().min(1) }),
  z.object({
    action: z.literal("add"),
    name: z.string().trim().min(1).max(200),
    date: monthDaySchema,
    description: z.string().trim().max(1_000).optional(),
  }),
]);

const variableHolidayNames = ["Tết Nguyên Đán", "Giỗ tổ Hùng Vương", "Tết Đoan Ngọ", "Trung Thu", "Black Friday"];

export async function GET() {
  try {
    await requireUser();
    const holidays = await prisma.holidayEvent.findMany({ orderBy: [{ isActive: "desc" }, { date: "asc" }] });
    const data = holidays.map((holiday) => {
      const occurrence = nextAnnualBusinessOccurrence(holiday.date);
      const configuredEstimate = variableHolidayNames.some((name) => holiday.name.toLowerCase().includes(name.toLowerCase()));
      return {
        ...holiday,
        daysUntil: occurrence.daysUntil,
        eventDate: occurrence.eventDate.toISOString(),
        configuredEstimate,
        occurrenceNote: configuredEstimate ? "Ngày cấu hình cố định; cần cập nhật theo từng năm" : null,
      };
    }).sort((left, right) => Number(right.isActive) - Number(left.isActive) || left.daysUntil - right.daysUntil);
    return NextResponse.json({ data, success: true });
  } catch (error) {
    return routeErrorResponse(error, "Lỗi khi tải dữ liệu");
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireUser({ owner: true });
    const body = requestSchema.parse(await req.json());

    if (body.action === "generate-content") {
      const holiday = await prisma.holidayEvent.findUnique({ where: { id: body.holidayId } });
      if (!holiday) return NextResponse.json({ error: "Không tìm thấy sự kiện", success: false }, { status: 404 });
      const brandContext = await getBrandContext();
      const systemPrompt = `Bạn là chuyên gia viết content marketing cho spa.
${brandContext ? `Thông tin spa:\n${brandContext}` : ""}
Viết bằng tiếng Việt, thân thiện, có cảm xúc, phù hợp dịp lễ.`;
      const prompt = `Viết 3 bài đăng Facebook cho spa nhân dịp ${holiday.name} (${holiday.description ?? ""}).
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

    if (body.action === "add") {
      const event = await prisma.holidayEvent.create({
        data: { name: body.name, date: body.date, description: body.description },
      });
      return NextResponse.json({ data: event, success: true });
    }

    const event = await prisma.holidayEvent.findUnique({ where: { id: body.holidayId } });
    if (!event) return NextResponse.json({ error: "Không tìm thấy", success: false }, { status: 404 });
    const updated = await prisma.holidayEvent.update({ where: { id: event.id }, data: { isActive: !event.isActive } });
    return NextResponse.json({ data: updated, success: true });
  } catch (error) {
    return routeErrorResponse(error, "Lỗi không xác định");
  }
}
