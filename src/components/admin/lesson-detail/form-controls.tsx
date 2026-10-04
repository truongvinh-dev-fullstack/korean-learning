"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import type { FieldErrors } from "@/modules/admin/admin.client";
import { AudioUrlSchema } from "@/shared/validation/audio-url";

export const inputClass = "w-full min-w-0 rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-400";
export const buttonClass = "rounded-xl bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 disabled:opacity-40";
export const primaryClass = "rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-500 disabled:opacity-40";
export const sectionClass = "space-y-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-6";

export function Field({ label, value, onChange, path, errors = {}, multiline = false, type = "text", min, max }: {
  label: string; value?: string | number | null; onChange: (value: string) => void; path?: string;
  errors?: FieldErrors; multiline?: boolean; type?: string; min?: number; max?: number;
}) {
  const id = useId();
  const error = path ? errors[path] : undefined;
  const props = { id, value: value ?? "", onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(event.target.value),
    className: inputClass, "aria-invalid": !!error, "aria-describedby": error ? `${id}-error` : undefined };
  return <div className="space-y-1"><label htmlFor={id} className="block text-xs font-semibold text-slate-300">{label}</label>
    {multiline ? <textarea {...props} rows={4} /> : <input {...props} type={type} min={min} max={max} />}
    {error && <p id={`${id}-error`} role="alert" className="text-xs text-rose-300">{error}</p>}
  </div>;
}

export function SelectField({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: ReactNode }) {
  const id = useId();
  return <div className="space-y-1"><label htmlFor={id} className="block text-xs text-slate-300">{label}</label>
    <select id={id} className={inputClass} value={value} onChange={(event) => onChange(event.target.value)}>{children}</select></div>;
}

export function AudioField(props: Parameters<typeof Field>[0]) {
  return <div className="space-y-2"><Field {...props} />
    {props.value && AudioUrlSchema.safeParse(props.value).success && <audio aria-label={`Nghe thử ${props.label}`} controls preload="none" src={String(props.value)} className="w-full max-w-sm" />}</div>;
}

export function Feedback({ error, message }: { error?: string | null; message?: string | null }) {
  return <div aria-live="polite">{error && <p role="alert" className="rounded-xl bg-rose-950/50 p-3 text-sm text-rose-200">{error}</p>}
    {message && <p role="status" className="text-sm text-emerald-300">{message}</p>}</div>;
}

export function ReorderButtons({ index, count, disabled, onMove, label = "mục" }: {
  index: number; count: number; disabled?: boolean; onMove: (direction: "UP" | "DOWN") => void; label?: string;
}) {
  return <div className="flex gap-1">{(["UP", "DOWN"] as const).map((direction) => <button type="button" key={direction}
    className={buttonClass} aria-label={`${direction === "UP" ? "Đưa lên" : "Đưa xuống"} ${label} ${index + 1}`}
    disabled={disabled || (direction === "UP" ? index === 0 : index === count - 1)} onClick={() => onMove(direction)}>{direction === "UP" ? "↑" : "↓"}</button>)}</div>;
}

export function moveItem<T>(items: readonly T[], index: number, direction: "UP" | "DOWN"): T[] {
  const result = [...items];
  const target = direction === "UP" ? index - 1 : index + 1;
  if (target >= 0 && target < result.length) [result[index], result[target]] = [result[target], result[index]];
  return result;
}

export function StringListEditor({ label, values, onChange, errors = {}, path, addLabel }: {
  label: string; values: string[]; onChange: (values: string[]) => void; errors?: FieldErrors; path: string; addLabel?: string;
}) {
  return <div className="space-y-2"><p className="text-sm font-semibold text-slate-200">{label}</p>
    {values.length === 0 && <p className="text-xs text-slate-400">Chưa có mục nào.</p>}
    {values.map((value, index) => <div key={index} className="flex items-end gap-2 flex-wrap">
      <div className="min-w-48 flex-1"><Field label={`${label} ${index + 1}`} value={value} errors={errors} path={`${path}.${index}`}
        onChange={(text) => onChange(values.map((item, i) => i === index ? text : item))} /></div>
      <ReorderButtons index={index} count={values.length} onMove={(direction) => onChange(moveItem(values, index, direction))} label={label} />
      <button type="button" className={buttonClass} aria-label={`Xóa ${label} ${index + 1}`} onClick={() => { if (window.confirm(`Xóa ${label.toLowerCase()} này?`)) onChange(values.filter((_, i) => i !== index)); }}>Xóa</button>
    </div>)}
    {errors[path] && <p role="alert" className="text-xs text-rose-300">{errors[path]}</p>}
    <button className={buttonClass} type="button" onClick={() => onChange([...values, ""])}>{addLabel ?? `+ Thêm ${label.toLowerCase()}`}</button>
  </div>;
}

export function EditorModal({ title, busy, onClose, children }: { title: string; busy?: boolean; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    ref.current?.querySelector<HTMLElement>("input, select, textarea, button")?.focus();
    return () => previous?.focus();
  }, []);
  return <div role="dialog" aria-modal="true" aria-labelledby={titleId} ref={ref}
    className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-3 sm:p-6" onKeyDown={(event) => {
      if (event.key === "Escape" && !busy) onClose();
      if (event.key === "Tab") {
        const items = ref.current?.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href]");
        if (!items?.length) return;
        const first = items[0], last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    }}><div className="max-h-[90vh] w-full max-w-3xl space-y-4 overflow-y-auto rounded-3xl border border-slate-700 bg-slate-900 p-4 sm:p-6">
      <div className="flex justify-between gap-3"><h3 id={titleId} className="text-lg font-bold text-white">{title}</h3>
        <button type="button" className={buttonClass} disabled={busy} aria-label="Đóng trình soạn thảo" onClick={onClose}>Đóng</button></div>{children}</div></div>;
}
