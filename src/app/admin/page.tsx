import Link from "next/link";
import { getServerSession } from "@/shared/auth/session";
import { adminService } from "@/modules/admin/admin.service";

export default async function AdminDashboardPage() {
  const session = await getServerSession();

  if (!session || !session.user || session.user.role !== "ADMIN") {
    return null;
  }

  const metrics = await adminService.getAdminDashboardMetrics(session.user);

  return (
    <div className="max-w-6xl mx-auto p-6 sm:p-10 space-y-8">
      {/* Top Header */}
      <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-6 border-b border-slate-800 gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-rose-600 flex items-center justify-center font-bold text-white shadow-lg text-lg">
            👑
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-white tracking-tight">
                Hệ thống Quản trị Korean Zero (Admin CMS)
              </h1>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-700">
                ADMIN
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Quản lý tài khoản, giáo trình, bài học, từ vựng và câu hỏi bài tập
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 transition-colors"
          >
            ← Bảng học viên
          </Link>
        </div>
      </header>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-center">
          <div className="text-2xl font-extrabold text-white">{metrics.courseCount}</div>
          <div className="text-xs text-slate-400 mt-1">Khóa học</div>
        </div>
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-center">
          <div className="text-2xl font-extrabold text-indigo-400">{metrics.chapterCount}</div>
          <div className="text-xs text-slate-400 mt-1">Chương học</div>
        </div>
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-center">
          <div className="text-2xl font-extrabold text-indigo-400">{metrics.lessonCount}</div>
          <div className="text-xs text-slate-400 mt-1">Bài học</div>
        </div>
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-center">
          <div className="text-2xl font-extrabold text-rose-400">{metrics.exerciseCount}</div>
          <div className="text-xs text-slate-400 mt-1">Bài tập</div>
        </div>
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-center">
          <div className="text-2xl font-extrabold text-emerald-400">{metrics.vocabCount}</div>
          <div className="text-xs text-slate-400 mt-1">Từ vựng</div>
        </div>
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-center">
          <div className="text-2xl font-extrabold text-amber-400">{metrics.userCount}</div>
          <div className="text-xs text-slate-400 mt-1">Người dùng</div>
        </div>
      </div>

      {/* CLI Instruction Box */}
      <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <span>⚡</span>
          <span>Lệnh phân quyền Quản trị viên (CLI)</span>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed">
          Tài khoản đăng ký mới sẽ mặc định mang vai trò <span className="font-bold text-slate-200">STUDENT</span>. Để phân quyền ADMIN cho bất kỳ tài khoản nào, hãy chạy lệnh sau từ terminal:
        </p>
        <code className="block p-3 rounded-xl bg-slate-950 border border-slate-800 text-amber-300 font-mono text-xs overflow-x-auto">
          pnpm admin:promote --email=user@example.com
        </code>
      </div>

      {/* User Management Table */}
      <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-white">
            Danh sách người dùng đã đăng ký ({metrics.recentUsers.length})
          </h2>
          <span className="text-xs text-slate-500">Mới nhất</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="text-xs uppercase bg-slate-950/60 text-slate-400 border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">Họ và tên</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Vai trò (Role)</th>
                <th className="px-4 py-3">Ngày tạo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {metrics.recentUsers.map((u) => (
                <tr key={u.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="px-4 py-3 font-medium text-white">{u.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-300">{u.email}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded-full border ${
                        u.role === "ADMIN"
                          ? "bg-amber-950/80 text-amber-300 border-amber-700/60"
                          : "bg-indigo-950/80 text-indigo-300 border-indigo-700/60"
                      }`}
                    >
                      {u.role || "STUDENT"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400">
                    {new Date(u.createdAt).toLocaleDateString("vi-VN")}
                  </td>
                </tr>
              ))}
              {metrics.recentUsers.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                    Chưa có người dùng nào đăng ký.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
