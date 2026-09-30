import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex-1 flex items-center justify-center p-6 sm:p-12">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="w-20 h-20 rounded-3xl bg-indigo-950/80 border border-indigo-800/60 flex items-center justify-center text-4xl mx-auto shadow-xl">
          🔍
        </div>

        <div className="space-y-2">
          <span className="text-xs font-bold text-indigo-400 uppercase tracking-widest">
            Mã lỗi 404
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Không tìm thấy trang
          </h1>
          <p className="text-sm text-slate-300 leading-relaxed">
            Đường dẫn bạn yêu cầu không tồn tại, đã bị đổi tên hoặc tạm thời không khả dụng.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Link
            href="/"
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/25 transition-all focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none"
          >
            Về trang chủ
          </Link>
          <Link
            href="/courses"
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl text-sm font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none"
          >
            Danh mục khóa học
          </Link>
        </div>
      </div>
    </div>
  );
}
