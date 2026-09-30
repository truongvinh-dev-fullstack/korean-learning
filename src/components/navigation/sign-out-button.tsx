"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "@/shared/auth/auth-client";

export interface SignOutButtonProps {
  className?: string;
}

export function SignOutButton({ className = "" }: SignOutButtonProps) {
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await signOut();
      router.push("/dang-nhap");
      router.refresh();
    } catch {
      setIsSigningOut(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={isSigningOut}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-rose-300 bg-rose-950/40 border border-rose-900/60 hover:bg-rose-900/50 transition-colors disabled:opacity-50 cursor-pointer focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:outline-none ${className}`}
    >
      <svg
        className="w-3.5 h-3.5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
        />
      </svg>
      <span>{isSigningOut ? "Đang đăng xuất..." : "Đăng xuất"}</span>
    </button>
  );
}
