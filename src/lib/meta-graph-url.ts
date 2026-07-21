export function sanitizeMetaPagingUrl(value: string | undefined) {
  if (!value) return null;
  const url = new URL(value);
  if (url.protocol !== "https:" || url.hostname !== "graph.facebook.com") {
    throw new Error("Meta paging URL không hợp lệ");
  }
  url.searchParams.delete("access_token");
  return url.toString();
}
