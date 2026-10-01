import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/shared/auth/auth";

/** Authorize admin documents before streaming begins so denial has a real HTTP 403. */
export async function proxy(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) {
    const login = new URL("/dang-nhap", request.url);
    login.searchParams.set("callbackUrl", request.nextUrl.pathname);
    return NextResponse.redirect(login);
  }
  if (session.user.role !== "ADMIN") {
    return new NextResponse(
      '<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>403 - Quyền truy cập bị từ chối</title></head><body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#020617;color:#f8fafc;font:16px system-ui,sans-serif"><main style="max-width:26rem;padding:2rem;text-align:center"><h1>403 - Quyền truy cập bị từ chối</h1><p>Tài khoản của bạn không có quyền quản trị.</p><a href="/dashboard" style="color:#a5b4fc">Trở về bảng học tập</a></main></body></html>',
      { status: 403, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } }
    );
  }
  return NextResponse.next();
}

export const config = { matcher: "/admin/:path*" };
