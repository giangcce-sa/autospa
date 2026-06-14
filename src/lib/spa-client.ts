import { prisma } from "./db";

async function getSpaCreds() {
  const settings = await prisma.settings.findFirst();
  if (!settings?.spaApiUrl) throw new Error("Chưa cấu hình Spa API URL trong Cài đặt");
  return { url: settings.spaApiUrl.replace(/\/$/, ""), key: settings.spaApiKey ?? "" };
}

async function fetchWithRetry(url: string, options: RequestInit, retries = 2): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } catch (err) {
    if (retries > 0) return fetchWithRetry(url, options, retries - 1);
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

export interface LeadData {
  name: string;
  phone?: string | null;
  service?: string | null;
  source: string;
  note?: string | null;
}

export async function pushLeadToSpa(lead: LeadData): Promise<{ bookingId?: string }> {
  const { url, key } = await getSpaCreds();
  const res = await fetchWithRetry(`${url}/leads`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify(lead),
  });
  if (!res.ok) throw new Error(`Spa API lỗi ${res.status}`);
  const data = await res.json();
  await prisma.spaSync.upsert({
    where: { id: "1" },
    update: { lastSyncAt: new Date(), lastError: null },
    create: { id: "1", lastSyncAt: new Date() },
  });
  return { bookingId: data.bookingId ?? data.id ?? undefined };
}

export async function pullSpaRevenue(): Promise<{ revenueToday: number; bookingCountToday: number }> {
  const { url, key } = await getSpaCreds();
  try {
    const res = await fetchWithRetry(`${url}/revenue/today`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!res.ok) throw new Error(`Spa API lỗi ${res.status}`);
    const data = await res.json();
    const result = {
      revenueToday: Number(data.revenue ?? data.revenueToday ?? 0),
      bookingCountToday: Number(data.bookings ?? data.bookingCount ?? 0),
    };
    await prisma.spaSync.upsert({
      where: { id: "1" },
      update: { ...result, lastSyncAt: new Date(), lastError: null },
      create: { id: "1", ...result, lastSyncAt: new Date() },
    });
    return result;
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    await prisma.spaSync.upsert({
      where: { id: "1" },
      update: { lastError: errMsg },
      create: { id: "1", lastError: errMsg },
    });
    throw err;
  }
}

export async function getSpaBookingLink(service?: string | null): Promise<string> {
  const settings = await prisma.settings.findFirst();
  if (settings?.leadHandoffLink) {
    return service
      ? `${settings.leadHandoffLink}?service=${encodeURIComponent(service)}`
      : settings.leadHandoffLink;
  }
  // Fallback: construct from spa API URL
  const { url } = await getSpaCreds();
  return service ? `${url}/booking?service=${encodeURIComponent(service)}` : `${url}/booking`;
}

export async function testSpaConnection(): Promise<{ success: boolean; message: string }> {
  try {
    const { url, key } = await getSpaCreds();
    const res = await fetchWithRetry(`${url}/health`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (res.ok) return { success: true, message: "Kết nối thành công!" };
    return { success: false, message: `Spa API trả về ${res.status}` };
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : String(err) };
  }
}
