"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signUp } from "@/shared/auth/auth-client";

export default function RegisterPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Vietnamese Client-side validation
    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedName) {
      setErrorMessage("Vui lòng nhập họ và tên của bạn.");
      return;
    }

    if (!trimmedEmail || !/^\S+@\S+\.\S+$/.test(trimmedEmail)) {
      setErrorMessage("Vui lòng nhập một địa chỉ email hợp lệ.");
      return;
    }

    if (password.length < 8) {
      setErrorMessage("Mật khẩu phải có độ dài tối thiểu 8 ký tự.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("Mật khẩu xác nhận không trùng khớp.");
      return;
    }

    setIsLoading(true);

    try {
      const response = await signUp.email({
        name: trimmedName,
        email: trimmedEmail,
        password,
      });

      if (response.error) {
        const errText = response.error.message || "";
        if (
          errText.toLowerCase().includes("exists") ||
          errText.toLowerCase().includes("already") ||
          errText.toLowerCase().includes("unique")
        ) {
          setErrorMessage(
            "Địa chỉ email này đã được sử dụng. Vui lòng chọn email khác hoặc đăng nhập."
          );
        } else {
          setErrorMessage(
            response.error.message ||
              "Đăng ký không thành công. Vui lòng thử lại sau."
          );
        }
        setIsLoading(false);
        return;
      }

      // Success -> Redirect to dashboard
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(`Đã xảy ra lỗi trong quá trình tạo tài khoản: ${msg}`);
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 py-12 flex items-center justify-center p-4 sm:p-6 bg-slate-950 text-slate-100">
      <div className="w-full max-w-md p-8 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-2xl backdrop-blur-sm">
        {/* Header */}
        <div className="text-center mb-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 mb-4 text-sm font-medium text-slate-400 hover:text-indigo-400 transition-colors"
          >
            ← Quay lại trang chủ
          </Link>
          <div className="w-12 h-12 mx-auto rounded-2xl bg-gradient-to-tr from-indigo-600 to-rose-500 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/20 text-xl mb-3">
            한
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Tạo tài khoản học viên
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Bắt đầu hành trình chinh phục tiếng Hàn cùng Korean Zero
          </p>
        </div>

        {/* Error notification */}
        {errorMessage && (
          <div
            role="alert"
            className="mb-6 p-4 rounded-xl bg-rose-950/60 border border-rose-800/80 text-rose-300 text-sm flex items-start gap-3"
          >
            <span className="text-rose-400 font-bold">⚠️</span>
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="name"
              className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5"
            >
              Họ và tên
            </label>
            <input
              id="name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nguyễn Văn A"
              className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-white placeholder-slate-500 text-sm outline-none transition-all"
            />
          </div>

          <div>
            <label
              htmlFor="email"
              className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5"
            >
              Địa chỉ Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@vidu.vn"
              className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-white placeholder-slate-500 text-sm outline-none transition-all"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5"
            >
              Mật khẩu (tối thiểu 8 ký tự)
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-white placeholder-slate-500 text-sm outline-none transition-all"
            />
          </div>

          <div>
            <label
              htmlFor="confirmPassword"
              className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5"
            >
              Xác nhận mật khẩu
            </label>
            <input
              id="confirmPassword"
              type="password"
              required
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-white placeholder-slate-500 text-sm outline-none transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-2 py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-semibold text-sm shadow-lg shadow-indigo-600/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {isLoading ? "Đang xử lý đăng ký..." : "Đăng ký tài khoản"}
          </button>
        </form>

        {/* Footer */}
        <div className="mt-6 text-center text-sm text-slate-400">
          <span>Đã có tài khoản? </span>
          <Link
            href="/dang-nhap"
            className="font-medium text-indigo-400 hover:text-indigo-300 underline underline-offset-4"
          >
            Đăng nhập ngay
          </Link>
        </div>
      </div>
    </div>
  );
}
