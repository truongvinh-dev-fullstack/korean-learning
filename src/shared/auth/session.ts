import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "./auth";
import { assertAdminRole } from "./roles";

/**
 * Retrieves the current session in Next.js Server Components, Server Actions, or Route Handlers.
 */
export async function getServerSession() {
  const reqHeaders = await headers();
  return auth.api.getSession({
    headers: reqHeaders,
  });
}

/**
 * Guard for protected student routes.
 * Redirects unauthenticated visitors to /dang-nhap with a sanitized callbackUrl.
 */
export async function requireStudent(currentPath: string = "/dashboard") {
  const session = await getServerSession();
  if (!session || !session.user) {
    redirect(`/dang-nhap?callbackUrl=${encodeURIComponent(currentPath)}`);
  }
  return session;
}

/**
 * Guard for protected admin routes.
 * Redirects unauthenticated visitors to /dang-nhap.
 * Enforces the ADMIN role for authenticated users.
 */
export async function requireAdmin(currentPath: string = "/admin") {
  const session = await getServerSession();
  if (!session || !session.user) {
    redirect(`/dang-nhap?callbackUrl=${encodeURIComponent(currentPath)}`);
  }

  assertAdminRole(session.user);
  return session;
}
