import { Suspense } from "react";
import { FacebookAdsManagerWrapper } from "./FacebookAdsManagerWrapper";

export default function FacebookAdsPage() {
  return (
    <div className="space-y-2">
      <div>
        <h1 className="text-xl font-bold" style={{ color: "var(--text)" }}>Quảng cáo Facebook</h1>
        <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
          Quản lý chiến dịch, tạo quảng cáo từ nội dung, xem insights — không cần rời autospa.
        </p>
      </div>
      <Suspense>
        <FacebookAdsManagerWrapper />
      </Suspense>
    </div>
  );
}
