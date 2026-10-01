import { forbidden, redirect } from "next/navigation";
import { getServerSession } from "@/shared/auth/session";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession();
  if (!session?.user) redirect("/dang-nhap?callbackUrl=/admin");
  if (session.user.role !== "ADMIN") forbidden();
  return <div className="min-h-screen bg-slate-950 text-slate-100">{children}</div>;
}
