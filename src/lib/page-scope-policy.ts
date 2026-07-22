export function pageScopeMatches(
  recordPageId: string | null | undefined,
  targetPageId: string | null | undefined,
  options: { allowGlobalRecord?: boolean } = {},
) {
  if (!recordPageId) return options.allowGlobalRecord ?? false;
  return recordPageId === targetPageId;
}

export function resolvePostPageId(
  storedPageId: string | null | undefined,
  requestedPageId: string | null | undefined,
) {
  if (storedPageId && requestedPageId && storedPageId !== requestedPageId) return null;
  return storedPageId || requestedPageId || undefined;
}

export function getPublishStatus(
  results: Record<string, string | null>,
  requestedChannels: readonly string[],
) {
  const succeeded = (channel: string) => {
    const result = results[channel];
    return Boolean(result && !result.startsWith("error:"));
  };
  if (!succeeded("facebook")) return "publish_failed";
  return requestedChannels.every(succeeded) ? "published" : "partially_published";
}
