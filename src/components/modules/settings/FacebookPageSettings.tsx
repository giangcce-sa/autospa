"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { FacebookLogo, FloppyDisk, PencilSimple, Plus, Spinner, Trash, X } from "@phosphor-icons/react";

export interface FacebookPageSettingsItem {
  id: string;
  fbPageId: string;
  pageName: string;
  isActive: boolean;
  adAccountId: string | null;
  accessTokenHint: string;
  adsReadiness: {
    status: string;
    error: string | null;
    checkedAt: string | Date | null;
    tokenExpiresAt: string | Date | null;
    dataAccessExpiresAt: string | Date | null;
    missingPermissions: string[];
    accountStatus: number | null;
    currency: string | null;
    timezone: string | null;
  };
}

type TestState = { status: "idle" | "loading" | "ok" | "fail"; message: string };
const idleTest = (): TestState => ({ status: "idle", message: "" });

export function FacebookPageSettings({ initialPages }: { initialPages?: FacebookPageSettingsItem[] }) {
  const [pages, setPages] = useState(initialPages ?? []);
  const [loading, setLoading] = useState(initialPages === undefined);
  const [newPage, setNewPage] = useState({ fbPageId: "", pageName: "", accessToken: "", adAccountId: "" });
  const [test, setTest] = useState<TestState>(idleTest);
  const [adding, setAdding] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingPage, setEditingPage] = useState<string | null>(null);
  const [editValue, setEditValue] = useState({ pageName: "", accessToken: "", adAccountId: "" });
  const [savingEdit, setSavingEdit] = useState(false);
  const [checkingReadiness, setCheckingReadiness] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/facebook-pages");
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error ?? "Không thể tải Facebook Pages");
      setPages(result.data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể tải Facebook Pages");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialPages === undefined) void load();
  }, [initialPages]);

  const mutate = async (body: Record<string, unknown>) => {
    setError("");
    const response = await fetch("/api/facebook-pages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = await response.json();
    if (!response.ok || !result.success) throw new Error(result.error ?? result.message ?? "Không thể cập nhật Facebook Page");
    return result;
  };

  const testConnection = async () => {
    setTest({ status: "loading", message: "" });
    try {
      const result = await mutate({ action: "test", fbPageId: newPage.fbPageId, accessToken: newPage.accessToken });
      setTest({ status: "ok", message: result.message });
      if (result.pageName && !newPage.pageName) setNewPage((current) => ({ ...current, pageName: result.pageName }));
    } catch (cause) {
      setTest({ status: "fail", message: cause instanceof Error ? cause.message : "Lỗi kết nối" });
    }
  };

  const addPage = async () => {
    setAdding(true);
    try {
      await mutate({ action: "add", ...newPage });
      setNewPage({ fbPageId: "", pageName: "", accessToken: "", adAccountId: "" });
      setTest(idleTest());
      setShowAddForm(false);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể thêm Page");
    } finally {
      setAdding(false);
    }
  };

  const togglePage = async (id: string) => {
    try {
      await mutate({ action: "toggle", id });
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể cập nhật Page");
    }
  };

  const deletePage = async (id: string) => {
    if (!window.confirm("Xóa Facebook Page này khỏi AutoSpa?")) return;
    setError("");
    const response = await fetch(`/api/facebook-pages?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    const result = await response.json();
    if (!response.ok || !result.success) {
      setError(result.error ?? "Không thể xóa Page");
      return;
    }
    await load();
  };

  const checkAdsReadiness = async (id: string) => {
    setCheckingReadiness(id);
    try {
      await mutate({ action: "check-ads-readiness", id });
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể kiểm tra Ads");
    } finally {
      setCheckingReadiness(null);
    }
  };

  const openEdit = (page: FacebookPageSettingsItem) => {
    setEditingPage(page.id);
    setEditValue({ pageName: page.pageName, accessToken: "", adAccountId: page.adAccountId ?? "" });
  };

  const saveEdit = async () => {
    if (!editingPage) return;
    setSavingEdit(true);
    try {
      await mutate({ action: "update", id: editingPage, ...editValue });
      setEditingPage(null);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể lưu Page");
    } finally {
      setSavingEdit(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <FacebookLogo size={16} className="text-[#1877F2]" aria-hidden="true" />
          <CardTitle>Facebook Pages</CardTitle>
          <Badge variant="neutral">{pages.length} page</Badge>
        </div>
        <Button size="sm" variant="secondary" onClick={() => { setShowAddForm((current) => !current); setTest(idleTest()); }}>
          <Plus size={12} aria-hidden="true" /> Thêm page
        </Button>
      </CardHeader>

      {loading ? <div className="skeleton h-14 rounded-xl" /> : null}
      {!loading && pages.length ? (
        <div className="mb-3 space-y-2">
          {pages.map((page) => {
            const isEditing = editingPage === page.id;
            return (
              <div key={page.id} className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg-subtle)]">
                <div className="flex flex-col justify-between gap-3 px-3 py-2 lg:flex-row lg:items-center">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-medium text-[var(--text)]">{page.pageName}</p>
                      <Badge variant={page.isActive ? "success" : "neutral"}>{page.isActive ? "Bật" : "Tắt"}</Badge>
                      {page.adAccountId ? (
                        <Badge variant={page.adsReadiness.status === "ready" ? "success" : page.adsReadiness.status === "blocked" ? "danger" : "info"}>
                          {page.adsReadiness.status === "ready" ? "Ads sẵn sàng" : page.adsReadiness.status === "blocked" ? "Ads bị khóa" : "Ads chưa kiểm tra"}
                        </Badge>
                      ) : null}
                    </div>
                    <p className="text-[10px] font-mono text-[var(--text-muted)]">ID: {page.fbPageId} · Token: {page.accessTokenHint}</p>
                    {page.adAccountId ? (
                      <p className={`mt-1 text-[10px] ${page.adsReadiness.status === "ready" ? "text-[var(--success)]" : "text-[var(--warning)]"}`}>
                        {page.adsReadiness.status === "ready"
                          ? `Ad Account ${page.adAccountId} · ${page.adsReadiness.currency ?? "—"} · ${page.adsReadiness.timezone ?? "—"}`
                          : page.adsReadiness.error ?? "Cần chạy kiểm tra readiness trước khi Ads write."}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {page.adAccountId ? <Button size="sm" variant="secondary" loading={checkingReadiness === page.id} onClick={() => checkAdsReadiness(page.id)}>Kiểm tra Ads</Button> : null}
                    <Button size="sm" variant="secondary" onClick={() => isEditing ? setEditingPage(null) : openEdit(page)}>
                      {isEditing ? <X size={11} aria-hidden="true" /> : <PencilSimple size={11} aria-hidden="true" />}{isEditing ? "Hủy" : "Sửa"}
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => togglePage(page.id)}>{page.isActive ? "Tắt" : "Bật"}</Button>
                    <Button size="sm" variant="danger" aria-label={`Xóa ${page.pageName}`} onClick={() => deletePage(page.id)}><Trash size={11} aria-hidden="true" /></Button>
                  </div>
                </div>
                {isEditing ? (
                  <div className="space-y-2 border-t border-[var(--border)] px-3 pb-3 pt-2">
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Input label="Tên Page" value={editValue.pageName} onChange={(event) => setEditValue((current) => ({ ...current, pageName: event.target.value }))} />
                      <Input label="Ad Account ID" placeholder="act_XXXXXXXXX" value={editValue.adAccountId} onChange={(event) => setEditValue((current) => ({ ...current, adAccountId: event.target.value }))} />
                    </div>
                    <Input label="Access Token mới" type="password" placeholder="Để trống = giữ token cũ" value={editValue.accessToken} onChange={(event) => setEditValue((current) => ({ ...current, accessToken: event.target.value }))} />
                    <Button size="sm" loading={savingEdit} onClick={saveEdit}><FloppyDisk size={11} aria-hidden="true" /> Lưu thay đổi</Button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}

      {!loading && !pages.length && !showAddForm ? <p className="py-3 text-center text-xs text-[var(--text-muted)]">Chưa có page nào.</p> : null}
      {showAddForm ? (
        <div className="space-y-3 border-t border-[var(--border)] pt-3">
          <p className="text-xs font-medium text-[var(--text-secondary)]">Thêm Facebook Page mới</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="Page ID" value={newPage.fbPageId} onChange={(event) => setNewPage((current) => ({ ...current, fbPageId: event.target.value }))} />
            <Input label="Tên Page" value={newPage.pageName} onChange={(event) => setNewPage((current) => ({ ...current, pageName: event.target.value }))} />
          </div>
          <Input label="Page Access Token" type="password" value={newPage.accessToken} onChange={(event) => setNewPage((current) => ({ ...current, accessToken: event.target.value }))} />
          <Input label="Ad Account ID (tùy chọn)" value={newPage.adAccountId} onChange={(event) => setNewPage((current) => ({ ...current, adAccountId: event.target.value }))} />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" loading={test.status === "loading"} onClick={testConnection}>Test kết nối</Button>
            <Button size="sm" loading={adding} onClick={addPage} disabled={!newPage.fbPageId || !newPage.pageName || !newPage.accessToken}><Plus size={11} aria-hidden="true" /> Lưu page</Button>
          </div>
          {test.status !== "idle" ? <p role="status" className={`flex items-center gap-1 text-xs ${test.status === "ok" ? "text-[var(--success)]" : test.status === "fail" ? "text-[var(--danger)]" : "text-[var(--text-muted)]"}`}>{test.status === "loading" ? <Spinner size={12} className="animate-spin" aria-hidden="true" /> : null}{test.message || "Đang kiểm tra..."}</p> : null}
        </div>
      ) : null}
      {error ? <p role="alert" className="mt-2 text-xs text-[var(--danger)]">{error}</p> : null}
    </Card>
  );
}
