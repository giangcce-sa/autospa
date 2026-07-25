"use client";

import { useMemo, useState } from "react";
import { FilmSlate, Microphone, UserSound } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { UnsavedChangesGuard } from "@/components/workspace/UnsavedChangesGuard";
import type { VideoProviderId, VideoSettingsDto } from "@/lib/settings/video-policy";

type FormValue = VideoSettingsDto & {
  runwayApiKey: string;
  elevenLabsApiKey: string;
  syncLabsApiKey: string;
};

type TestState = { status: "idle" | "loading" | "success" | "error"; message: string };

const idleTest = (): TestState => ({ status: "idle", message: "" });

function formValue(settings: VideoSettingsDto): FormValue {
  return {
    ...settings,
    runwayApiKey: "",
    elevenLabsApiKey: "",
    syncLabsApiKey: "",
  };
}

const sourceLabel = {
  database: "Đã lưu trong AutoSpa",
  deployment: "Được cấp từ máy chủ",
  unconfigured: "Chưa cấu hình",
} as const;

export function VideoSettingsForm({ initialSettings }: { initialSettings: VideoSettingsDto }) {
  const [baseline, setBaseline] = useState(() => formValue(initialSettings));
  const [value, setValue] = useState(() => formValue(initialSettings));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [tests, setTests] = useState<Record<VideoProviderId, TestState>>({
    runway: idleTest(),
    elevenLabs: idleTest(),
    sync: idleTest(),
  });
  const dirty = useMemo(() => JSON.stringify(value) !== JSON.stringify(baseline), [baseline, value]);

  const save = async () => {
    if (baseline.videoMockMode && !value.videoMockMode && !window.confirm(
      "Chuyển sang chế độ thật có thể gọi dịch vụ bên ngoài và phát sinh chi phí. Tiếp tục?",
    )) return;

    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/settings/video", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          runwayBaseUrl: value.runwayBaseUrl,
          runwayVideoModel: value.runwayVideoModel,
          elevenLabsBaseUrl: value.elevenLabsBaseUrl,
          elevenLabsVoiceModel: value.elevenLabsVoiceModel,
          syncLabsBaseUrl: value.syncLabsBaseUrl,
          syncLabsModel: value.syncLabsModel,
          videoMockMode: value.videoMockMode,
          videoBudgetUsd: value.videoBudgetUsd,
          ...(value.runwayApiKey ? { runwayApiKey: value.runwayApiKey } : {}),
          ...(value.elevenLabsApiKey ? { elevenLabsApiKey: value.elevenLabsApiKey } : {}),
          ...(value.syncLabsApiKey ? { syncLabsApiKey: value.syncLabsApiKey } : {}),
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        setMessage({ type: "error", text: result.error ?? "Không thể lưu cấu hình video" });
        return;
      }
      const next = formValue(result.data);
      setValue(next);
      setBaseline(next);
      setTests({ runway: idleTest(), elevenLabs: idleTest(), sync: idleTest() });
      setMessage({ type: "success", text: "Đã lưu cấu hình Xưởng video." });
    } catch {
      setMessage({ type: "error", text: "Không thể kết nối máy chủ." });
    } finally {
      setSaving(false);
    }
  };

  const test = async (provider: VideoProviderId) => {
    setTests((current) => ({ ...current, [provider]: { status: "loading", message: "Đang kiểm tra..." } }));
    const request = provider === "runway"
      ? { provider, baseUrl: value.runwayBaseUrl, ...(value.runwayApiKey ? { apiKey: value.runwayApiKey } : {}) }
      : provider === "elevenLabs"
        ? { provider, baseUrl: value.elevenLabsBaseUrl, ...(value.elevenLabsApiKey ? { apiKey: value.elevenLabsApiKey } : {}) }
        : { provider, baseUrl: value.syncLabsBaseUrl, ...(value.syncLabsApiKey ? { apiKey: value.syncLabsApiKey } : {}) };
    try {
      const response = await fetch("/api/settings/video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });
      const result = await response.json();
      setTests((current) => ({
        ...current,
        [provider]: {
          status: response.ok && result.success ? "success" : "error",
          message: result.message ?? result.error ?? "Kiểm tra thất bại",
        },
      }));
    } catch {
      setTests((current) => ({ ...current, [provider]: { status: "error", message: "Không thể kết nối máy chủ" } }));
    }
  };

  return (
    <div className="max-w-4xl space-y-4">
      <UnsavedChangesGuard active={dirty} />
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2"><FilmSlate size={18} className="text-[var(--accent)]" aria-hidden="true" /><CardTitle>Chế độ vận hành</CardTitle></div>
          <Badge variant={value.videoMockMode ? "warning" : "success"}>{value.videoMockMode ? "Chế độ thử" : "Dịch vụ thật"}</Badge>
        </CardHeader>
        {value.executionPolicy.blocker ? (
          <p role="status" className="mb-4 rounded-md bg-[var(--amber-light)] px-3 py-2 text-xs font-semibold text-[var(--amber)]">
            {value.executionPolicy.blocker}. Chỉ deployment mới có thể nâng trần thực thi; Settings chỉ có thể giữ hoặc hạ về mock.
          </p>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-[1fr_14rem] sm:items-end">
          <div>
            <p className="text-sm font-semibold text-[var(--text)]">Gọi provider bên ngoài</p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">Chế độ thử tạo output mock và không thể xuất bản. Tắt chế độ thử mới gọi Runway, ElevenLabs và Sync Labs.</p>
          </div>
          <label className="flex min-h-11 items-center justify-between gap-3 rounded-md border px-3 text-sm font-semibold" style={{ borderColor: "var(--border)" }}>
            <span>Chế độ thử</span>
            <input type="checkbox" checked={value.videoMockMode} onChange={(event) => setValue((current) => ({ ...current, videoMockMode: event.target.checked }))} />
          </label>
          <div>
            <p className="text-sm font-semibold text-[var(--text)]">Ngân sách bảo vệ</p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">Tác vụ mới bị chặn khi tổng chi phí dự án vượt trần này.</p>
          </div>
          <Input label="USD / dự án" type="number" min={1} max={10000} value={value.videoBudgetUsd} onChange={(event) => setValue((current) => ({ ...current, videoBudgetUsd: Number(event.target.value) }))} />
        </div>
      </Card>

      <ProviderCard
        icon={<FilmSlate size={18} aria-hidden="true" />}
        title="Runway"
        purpose="Tạo video từ mô tả hoặc hình ảnh"
        configured={value.hasRunwayApiKey}
        source={sourceLabel[value.runwayKeySource]}
        apiKey={value.runwayApiKey}
        baseUrl={value.runwayBaseUrl}
        model={value.runwayVideoModel}
        test={tests.runway}
        onApiKey={(runwayApiKey) => setValue((current) => ({ ...current, runwayApiKey }))}
        onBaseUrl={(runwayBaseUrl) => setValue((current) => ({ ...current, runwayBaseUrl }))}
        onModel={(runwayVideoModel) => setValue((current) => ({ ...current, runwayVideoModel }))}
        onTest={() => test("runway")}
      />
      <ProviderCard
        icon={<Microphone size={18} aria-hidden="true" />}
        title="ElevenLabs"
        purpose="Tạo giọng đọc và sao chép giọng đã có consent"
        configured={value.hasElevenLabsApiKey}
        source={sourceLabel[value.elevenLabsKeySource]}
        apiKey={value.elevenLabsApiKey}
        baseUrl={value.elevenLabsBaseUrl}
        model={value.elevenLabsVoiceModel}
        test={tests.elevenLabs}
        onApiKey={(elevenLabsApiKey) => setValue((current) => ({ ...current, elevenLabsApiKey }))}
        onBaseUrl={(elevenLabsBaseUrl) => setValue((current) => ({ ...current, elevenLabsBaseUrl }))}
        onModel={(elevenLabsVoiceModel) => setValue((current) => ({ ...current, elevenLabsVoiceModel }))}
        onTest={() => test("elevenLabs")}
      />
      <ProviderCard
        icon={<UserSound size={18} aria-hidden="true" />}
        title="Sync Labs"
        purpose="Đồng bộ khẩu hình từ ảnh hoặc video"
        configured={value.hasSyncLabsApiKey}
        source={sourceLabel[value.syncLabsKeySource]}
        apiKey={value.syncLabsApiKey}
        baseUrl={value.syncLabsBaseUrl}
        model={value.syncLabsModel}
        test={tests.sync}
        onApiKey={(syncLabsApiKey) => setValue((current) => ({ ...current, syncLabsApiKey }))}
        onBaseUrl={(syncLabsBaseUrl) => setValue((current) => ({ ...current, syncLabsBaseUrl }))}
        onModel={(syncLabsModel) => setValue((current) => ({ ...current, syncLabsModel }))}
        onTest={() => test("sync")}
      />

      {message ? <p role={message.type === "error" ? "alert" : "status"} className={`text-sm ${message.type === "success" ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>{message.text}</p> : null}
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={save} loading={saving} disabled={!dirty}>Lưu cấu hình video</Button>
        {dirty ? <span className="text-xs font-semibold text-[var(--warning)]">Có thay đổi chưa lưu</span> : null}
      </div>
    </div>
  );
}

function ProviderCard({
  icon,
  title,
  purpose,
  configured,
  source,
  apiKey,
  baseUrl,
  model,
  test,
  onApiKey,
  onBaseUrl,
  onModel,
  onTest,
}: {
  icon: React.ReactNode;
  title: string;
  purpose: string;
  configured: boolean;
  source: string;
  apiKey: string;
  baseUrl: string;
  model: string;
  test: TestState;
  onApiKey: (value: string) => void;
  onBaseUrl: (value: string) => void;
  onModel: (value: string) => void;
  onTest: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2 text-[var(--accent)]">{icon}<CardTitle>{title}</CardTitle></div>
        <Badge variant={configured ? "success" : "neutral"}>{source}</Badge>
      </CardHeader>
      <p className="mb-4 text-xs text-[var(--text-muted)]">{purpose}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Khóa truy cập" type="password" value={apiKey} onChange={(event) => onApiKey(event.target.value)} placeholder={configured ? "Để trống = giữ khóa hiệu lực" : "Nhập khóa truy cập"} />
        <Input label="Mô hình" value={model} onChange={(event) => onModel(event.target.value)} />
        <div className="sm:col-span-2"><Input label="Địa chỉ dịch vụ" type="url" value={baseUrl} onChange={(event) => onBaseUrl(event.target.value)} hint="Gateway tùy chỉnh phải dùng HTTPS và nằm trong VIDEO_PROVIDER_ALLOWED_HOSTS." /></div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button variant="secondary" onClick={onTest} loading={test.status === "loading"}>Kiểm tra {title}</Button>
        {test.status !== "idle" ? <p role="status" className={`text-sm ${test.status === "success" ? "text-[var(--success)]" : test.status === "error" ? "text-[var(--danger)]" : "text-[var(--text-muted)]"}`}>{test.message}</p> : null}
      </div>
    </Card>
  );
}
