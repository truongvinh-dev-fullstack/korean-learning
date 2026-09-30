import Link from "next/link";
import { getServerSession } from "@/shared/auth/session";
import { MobileNav } from "./mobile-nav";
import { SignOutButton } from "./sign-out-button";

export async function Navbar() {
  const session = await getServerSession();
  const user = session?.user;
  const isAdmin = user?.role === "ADMIN";

  return (
    <header className="sticky top-0 z-40 w-full backdrop-blur-md bg-slate-950/80 border-b border-slate-800/80">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Logo / Brand */}
        <Link
          href="/"
          className="flex items-center gap-2.5 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-xl p-1"
        >
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-rose-500 flex items-center justify-center font-bold text-white shadow-md shadow-indigo-600/20 text-base group-hover:scale-105 transition-transform">
            한
          </div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-lg tracking-tight text-white group-hover:text-indigo-300 transition-colors">
              Korean Zero
            </span>
            <span className="hidden sm:inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full bg-indigo-950/90 text-indigo-300 border border-indigo-700/50">
              한국어 제로
            </span>
          </div>
        </Link>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-1.5 text-sm">
          <Link
            href="/courses"
            className="px-3 py-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-900 transition-colors focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none"
          >
            Khóa học
          </Link>

          {user && (
            <>
              <Link
                href="/dashboard"
                className="px-3 py-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-900 transition-colors focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none"
              >
                Bảng học tập
              </Link>
              <Link
                href="/on-tap"
                className="px-3 py-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-900 transition-colors focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none flex items-center gap-1.5"
              >
                <span>🧠</span>
                <span>Ôn tập</span>
              </Link>
            </>
          )}

          {isAdmin && (
            <Link
              href="/admin"
              className="px-2.5 py-1 rounded-lg text-xs font-semibold text-amber-300 bg-amber-950/40 border border-amber-800/50 hover:bg-amber-900/50 transition-colors focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:outline-none"
            >
              Quản trị
            </Link>
          )}
        </nav>

        {/* Right Action Section */}
        <div className="hidden md:flex items-center gap-3">
          {user ? (
            <div className="flex items-center gap-3">
              <Link
                href="/dashboard"
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition-colors focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none"
              >
                <div className="w-6 h-6 rounded-full bg-indigo-600/40 text-indigo-300 text-xs flex items-center justify-center font-bold">
                  {user.name ? user.name[0].toUpperCase() : "U"}
                </div>
                <span className="text-xs font-medium text-slate-200 max-w-[120px] truncate">
                  {user.name}
                </span>
              </Link>
              <SignOutButton />
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/dang-nhap"
                className="text-xs font-semibold px-3 py-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-900 transition-colors focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none"
              >
                Đăng nhập
              </Link>
              <Link
                href="/dang-ky"
                className="text-xs font-semibold px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20 transition-all focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none"
              >
                Đăng ký miễn phí
              </Link>
            </div>
          )}
        </div>

        {/* Mobile Navigation Toggle */}
        <MobileNav user={user} />
      </div>
    </header>
  );
}
