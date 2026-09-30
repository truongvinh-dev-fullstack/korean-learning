import { requireStudent } from "@/shared/auth/session";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Server-side route guard: redirects unauthenticated visitors to /dang-nhap
  await requireStudent("/dashboard");

  return <div className="min-h-screen bg-slate-950 text-slate-100">{children}</div>;
}
