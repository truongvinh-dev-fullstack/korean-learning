"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { adminRequest, AdminApiError, apiFieldErrors, type FieldErrors } from "@/modules/admin/admin.client";

export function useAdminCollection<T>(initial: T[], listUrl: string, refreshServer = false) {
  const router = useRouter();
  const [collection, setCollection] = useState({ source: initial, items: initial });
  // Reconcile a refreshed server snapshot before rendering its children.
  if (collection.source !== initial) setCollection({ source: initial, items: initial });
  const items = collection.source === initial ? collection.items : initial;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const running = useRef(false);
  async function refresh() {
    const nextItems = await adminRequest<T[]>(listUrl);
    if (!Array.isArray(nextItems)) throw new AdminApiError("Danh sách trả về không hợp lệ.");
    setCollection((current) => ({ ...current, items: nextItems }));
    if (refreshServer) router.refresh();
  }
  async function mutate(url: string, method: string, payload?: unknown) {
    if (running.current) return false;
    running.current = true; setBusy(true); setError(null); setMessage(null); setErrors({});
    try {
      await adminRequest(url, method, payload);
      setMessage("Đã lưu thay đổi.");
      try { await refresh(); } catch { setError("Đã lưu thay đổi nhưng chưa tải lại được danh sách. Nhấn Tải lại."); }
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể lưu thay đổi.");
      if (cause instanceof AdminApiError) setErrors(apiFieldErrors(cause.details));
      return false;
    } finally { running.current = false; setBusy(false); }
  }
  async function reload() {
    if (running.current) return;
    running.current = true;
    setBusy(true); setError(null);
    try { await refresh(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể tải danh sách."); }
    finally { running.current = false; setBusy(false); }
  }
  function resetFeedback() { setError(null); setErrors({}); setMessage(null); }
  return { items, busy, error, message, errors, setError, setErrors, resetFeedback, mutate, reload };
}
