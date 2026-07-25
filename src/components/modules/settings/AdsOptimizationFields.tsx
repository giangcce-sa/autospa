"use client";

import { Gauge, Money, TrendUp } from "@phosphor-icons/react";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import type { AdsOptimizationSettings } from "@/lib/settings/ads-policy";

export function AdsOptimizationFields({
  value,
  disabled = false,
  onChange,
}: {
  value: AdsOptimizationSettings;
  disabled?: boolean;
  onChange: (value: AdsOptimizationSettings) => void;
}) {
  const set = (key: keyof AdsOptimizationSettings, next: number) => onChange({ ...value, [key]: next });

  return (
    <fieldset disabled={disabled} className="space-y-4 disabled:opacity-70">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2"><Gauge size={17} className="text-[var(--accent)]" aria-hidden="true" /><CardTitle>Ngưỡng đánh giá hiệu quả</CardTitle></div>
        </CardHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Tạm dừng khi CTR dưới (%)" type="number" step="0.1" min="0.1" max="10" value={value.adsOptimizePauseCtr} onChange={(event) => set("adsOptimizePauseCtr", Number(event.target.value))} hint="Chỉ đánh giá campaign đủ tuổi, impression và mức chi tối thiểu." />
          <Input label="Đề xuất scale khi CTR trên (%)" type="number" step="0.1" min="0.2" max="20" value={value.adsOptimizeScaleCtr} onChange={(event) => set("adsOptimizeScaleCtr", Number(event.target.value))} hint="Phải lớn hơn ngưỡng tạm dừng." />
          <Input label="Frequency cần làm mới creative" type="number" step="0.1" min="1" max="10" value={value.adsOptimizeFreqLimit} onChange={(event) => set("adsOptimizeFreqLimit", Number(event.target.value))} />
          <Input label="ROAS tối thiểu để scale" type="number" step="0.1" min="0.5" max="20" value={value.adsOptimizeMinRoas} onChange={(event) => set("adsOptimizeMinRoas", Number(event.target.value))} />
        </div>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2"><Money size={17} className="text-[var(--accent)]" aria-hidden="true" /><CardTitle>Giới hạn ngân sách VND</CardTitle></div>
        </CardHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Chi tiêu tối thiểu để đánh giá" type="number" step="50000" min="50000" max="100000000" value={value.adsOptimizeMinSpend} onChange={(event) => set("adsOptimizeMinSpend", Number(event.target.value))} />
          <Input label="Trần ngân sách mỗi ngày" type="number" step="100000" min="100000" max="1000000000" value={value.adsOptimizeMaxBudget} onChange={(event) => set("adsOptimizeMaxBudget", Number(event.target.value))} />
        </div>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2"><TrendUp size={17} className="text-[var(--accent)]" aria-hidden="true" /><CardTitle>Nhịp điều chỉnh</CardTitle></div>
        </CardHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Tăng ngân sách mỗi lần (%)" type="number" step="5" min="5" max="50" value={value.adsOptimizeScalePct} onChange={(event) => set("adsOptimizeScalePct", Number(event.target.value))} />
          <Input label="Thời gian chờ mỗi campaign (giờ)" type="number" step="1" min="4" max="168" value={value.adsOptimizeCooldownHrs} onChange={(event) => set("adsOptimizeCooldownHrs", Number(event.target.value))} />
        </div>
      </Card>
    </fieldset>
  );
}
