import "server-only";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export class AccessError extends Error {
  constructor(message: string, public readonly status = 403) {
    super(message);
  }
}

export async function requireUser(options: { owner?: boolean } = {}) {
  const session = await auth();
  if (!session?.user) throw new AccessError("Chưa đăng nhập", 401);
  const user = session.user as { id?: string; role?: string; email?: string | null; name?: string | null };
  if (options.owner && user.role !== "owner") {
    throw new AccessError("Tài khoản không có quyền thực hiện chức năng này", 403);
  }
  return user;
}

export async function requirePageAccess(facebookPageId: string | null | undefined, options: { owner?: boolean } = {}) {
  const user = await requireUser(options);
  if (!facebookPageId) {
    if (user.role !== "owner") throw new AccessError("Hãy chọn Trang Facebook được cấp quyền", 403);
    return { user, page: null };
  }

  const page = await prisma.facebookPage.findUnique({
    where: { id: facebookPageId },
    select: { id: true, pageName: true, isActive: true },
  });
  if (!page) throw new AccessError("Không tìm thấy Facebook Page", 404);
  if (!page.isActive && user.role !== "owner") throw new AccessError("Trang Facebook này đang tạm ngưng", 403);
  if (user.role !== "owner") {
    if (!user.id) throw new AccessError("Phiên đăng nhập thiếu định danh người dùng", 401);
    const access = await prisma.userPageAccess.findUnique({
      where: { userId_facebookPageId: { userId: user.id, facebookPageId } },
      select: { permission: true },
    });
    if (!access) throw new AccessError("Tài khoản không có quyền truy cập Facebook Page này", 403);
  }
  return { user, page };
}

export function accessErrorResponse(error: unknown) {
  if (error instanceof AccessError) {
    return Response.json({ success: false, error: error.message }, { status: error.status });
  }
  return null;
}
