import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { checkAndIncrement } from "@/lib/rate-limiter";
import {
  bootstrapIpKey,
  BOOTSTRAP_IP_LIMIT,
  BOOTSTRAP_WINDOW_SEC,
  firstForwardedIp,
} from "@/lib/login-rate-policy";
import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const ip = firstForwardedIp(req.headers.get("x-forwarded-for"));
    const gate = await checkAndIncrement(bootstrapIpKey(ip), BOOTSTRAP_IP_LIMIT, BOOTSTRAP_WINDOW_SEC);
    if (!gate.allowed) {
      return NextResponse.json(
        { error: "Thử quá nhiều lần — thử lại sau", success: false },
        { status: 429, headers: { "Retry-After": String(gate.retryAfterSec) } }
      );
    }

    const body = await req.json();
    const { name, email, password } = body;

    if (!email?.trim() || !password) {
      return NextResponse.json({ error: "Email và mật khẩu bắt buộc", success: false }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: "Mật khẩu tối thiểu 8 ký tự", success: false }, { status: 400 });
    }

    const hashed = await hashPassword(password);

    // Count + create must be one serializable unit — two concurrent bootstraps
    // would otherwise both pass a standalone hasAnyUser() check.
    const user = await prisma.$transaction(async (tx) => {
      const count = await tx.user.count();
      if (count > 0) return null;
      return tx.user.create({
        data: {
          email: email.trim().toLowerCase(),
          name: name?.trim() || null,
          hashedPwd: hashed,
          role: "owner",
        },
      });
    }, { isolationLevel: "Serializable" });

    if (!user) {
      return NextResponse.json({ error: "Đã có tài khoản — không thể bootstrap lại", success: false }, { status: 403 });
    }

    return NextResponse.json({ data: { id: user.id, email: user.email }, success: true });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && (err.code === "P2034" || err.code === "P2002")) {
      return NextResponse.json({ error: "Đã có tài khoản — không thể bootstrap lại", success: false }, { status: 409 });
    }
    console.error("bootstrap failed:", err);
    return NextResponse.json({ error: "Không tạo được tài khoản", success: false }, { status: 500 });
  }
}
