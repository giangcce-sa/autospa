"use client";

import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import type { AutomationSettingsDto } from "@/lib/settings/automation-policy";
import { Gear, Globe, Robot } from "@phosphor-icons/react";

export interface AutomationSettingsFormValue extends Omit<AutomationSettingsDto, "hasWebhookVerifyToken"> {
  webhookVerifyToken: string;
}

export function AutomationSettingsFields({
  value,
  hasWebhookVerifyToken,
  disabled = false,
  onChange,
}: {
  value: AutomationSettingsFormValue;
  hasWebhookVerifyToken: boolean;
  disabled?: boolean;
  onChange: (value: AutomationSettingsFormValue) => void;
}) {
  const set = <K extends keyof AutomationSettingsFormValue>(key: K, next: AutomationSettingsFormValue[K]) => {
    onChange({ ...value, [key]: next });
  };

  return (
    <fieldset disabled={disabled} className="space-y-4 disabled:opacity-70">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Globe size={17} className="text-[#1877F2]" aria-hidden="true" />
            <CardTitle>Facebook Webhook</CardTitle>
          </div>
          <Badge variant={value.webhookMode === "auto" ? "success" : "neutral"}>
            {value.webhookMode === "auto" ? "Tự động" : "Thủ công"}
          </Badge>
        </CardHeader>
        <div className="space-y-4">
          <Select
            label="Chế độ nhận dữ liệu"
            value={value.webhookMode}
            onChange={(event) => set("webhookMode", event.target.value as AutomationSettingsFormValue["webhookMode"])}
          >
            <option value="manual">Thủ công — đồng bộ trong từng module</option>
            <option value="auto">Tự động — nhận qua Facebook Webhook</option>
          </Select>
          {value.webhookMode === "auto" ? (
            <>
              <Input
                label="Verify Token"
                type="password"
                value={value.webhookVerifyToken}
                onChange={(event) => set("webhookVerifyToken", event.target.value)}
                placeholder={hasWebhookVerifyToken ? "Để trống = giữ nguyên token cũ" : "Nhập token xác minh webhook"}
                hint="Token mới chỉ thay thế sau khi lưu; AutoSpa không trả lại token hiện tại."
              />
              <label className="flex min-h-11 items-start gap-3 rounded-md border border-[var(--border)] bg-[var(--bg-subtle)] p-3">
                <input
                  type="checkbox"
                  checked={value.autoReplyComments}
                  onChange={(event) => set("autoReplyComments", event.target.checked)}
                  className="mt-0.5 h-4 w-4"
                />
                <span>
                  <span className="block text-sm font-semibold text-[var(--text)]">Tự trả lời comment khớp quy tắc</span>
                  <span className="block text-xs text-[var(--text-muted)]">Chỉ áp dụng khi comment khớp rule đã cấu hình.</span>
                </span>
              </label>
              <label className="flex min-h-11 items-start gap-3 rounded-md border border-[var(--border)] bg-[var(--bg-subtle)] p-3">
                <input
                  type="checkbox"
                  checked={value.autoReplyMessages}
                  onChange={(event) => set("autoReplyMessages", event.target.checked)}
                  className="mt-0.5 h-4 w-4"
                />
                <span>
                  <span className="block text-sm font-semibold text-[var(--text)]">Cho phép AI fallback cho tin nhắn</span>
                  <span className="block text-xs text-[var(--text-muted)]">Message rules và Lead Agent vẫn có policy riêng.</span>
                </span>
              </label>
            </>
          ) : null}
        </div>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Robot size={17} className="text-[var(--accent)]" aria-hidden="true" />
            <CardTitle>Bàn giao lead</CardTitle>
          </div>
        </CardHeader>
        <div className="grid gap-4 md:grid-cols-2">
          <Select
            label="Cách xử lý sau khi qualify"
            value={value.leadHandoffMode}
            onChange={(event) => set("leadHandoffMode", event.target.value as AutomationSettingsFormValue["leadHandoffMode"])}
          >
            <option value="staff">Giao nhân viên</option>
            <option value="link">Gửi link đặt lịch</option>
            <option value="api">Đẩy sang phần mềm spa</option>
          </Select>
          <Input
            label="Zalo nhận approval và báo cáo"
            value={value.zaloApprovalRecipient}
            onChange={(event) => set("zaloApprovalRecipient", event.target.value)}
            placeholder="Zalo User ID"
          />
          {value.leadHandoffMode === "link" ? (
            <Input
              label="Link đặt lịch"
              type="url"
              value={value.leadHandoffLink}
              onChange={(event) => set("leadHandoffLink", event.target.value)}
              placeholder="https://yourspa.com/booking"
            />
          ) : null}
        </div>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Gear size={17} className="text-[var(--accent)]" aria-hidden="true" />
            <CardTitle>Mức độ tự động</CardTitle>
          </div>
          <Badge variant={value.automationLevel === "full" ? "success" : value.automationLevel === "semi" ? "info" : "neutral"}>
            {value.automationLevel === "full" ? "Hoàn toàn" : value.automationLevel === "semi" ? "Bán tự động" : "Có giám sát"}
          </Badge>
        </CardHeader>
        <Select
          label="Chế độ vận hành yêu cầu"
          value={value.automationLevel}
          onChange={(event) => set("automationLevel", event.target.value as AutomationSettingsFormValue["automationLevel"])}
          hint="Ads vẫn bị giới hạn bởi execution ceiling, emergency stop và allowlist của deployment."
        >
          <option value="supervised">Có giám sát — duyệt các quyết định quan trọng</option>
          <option value="semi">Bán tự động — hỏi trước thay đổi lớn</option>
          <option value="full">Hoàn toàn tự động — vẫn tuân thủ safety gate</option>
        </Select>
      </Card>
    </fieldset>
  );
}
