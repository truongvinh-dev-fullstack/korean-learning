"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "@/shared/auth/auth-client";
import { sanitizeCallbackUrl } from "@/shared/auth/redirects";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawCallbackUrl = searchParams.get("callbackUrl");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      setErrorMessage("Vui lòng nhập địa chỉ email.");
      return;
    }

    if (!password) {
      setErrorMessage("Vui lòng nhập mật khẩu.");
      return;
    }

    setIsLoading(true);

    try {
      const response = await signIn.email({
        email: trimmedEmail,
        password,
      });

      if (response.error) {
        setErrorMessage(
          "Email hoặc mật khẩu không chính xác. Vui lòng kiểm tra lại."
        );
        setIsLoading(false);
        return;
      }

      // Safe redirect: sanitize the callbackUrl before navigation
      const targetUrl = sanitizeCallbackUrl(rawCallbackUrl, "/dashboard");
      router.push(targetUrl);
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(`Đăng nhập thất bại: ${msg}`);
      setIsLoading(false);
    }
  };

  return (
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
          Đăng nhập học viên
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Tiếp tục bài học và duy trì chuỗi học tập (Streak) của bạn
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
            Mật khẩu
          </label>
          <input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-white placeholder-slate-500 text-sm outline-none transition-all"
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full mt-2 py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-semibold text-sm shadow-lg shadow-indigo-600/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {isLoading ? "Đang xác thực..." : "Đăng nhập"}
        </button>
      </form>

      {/* Footer */}
      <div className="mt-6 text-center text-sm text-slate-400">
        <span>Chưa có tài khoản? </span>
        <Link
          href="/dang-ky"
          className="font-medium text-indigo-400 hover:text-indigo-300 underline underline-offset-4"
        >
          Đăng ký miễn phí
        </Link>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="flex-1 py-12 flex items-center justify-center p-4 sm:p-6 bg-slate-950 text-slate-100">
      <Suspense
        fallback={
          <div className="text-slate-400 text-sm animate-pulse">
            Đang tải trang đăng nhập...
          </div>
        }
      >
        <LoginForm />
      </Suspense>
    </div>
  );
}
