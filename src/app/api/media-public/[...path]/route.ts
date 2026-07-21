import { contentTypeForKey, readMedia, verifyMediaSignature } from "@/lib/media-storage";

export async function GET(request: Request, context: { params: Promise<{ path: string[] }> }) {
  try {
    const { path } = await context.params;
    const key = path.join("/");
    const params = new URL(request.url).searchParams;
    const expires = Number(params.get("expires"));
    const signature = params.get("sig") ?? "";
    if (!verifyMediaSignature(key, expires, signature)) {
      return Response.json({ error: "Media URL không hợp lệ hoặc đã hết hạn" }, { status: 403 });
    }
    const buffer = await readMedia(key);
    return new Response(buffer, {
      headers: {
        "Content-Type": contentTypeForKey(key),
        "Cache-Control": "public, max-age=300, no-transform",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return Response.json({ error: "Không tìm thấy ảnh" }, { status: 404 });
  }
}
