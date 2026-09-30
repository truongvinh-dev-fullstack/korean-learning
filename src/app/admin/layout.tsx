import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "@/shared/auth/session";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession();

  // 1. Unauthenticated -> Redirect to login
  if (!session || !session.user) {
    redirect("/dang-nhap?callbackUrl=/admin");
  }

  // 2. Authenticated but NOT ADMIN -> 403 Forbidden Access Screen
  if (session.user.role !== "ADMIN") {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-slate-950 text-slate-100">
        <div className="max-w-md w-full p-8 rounded-2xl bg-slate-900 border border-rose-900/60 shadow-2xl text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-rose-950/80 border border-rose-800 flex items-center justify-center text-3xl">
            🚫
          </div>
          <h1 className="text-xl font-bold text-white">
            403 - Quyền truy cập bị từ chối
          </h1>
          <p className="text-sm text-slate-300 leading-relaxed">
            Tài khoản <span className="font-semibold text-rose-300 font-mono">{session.user.email}</span> của bạn có vai trò là{" "}
            <span className="font-bold text-indigo-400">{session.user.role || "STUDENT"}</span>, không có quyền Quản trị viên (ADMIN).
          </p>
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-400 text-left">
            <span className="font-semibold text-slate-200">Hướng dẫn kích hoạt:</span>
            <p className="mt-1">
              Chạy lệnh CLI sau trong terminal máy chủ để cấp quyền ADMIN:
            </p>
            <code className="block mt-1.5 p-2 rounded bg-slate-900 text-amber-300 font-mono text-[11px] overflow-x-auto">
              pnpm admin:promote --email={session.user.email}
            </code>
          </div>
          <div className="pt-2">
            <Link
              href="/dashboard"
              className="inline-block w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-colors"
            >
              ← Trở về Bảng học viên
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // 3. ADMIN possess full access
  return <div className="min-h-screen bg-slate-950 text-slate-100">{children}</div>;
}
