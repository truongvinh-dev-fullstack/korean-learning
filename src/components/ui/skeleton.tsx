import React from "react";

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}

export function Skeleton({ className = "", ...props }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-md bg-slate-800/80 ${className}`}
      {...props}
    />
  );
}

export function CourseCardSkeleton() {
  return (
    <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800/80 flex flex-col justify-between space-y-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-4 w-28" />
        </div>
        <Skeleton className="h-6 w-3/4 rounded-lg" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
      </div>

      <div className="space-y-4 pt-4 border-t border-slate-800/60">
        <Skeleton className="h-2 w-full rounded-full" />
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-8 w-28 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

export function SyllabusSkeleton() {
  return (
    <div className="space-y-6">
      {[1, 2, 3].map((chapter) => (
        <div
          key={chapter}
          className="rounded-2xl bg-slate-900/40 border border-slate-800/80 p-6 space-y-4"
        >
          <div className="flex items-center justify-between">
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-4 w-20" />
          </div>
          <Skeleton className="h-4 w-2/3" />
          <div className="space-y-2.5 pt-2">
            {[1, 2, 3].map((lesson) => (
              <div
                key={lesson}
                className="flex items-center justify-between p-3 rounded-xl bg-slate-800/40 border border-slate-700/30"
              >
                <div className="flex items-center gap-3">
                  <Skeleton className="h-6 w-6 rounded-lg" />
                  <Skeleton className="h-4 w-40" />
                </div>
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function DashboardMetricsSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-3"
        >
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-8 rounded-xl" />
          </div>
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-3 w-32" />
        </div>
      ))}
    </div>
  );
}
