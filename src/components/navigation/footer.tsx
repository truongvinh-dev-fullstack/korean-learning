import Link from "next/link";

export function Footer() {
  return (
    <footer className="w-full border-t border-slate-800/80 bg-slate-950/60 mt-auto">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* Brand info */}
          <div className="space-y-3 md:col-span-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-indigo-600 to-rose-500 flex items-center justify-center font-bold text-white text-xs">
                한
              </div>
              <span className="font-bold text-base text-white tracking-tight">
                Korean Zero
              </span>
              <span className="text-xs text-slate-400 font-normal">
                (한국어 제로)
              </span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed max-w-sm">
              Nền tảng học tiếng Hàn bài bản và tương tác từ con số 0. Tích hợp bảng chữ cái Hangul, ngữ pháp căn bản, chấm điểm bài tập tự động và thuật toán lặp lại ngắt quãng SM-2.
            </p>
          </div>

          {/* Learning Links */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
              Nội dung học tập
            </h4>
            <ul className="space-y-2 text-xs text-slate-400">
              <li>
                <Link
                  href="/courses"
                  className="hover:text-indigo-300 transition-colors focus-visible:outline-none focus-visible:underline"
                >
                  Danh mục khóa học
                </Link>
              </li>
              <li>
                <Link
                  href="/courses/tieng-han-tu-con-so-0"
                  className="hover:text-indigo-300 transition-colors focus-visible:outline-none focus-visible:underline"
                >
                  Tiếng Hàn từ con số 0
                </Link>
              </li>
              <li>
                <Link
                  href="/#lo-trinh"
                  className="hover:text-indigo-300 transition-colors focus-visible:outline-none focus-visible:underline"
                >
                  Lộ trình học chi tiết
                </Link>
              </li>
            </ul>
          </div>

          {/* Student Account Links */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
              Tài khoản học viên
            </h4>
            <ul className="space-y-2 text-xs text-slate-400">
              <li>
                <Link
                  href="/dashboard"
                  className="hover:text-indigo-300 transition-colors focus-visible:outline-none focus-visible:underline"
                >
                  Bảng học tập cá nhân
                </Link>
              </li>
              <li>
                <Link
                  href="/dang-nhap"
                  className="hover:text-indigo-300 transition-colors focus-visible:outline-none focus-visible:underline"
                >
                  Đăng nhập
                </Link>
              </li>
              <li>
                <Link
                  href="/dang-ky"
                  className="hover:text-indigo-300 transition-colors focus-visible:outline-none focus-visible:underline"
                >
                  Đăng ký tài khoản mới
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-slate-800/60 pt-6 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-3">
          <p>© 2026 Korean Zero (한국어 제로). Nền tảng học tiếng Hàn dành cho người Việt.</p>
          <div className="flex items-center gap-4">
            <span className="text-slate-400">Giao diện tiếng Việt • Phông chữ Hàn chuẩn</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
