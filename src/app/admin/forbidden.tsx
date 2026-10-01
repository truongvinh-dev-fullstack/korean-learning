import Link from "next/link";

export default function AdminForbidden() {
  return (
    <main className="min-h-[60vh] flex items-center justify-center px-4 py-12 text-slate-100">
      <div className="w-full max-w-md rounded-2xl border border-rose-900/60 bg-slate-900 p-6 sm:p-8 text-center space-y-4">
        <h1 className="text-xl font-bold">403 - Quyền truy cập bị từ chối</h1>
        <p className="text-sm text-slate-300">Tài khoản của bạn không có quyền quản trị.</p>
        <Link href="/dashboard" className="inline-block rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold hover:bg-indigo-500">
          Trở về bảng học tập
        </Link>
      </div>
    </main>
  );
}
