"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="vi">
      <head><title>AutoSpa — Lỗi hệ thống</title></head>
      <body style={{ margin: 0, background: "#f4f5f1", color: "#171b16", fontFamily: "system-ui, sans-serif" }}>
        <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: "24px" }}>
          <section style={{ width: "min(100%, 560px)", border: "1px solid #dde2d9", borderRadius: "12px", background: "#fff", padding: "40px", textAlign: "center" }}>
            <p style={{ margin: 0, color: "#2f6f54", fontSize: "13px", fontWeight: 700 }}>AutoSpa</p>
            <h1 style={{ margin: "10px 0 0", fontSize: "28px" }}>Không thể khởi động giao diện</h1>
            <p style={{ margin: "12px auto 0", maxWidth: "420px", color: "#525b50", fontSize: "14px", lineHeight: 1.6 }}>Hệ thống gặp lỗi tạm thời. Hãy thử tải lại; nếu lỗi tiếp tục xảy ra, cung cấp mã lỗi cho người quản trị.</p>
            {error.digest && <p style={{ margin: "12px 0 0", color: "#788174", fontSize: "12px" }}>Mã lỗi: {error.digest}</p>}
            <button type="button" onClick={() => unstable_retry()} style={{ marginTop: "24px", minHeight: "44px", border: 0, borderRadius: "8px", background: "#2f6f54", color: "#fff", padding: "0 20px", fontSize: "14px", fontWeight: 700, cursor: "pointer" }}>Thử lại</button>
          </section>
        </main>
      </body>
    </html>
  );
}
