import { prisma } from "@/lib/db";
import { hashPassword, hasAnyUser } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    // Only allow bootstrap when no user exists
    const exists = await hasAnyUser();
    if (exists) {
      return NextResponse.json({ error: "Đã có tài khoản — không thể bootstrap lại", success: false }, { status: 403 });
    }

    const body = await req.json();
    const { name, email, password } = body;

    if (!email?.trim() || !password) {
      return NextResponse.json({ error: "Email và mật khẩu bắt buộc", success: false }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: "Mật khẩu tối thiểu 6 ký tự", success: false }, { status: 400 });
    }

    const hashed = await hashPassword(password);
    const user = await prisma.user.create({
      data: {
        email: email.trim().toLowerCase(),
        name: name?.trim() || null,
        hashedPwd: hashed,
        role: "owner",
      },
    });

    return NextResponse.json({ data: { id: user.id, email: user.email }, success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Lỗi";
    return NextResponse.json({ error: msg, success: false }, { status: 500 });
  }
}
