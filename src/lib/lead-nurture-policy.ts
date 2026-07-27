// Pure lead-nurture policy — no prisma, no server-only. Importable from node tests.

// Days to wait between nurture steps
export const STEP_DELAYS = [1, 3, 7];

export function buildMessage(step: number, name: string, service: string | null): string {
  const svc = service ?? "dịch vụ spa";
  const n = name && name !== "Khách Facebook" && name !== "Khách Zalo" ? name : "bạn";
  if (step === 0) {
    return `Xin chào ${n}! Spa muốn hỏi thăm xem bạn có muốn đặt lịch ${svc} không ạ? Mình sẵn sàng hỗ trợ bạn ngay 😊`;
  }
  if (step === 1) {
    return `Chào ${n}! Spa đang có ưu đãi đặc biệt cho dịch vụ ${svc} tuần này. Đặt lịch ngay để không bỏ lỡ nhé 🌟`;
  }
  return `Chào ${n}! Đây là tin nhắn cuối từ spa. Khi nào bạn cần ${svc} thì cứ nhắn mình, spa luôn sẵn sàng hỗ trợ 💜`;
}

export function isNurtureDue(
  lead: { nurtureStep: number; nurtureSentAt: Date | null; createdAt: Date },
  now: Date,
): boolean {
  const delay = STEP_DELAYS[lead.nurtureStep] ?? 7;
  const threshold = new Date(now.getTime() - delay * 24 * 60 * 60 * 1000);
  const lastContact = lead.nurtureSentAt ?? lead.createdAt;
  return !(lastContact > threshold);
}
