import { prisma } from "@/lib/db";

export interface BehaviorInsights {
  peakHours: { hour: number; label: string; count: number }[];
  popularServices: { service: string; count: number; revenue: number }[];
  peakDays: { day: number; label: string; count: number }[];
  peakMonth: { month: number; label: string; count: number }[];
  bestPostingHour: number | null;
  topServiceForPromo: string | null;
}

const DAY_NAMES = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
const MONTH_NAMES = ["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8", "T9", "T10", "T11", "T12"];

// Runs nightly — mine BookingRevenue for behavior patterns
export async function learnCustomerBehavior(): Promise<{ updated: number; insights: string[] }> {
  const insights: string[] = [];

  const bookings = await prisma.bookingRevenue.findMany({
    where: { paidAt: { gte: new Date(Date.now() - 180 * 86400000) } },
    select: { paidAt: true, service: true, amount: true },
    orderBy: { paidAt: "asc" },
    take: 5000,
  });

  if (bookings.length === 0) return { updated: 0, insights: ["Chưa có dữ liệu booking"] };

  // ── Hour analysis (using date as proxy — spa bookings reflect actual visit time)
  const hourMap: Record<number, number> = {};
  const dayMap: Record<number, number> = {};
  const monthMap: Record<number, number> = {};
  const serviceRevMap: Record<string, { count: number; revenue: number }> = {};

  for (const b of bookings) {
    const d = new Date(b.paidAt);
    const hour = d.getHours();
    const day = d.getDay();
    const month = d.getMonth() + 1;
    const svc = b.service || "Dịch vụ khác";

    hourMap[hour] = (hourMap[hour] ?? 0) + 1;
    dayMap[day] = (dayMap[day] ?? 0) + 1;
    monthMap[month] = (monthMap[month] ?? 0) + 1;

    if (!serviceRevMap[svc]) serviceRevMap[svc] = { count: 0, revenue: 0 };
    serviceRevMap[svc].count += 1;
    serviceRevMap[svc].revenue += b.amount ?? 0;
  }

  // Persist patterns
  const upserts: Promise<unknown>[] = [];

  // Peak hours
  for (const [hour, count] of Object.entries(hourMap)) {
    upserts.push(
      prisma.bookingPattern.upsert({
        where: { patternType_key: { patternType: "peak_hour", key: `hour_${hour}` } },
        update: { value: count, label: `${hour}:00` },
        create: { patternType: "peak_hour", key: `hour_${hour}`, value: count, label: `${hour}:00` },
      })
    );
  }

  // Peak days
  for (const [day, count] of Object.entries(dayMap)) {
    upserts.push(
      prisma.bookingPattern.upsert({
        where: { patternType_key: { patternType: "peak_day", key: `day_${day}` } },
        update: { value: count, label: DAY_NAMES[parseInt(day)] },
        create: { patternType: "peak_day", key: `day_${day}`, value: count, label: DAY_NAMES[parseInt(day)] },
      })
    );
  }

  // Seasonal months
  for (const [month, count] of Object.entries(monthMap)) {
    upserts.push(
      prisma.bookingPattern.upsert({
        where: { patternType_key: { patternType: "seasonal", key: `month_${month}` } },
        update: { value: count, label: MONTH_NAMES[parseInt(month) - 1] },
        create: { patternType: "seasonal", key: `month_${month}`, value: count, label: MONTH_NAMES[parseInt(month) - 1] },
      })
    );
  }

  // Popular services
  for (const [service, data] of Object.entries(serviceRevMap)) {
    const key = service.toLowerCase().replace(/\s+/g, "_").slice(0, 40);
    upserts.push(
      prisma.bookingPattern.upsert({
        where: { patternType_key: { patternType: "popular_service", key } },
        update: { value: data.count, label: service },
        create: { patternType: "popular_service", key, value: data.count, label: service },
      })
    );
  }

  await Promise.all(upserts);

  // Build insights
  const peakHour = Object.entries(hourMap).sort((a, b) => b[1] - a[1])[0];
  if (peakHour) insights.push(`Giờ cao điểm: ${peakHour[0]}:00 (${peakHour[1]} booking)`);

  const peakDay = Object.entries(dayMap).sort((a, b) => b[1] - a[1])[0];
  if (peakDay) insights.push(`Ngày cao điểm: ${DAY_NAMES[parseInt(peakDay[0])]}`);

  const topService = Object.entries(serviceRevMap).sort((a, b) => b[1].revenue - a[1].revenue)[0];
  if (topService) insights.push(`Dịch vụ doanh thu cao nhất: ${topService[0]}`);

  await prisma.learningInsight.create({
    data: {
      loop: "behavior",
      insight: insights.join(" · "),
      confidence: Math.min(bookings.length / 200, 1),
      appliedTo: "content-scheduler, flash-deal",
    },
  });

  return { updated: upserts.length, insights };
}

// Returns behavior context for use in scheduling and content suggestions
export async function getBehaviorInsights(): Promise<BehaviorInsights> {
  const patterns = await prisma.bookingPattern.findMany();

  const peakHours = patterns
    .filter((p) => p.patternType === "peak_hour")
    .sort((a, b) => b.value - a.value)
    .slice(0, 5)
    .map((p) => ({ hour: parseInt(p.key.replace("hour_", "")), label: p.label ?? p.key, count: p.value }));

  const popularServices = patterns
    .filter((p) => p.patternType === "popular_service")
    .sort((a, b) => b.value - a.value)
    .slice(0, 5)
    .map((p) => ({ service: p.label ?? p.key, count: p.value, revenue: 0 }));

  const peakDays = patterns
    .filter((p) => p.patternType === "peak_day")
    .sort((a, b) => b.value - a.value)
    .slice(0, 3)
    .map((p) => ({ day: parseInt(p.key.replace("day_", "")), label: p.label ?? p.key, count: p.value }));

  const peakMonth = patterns
    .filter((p) => p.patternType === "seasonal")
    .sort((a, b) => b.value - a.value)
    .slice(0, 3)
    .map((p) => ({ month: parseInt(p.key.replace("month_", "")), label: p.label ?? p.key, count: p.value }));

  return {
    peakHours,
    popularServices,
    peakDays,
    peakMonth,
    bestPostingHour: peakHours[0]?.hour ?? null,
    topServiceForPromo: popularServices[0]?.service ?? null,
  };
}
