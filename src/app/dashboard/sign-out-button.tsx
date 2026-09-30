"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "@/shared/auth/auth-client";

export function SignOutButton() {
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
      className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-rose-300 bg-rose-950/40 border border-rose-800/60 hover:bg-rose-900/50 transition-colors disabled:opacity-50 cursor-pointer"
    >
      {isSigningOut ? "Đang đăng xuất..." : "Đăng xuất"}
    </button>
  );
}
