import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi, handleAdminError } from "@/shared/auth/admin-guard";
import { adminService } from "@/modules/admin/admin.service";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { errorResponse, user } = await requireAdminApi();
  if (errorResponse) return errorResponse;

  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const updated = await adminService.updateQuestion(user, id, body);
    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    return handleAdminError(err);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { errorResponse, user } = await requireAdminApi();
  if (errorResponse) return errorResponse;

  try {
    const { id } = await params;
    const deleted = await adminService.deleteQuestion(user, id);
    return NextResponse.json({ success: true, data: deleted });
  } catch (err) {
    return handleAdminError(err);
  }
}
