import { buildBackupGzip } from "@/lib/backup";
import { requireUser } from "@/lib/page-access";
import { routeErrorResponse } from "@/lib/api-response";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    await requireUser({ owner: true });
    const { buffer, size, rowCount } = await buildBackupGzip();
    const filename = `autospa-backup-${new Date().toISOString().slice(0, 10)}.json.gz`;

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/gzip",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(size),
        "X-Backup-Rows": String(rowCount),
      },
    });
  } catch (err) {
    return routeErrorResponse(err, "Lỗi");
  }
}
