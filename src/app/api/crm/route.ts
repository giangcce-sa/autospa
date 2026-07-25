import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { accessErrorResponse, requireUser } from "@/lib/page-access";

export async function GET(req: NextRequest) {
  try {
    await requireUser();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (id) {
      const customer = await prisma.customer.findUnique({
        where: { id },
        include: { notes: { orderBy: { createdAt: "desc" } }, appointments: { orderBy: { createdAt: "desc" }, take: 5 }, messages: { orderBy: { createdAt: "desc" }, take: 5 }, careMessages: { orderBy: { createdAt: "desc" }, take: 5 } },
      });
      return NextResponse.json({ data: customer });
    }

    const segment = searchParams.get("segment");
    const where = segment ? { segment } : {};
    const customers = await prisma.customer.findMany({ where, orderBy: { updatedAt: "desc" } });
    const stats = {
      total: await prisma.customer.count(),
      new: await prisma.customer.count({ where: { segment: "new" } }),
      regular: await prisma.customer.count({ where: { segment: "regular" } }),
      vip: await prisma.customer.count({ where: { segment: "vip" } }),
    };
    return NextResponse.json({ data: { customers, stats } });
  } catch (e) {
    const access = accessErrorResponse(e);
    if (access) return access;
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireUser({ owner: true });
    const body = await req.json();
    const { action } = body;

    if (action === "add-note") {
      const note = await prisma.customerNote.create({
        data: { customerId: body.customerId, content: body.content, type: body.type ?? "note" },
      });
      return NextResponse.json({ data: note });
    }

    const { id, ...data } = body;
    delete data.action;
    if (id) {
      const customer = await prisma.customer.update({ where: { id }, data: { ...data, updatedAt: new Date() } });
      return NextResponse.json({ data: customer });
    }

    const customer = await prisma.customer.create({ data });
    return NextResponse.json({ data: customer });
  } catch (e) {
    const access = accessErrorResponse(e);
    if (access) return access;
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await requireUser({ owner: true });
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (id) await prisma.customer.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    const access = accessErrorResponse(e);
    if (access) return access;
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
