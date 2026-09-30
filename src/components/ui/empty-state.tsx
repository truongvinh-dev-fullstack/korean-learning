import React from "react";
import Link from "next/link";

export interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  className?: string;
}

export function EmptyState({
  title,
  description,
  icon,
  action,
  className = "",
}: EmptyStateProps) {
  const defaultIcon = (
    <svg
      className="w-12 h-12 text-slate-500"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
      />
    </svg>
  );

  return (
    <div
      role="status"
      className={`flex flex-col items-center justify-center p-8 sm:p-12 text-center rounded-2xl bg-slate-900/50 border border-slate-800/80 ${className}`}
    >
      <div className="w-16 h-16 rounded-2xl bg-slate-800/80 flex items-center justify-center mb-4 border border-slate-700/60 shadow-inner">
        {icon || defaultIcon}
      </div>

      <h3 className="text-lg font-semibold text-slate-100 mb-2">{title}</h3>

      {description && (
        <p className="text-sm text-slate-400 max-w-md leading-relaxed mb-6">
          {description}
        </p>
      )}

      {action && (
        <div>
          {action.href ? (
            <Link
              href={action.href}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20 transition-all focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none"
            >
              {action.label}
            </Link>
          ) : (
            <button
              type="button"
              onClick={action.onClick}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20 transition-all focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none"
            >
              {action.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
