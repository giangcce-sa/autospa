"use client";

import { useState } from "react";
import { HardDrives, ImageSquare } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { UnsavedChangesGuard } from "@/components/workspace/UnsavedChangesGuard";
import type { ImageSettingsDto } from "@/lib/settings/providers-policy";

export function ImageSettingsForm({ initialSettings }: { initialSettings: ImageSettingsDto }) {
  const [baseline, setBaseline] = useState(initialSettings.imageModel);
  const [imageModel, setImageModel] = useState(initialSettings.imageModel);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const dirty = imageModel !== baseline;

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/settings/images", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageModel }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        setMessage({ type: "error", text: result.error ?? "Không thể lưu cấu hình hình ảnh" });
        return;
      }
      setImageModel(result.data.imageModel);
      setBaseline(result.data.imageModel);
      setMessage({ type: "success", text: "Đã lưu cấu hình hình ảnh." });
    } catch {
      setMessage({ type: "error", text: "Không thể kết nối máy chủ." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-4">
      <UnsavedChangesGuard active={dirty} />
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2"><ImageSquare size={17} className="text-[var(--accent)]" aria-hidden="true" /><CardTitle>Model tạo ảnh</CardTitle></div>
        </CardHeader>
        <Input label="Model" value={imageModel} onChange={(event) => { setImageModel(event.target.value); setMessage(null); }} hint="dall-e-3, dall-e-2 hoặc model image-edit của AI Gateway." />
      </Card>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2"><HardDrives size={17} className="text-[var(--accent)]" aria-hidden="true" /><CardTitle>Lưu trữ media</CardTitle></div>
          <Badge variant={initialSettings.storage.configured ? "success" : "danger"}>{initialSettings.storage.configured ? "Sẵn sàng" : "Thiếu cấu hình"}</Badge>
        </CardHeader>
        <p className="text-sm text-[var(--text-secondary)]">Provider: <strong>{initialSettings.storage.provider === "s3" ? "S3" : "Local volume"}</strong> · deployment <strong>{initialSettings.storage.deploymentMode}</strong></p>
        <p className="mt-2 text-xs leading-5 text-[var(--text-muted)]">{initialSettings.storage.blocker ?? "Cấu hình storage phù hợp với độ bền filesystem của deployment; trạng thái này không phải kiểm tra kết nối provider."}</p>
        <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">Nguồn cấu hình: deployment ({initialSettings.storage.deploymentModeSource}). Thay đổi storage cần cập nhật biến môi trường và restart.</p>
      </Card>
      {message ? <p role={message.type === "error" ? "alert" : "status"} className={`text-sm ${message.type === "success" ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>{message.text}</p> : null}
      <Button onClick={save} loading={saving} disabled={!dirty}>Lưu cấu hình hình ảnh</Button>
    </div>
  );
}
