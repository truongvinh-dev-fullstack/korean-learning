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
    const { id: exerciseId } = await params;
    const body = await req.json().catch(() => ({}));
    const question = await adminService.createQuestion(user, {
      ...body,
      exerciseId,
    });
    return NextResponse.json({ success: true, data: question }, { status: 201 });
  } catch (err) {
    return handleAdminError(err);
  }
}
