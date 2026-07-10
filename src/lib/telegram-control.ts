const WEEKDAYS: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
};

export function vietnamClock(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Ho_Chi_Minh",
    weekday: "short",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return { day: WEEKDAYS[values.weekday], hour: Number(values.hour) };
}

export function isTelegramActorAllowed(input: {
  configuredChatId: string;
  configuredAdminUserId?: string | null;
  chatId: string;
  senderId: string;
}) {
  if (input.chatId !== input.configuredChatId) return false;
  const expectedSender = input.configuredAdminUserId
    || (input.configuredChatId.startsWith("-") ? "" : input.configuredChatId);
  return Boolean(expectedSender) && input.senderId === expectedSender;
}

export function splitTelegramText(text: string, maxLength = 3_900) {
  if (text.length <= maxLength) return [text];
  const chunks: string[] = [];
  let current = "";
  for (const line of text.split("\n")) {
    if (current && current.length + line.length + 1 > maxLength) {
      chunks.push(current);
      current = "";
    }
    if (line.length > maxLength) {
      if (current) chunks.push(current);
      for (let index = 0; index < line.length; index += maxLength) {
        chunks.push(line.slice(index, index + maxLength));
      }
    } else {
      current += `${current ? "\n" : ""}${line}`;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}
