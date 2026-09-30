"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SignOutButton } from "./sign-out-button";

export interface MobileNavProps {
  user?: {
    id: string;
    name: string;
    email: string;
    role?: string | null;
  } | null;
}

export function MobileNav({ user }: MobileNavProps) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  const closeMenu = () => setIsOpen(false);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const isAdmin = user?.role === "ADMIN";

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-controls="mobile-navigation-menu"
        aria-label={isOpen ? "Đóng danh mục điều hướng" : "Mở danh mục điều hướng"}
        className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800/80 transition-colors focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none"
      >
        {isOpen ? (
          <svg
            className="w-6 h-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg
            className="w-6 h-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        )}
      </button>

      {isOpen && (
        <div
          id="mobile-navigation-menu"
          className="fixed inset-x-0 top-16 bottom-0 z-50 bg-slate-950/95 backdrop-blur-md border-t border-slate-800/80 flex flex-col p-6 overflow-y-auto"
        >
          {/* User Status Bar if logged in */}
          {user ? (
            <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 mb-6 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-white text-sm">{user.name}</span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    isAdmin
                      ? "bg-amber-950/80 text-amber-300 border-amber-700/60"
                      : "bg-indigo-950/80 text-indigo-300 border-indigo-700/60"
                  }`}
                >
                  {isAdmin ? "ADMIN" : "HỌC VIÊN"}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono truncate">{user.email}</p>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-indigo-950/30 border border-indigo-900/40 mb-6">
              <p className="text-xs text-indigo-200 mb-2">
                Học tiếng Hàn bài bản từ căn bản hoàn toàn miễn phí.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Link
                  href="/dang-nhap"
                  onClick={closeMenu}
                  className="px-3 py-2 text-center text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none"
                >
                  Đăng nhập
                </Link>
                <Link
                  href="/dang-ky"
                  onClick={closeMenu}
                  className="px-3 py-2 text-center text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white shadow focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none"
                >
                  Đăng ký
                </Link>
              </div>
            </div>
          )}

          {/* Navigation Links */}
          <nav className="flex flex-col space-y-2">
            <Link
              href="/"
              onClick={closeMenu}
              className={`px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                pathname === "/" ? "bg-indigo-950/60 text-indigo-300 font-semibold" : "text-slate-200 hover:bg-slate-900"
              }`}
            >
              Trang chủ
            </Link>
            <Link
              href="/courses"
              onClick={closeMenu}
              className={`px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                pathname.startsWith("/courses")
                  ? "bg-indigo-950/60 text-indigo-300 font-semibold"
                  : "text-slate-200 hover:bg-slate-900"
              }`}
            >
              Khóa học tiếng Hàn
            </Link>

            {user && (
              <>
                <Link
                  href="/dashboard"
                  onClick={closeMenu}
                  className={`px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                    pathname === "/dashboard"
                      ? "bg-indigo-950/60 text-indigo-300 font-semibold"
                      : "text-slate-200 hover:bg-slate-900"
                  }`}
                >
                  Bảng học tập cá nhân
                </Link>
                <Link
                  href="/on-tap"
                  onClick={closeMenu}
                  className={`px-3 py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center justify-between ${
                    pathname === "/on-tap"
                      ? "bg-indigo-950/60 text-indigo-300 font-semibold"
                      : "text-slate-200 hover:bg-slate-900"
                  }`}
                >
                  <span>Ôn tập thẻ từ vựng (SRS)</span>
                  <span>🧠</span>
                </Link>
              </>
            )}

            {isAdmin && (
              <Link
                href="/admin"
                onClick={closeMenu}
                className="px-3 py-2.5 rounded-xl text-sm font-medium text-amber-300 hover:bg-amber-950/30 border border-amber-900/40"
              >
                Trang Quản trị viên
              </Link>
            )}
          </nav>

          {/* Sign Out in Footer if logged in */}
          {user && (
            <div className="mt-auto pt-6 border-t border-slate-800 flex justify-end">
              <SignOutButton className="w-full justify-center py-2.5" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
