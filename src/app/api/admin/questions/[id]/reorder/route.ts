import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi, handleAdminError } from "@/shared/auth/admin-guard";
import { adminService } from "@/modules/admin/admin.service";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { errorResponse, user } = await requireAdminApi();
  if (errorResponse) return errorResponse;

  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const result = await adminService.reorderQuestion(user, id, body);
    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    return handleAdminError(err);
  }
}
