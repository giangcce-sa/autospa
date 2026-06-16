import { buildBackupGzip } from "@/lib/backup";
import { NextResponse } from "next/server";

export async function GET() {
  try {
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
    const msg = err instanceof Error ? err.message : "Lỗi";
    return NextResponse.json({ error: msg, success: false }, { status: 500 });
  }
}
