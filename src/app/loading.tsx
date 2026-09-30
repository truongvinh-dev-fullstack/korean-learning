export default function GlobalLoading() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex-1 flex flex-col items-center justify-center min-h-[60vh] p-6 text-center space-y-4"
    >
      <div className="relative w-12 h-12">
        <div className="w-12 h-12 rounded-full border-4 border-slate-800 border-t-indigo-500 animate-spin" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-slate-200">Đang tải dữ liệu...</p>
        <p className="text-xs text-slate-400">Vui lòng chờ trong giây lát</p>
      </div>
      <span className="sr-only">Đang tải trang</span>
    </div>
  );
}
