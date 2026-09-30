import React from "react";

export interface ProgressBarProps {
  value: number;
  max?: number;
  label?: string;
  showPercentage?: boolean;
  size?: "sm" | "md" | "lg";
  variant?: "indigo" | "emerald" | "amber";
  className?: string;
}

export function ProgressBar({
  value,
  max = 100,
  label,
  showPercentage = false,
  size = "md",
  variant = "indigo",
  className = "",
}: ProgressBarProps) {
  const percentage = Math.min(Math.max(0, (value / max) * 100), 100);
  const roundedPercentage = Math.round(percentage);

  const sizeClasses = {
    sm: "h-1.5",
    md: "h-2.5",
    lg: "h-4",
  }[size];

  const variantClasses = {
    indigo: "bg-indigo-500",
    emerald: "bg-emerald-500",
    amber: "bg-amber-500",
  }[variant];

  return (
    <div className={`w-full space-y-1.5 ${className}`}>
      {(label || showPercentage) && (
        <div className="flex items-center justify-between text-xs text-slate-300">
          {label && <span className="font-medium">{label}</span>}
          {showPercentage && (
            <span className="font-semibold text-slate-200 ml-auto">
              {roundedPercentage}%
            </span>
          )}
        </div>
      )}

      <div
        role="progressbar"
        aria-valuenow={roundedPercentage}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label || "Tiến độ học tập"}
        className={`w-full bg-slate-800/80 rounded-full overflow-hidden border border-slate-700/40 ${sizeClasses}`}
      >
        <div
          className={`h-full transition-all duration-300 ease-out rounded-full ${variantClasses}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
