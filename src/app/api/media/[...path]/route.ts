import { requireMediaAccess } from "@/lib/media-access";
import { contentTypeForKey, readMedia } from "@/lib/media-storage";
import { accessErrorResponse } from "@/lib/page-access";

export async function GET(_request: Request, context: { params: Promise<{ path: string[] }> }) {
  try {
    const { path } = await context.params;
    const key = path.join("/");
    await requireMediaAccess(key);
    const buffer = await readMedia(key);
    return new Response(buffer, {
      headers: {
        "Content-Type": contentTypeForKey(key),
        "Cache-Control": "private, max-age=300",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    const access = accessErrorResponse(error);
    if (access) return access;
    return Response.json({ error: "Không tìm thấy ảnh" }, { status: 404 });
  }
}
