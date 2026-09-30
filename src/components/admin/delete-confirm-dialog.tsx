"use client";

import React from "react";

export interface DeleteConfirmDialogProps {
  isOpen: boolean;
  title: string;
  description: string;
  itemName?: string;
  isDeleting?: boolean;
  errorMessage?: string | null;
  onConfirm: () => Promise<void> | void;
  onCancel: () => void;
}

export function DeleteConfirmDialog({
  isOpen,
  title,
  description,
  itemName,
  isDeleting = false,
  errorMessage,
  onConfirm,
  onCancel,
}: DeleteConfirmDialogProps) {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn"
    >
      <div className="max-w-md w-full p-6 sm:p-8 rounded-3xl bg-slate-900 border border-rose-900/60 shadow-2xl space-y-5 text-left">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-rose-950/80 text-rose-300 border border-rose-800/80 flex items-center justify-center text-2xl shrink-0">
            ⚠️
          </div>
          <div>
            <h3 id="delete-dialog-title" className="text-lg font-bold text-white">
              {title}
            </h3>
            {itemName && (
              <p className="text-xs text-rose-300 font-mono font-medium truncate max-w-xs">
                {itemName}
              </p>
            )}
          </div>
        </div>

        <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
          {description}
        </p>

        {errorMessage && (
          <div className="p-3.5 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-200 text-xs flex items-start gap-2">
            <span className="shrink-0">🚫</span>
            <div className="space-y-0.5">
              <strong className="block">Không thể xóa đối tượng:</strong>
              <p>{errorMessage}</p>
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            disabled={isDeleting}
            onClick={onCancel}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer disabled:opacity-50"
          >
            Hủy bỏ
          </button>
          <button
            type="button"
            disabled={isDeleting}
            onClick={onConfirm}
            className="px-5 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/30 transition-all cursor-pointer disabled:opacity-50 flex items-center gap-2"
          >
            {isDeleting ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Đang xóa...</span>
              </>
            ) : (
              <span>Xác nhận xóa</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
