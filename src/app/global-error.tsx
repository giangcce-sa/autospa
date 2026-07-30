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
      <head>
        <title>AutoSpa — Lỗi hệ thống</title>
        <style>{`@media (prefers-color-scheme: dark){body{background:#14121f!important;color:#eceaf6!important}.global-card{background:#1c1930!important;border-color:#2a2740!important}.global-copy{color:#a6a3c0!important}.global-code{color:#6e6b8c!important}}`}</style>
      </head>
      <body style={{ margin: 0, background: "#f4f5fb", color: "#191c2b", fontFamily: "system-ui, sans-serif" }}>
        <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: "24px" }}>
          <section className="global-card" style={{ width: "min(100%, 560px)", border: "1px solid #ecedf4", borderRadius: "14px", background: "#fff", padding: "40px", textAlign: "center", boxShadow: "0 18px 48px rgba(24,28,45,.12)" }}>
            <p style={{ margin: 0, color: "#6c5ce7", fontSize: "13px", fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase" }}>AutoSpa</p>
            <h1 style={{ margin: "12px 0 0", fontSize: "28px", lineHeight: 1.2 }}>Không thể khởi động giao diện</h1>
            <p className="global-copy" style={{ margin: "12px auto 0", maxWidth: "420px", color: "#5c6274", fontSize: "14px", lineHeight: 1.6 }}>Hệ thống gặp lỗi tạm thời. Hãy thử tải lại; nếu lỗi tiếp tục xảy ra, cung cấp mã lỗi cho người quản trị.</p>
            {error.digest ? <p className="global-code" style={{ margin: "12px 0 0", color: "#9297ab", fontSize: "12px" }}>Mã lỗi: {error.digest}</p> : null}
            <button type="button" onClick={() => unstable_retry()} style={{ marginTop: "24px", minHeight: "44px", border: 0, borderRadius: "9px", background: "#6c5ce7", color: "#fff", padding: "0 20px", fontSize: "14px", fontWeight: 700, cursor: "pointer" }}>Thử lại</button>
          </section>
        </main>
      </body>
    </html>
  );
}
