"use client";

import type { ReactNode } from "react";
import { buttonClass, moveItem, ReorderButtons } from "./form-controls";
import type { FieldErrors } from "@/modules/admin/admin.client";

export function RepeatEditor<T>({ label, items, onChange, create, render, errors = {}, path }: {
  label: string; items: T[]; onChange: (items: T[]) => void; create: () => T;
  render: (item: T, index: number, update: (item: T) => void) => ReactNode; errors?: FieldErrors; path: string;
}) {
  return <div className="space-y-3"><p className="font-semibold text-sm text-slate-200">{label}</p>
    {items.length === 0 && <p className="text-xs text-slate-400">Chưa có {label.toLowerCase()}.</p>}
    {items.map((item, index) => <div key={index} className="space-y-3 rounded-xl border border-slate-700 p-3">
      <div className="flex items-center justify-between"><span className="text-xs text-slate-400">#{index + 1}</span>
        <div className="flex gap-2"><ReorderButtons label={label} index={index} count={items.length} onMove={(direction) => onChange(moveItem(items, index, direction))} />
          <button type="button" className={buttonClass} aria-label={`Xóa ${label} ${index + 1}`} onClick={() => {
            if (window.confirm(`Xóa mục ${label.toLowerCase()} này?`)) onChange(items.filter((_, i) => i !== index));
          }}>Xóa</button></div></div>
      {render(item, index, (next) => onChange(items.map((existing, i) => i === index ? next : existing)))}
    </div>)}
    {errors[path] && <p role="alert" className="text-xs text-rose-300">{errors[path]}</p>}
    <button type="button" className={buttonClass} onClick={() => onChange([...items, create()])}>+ Thêm {label.toLowerCase()}</button>
  </div>;
}
