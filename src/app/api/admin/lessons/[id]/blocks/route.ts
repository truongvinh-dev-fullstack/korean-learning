import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi, handleAdminError } from "@/shared/auth/admin-guard";
import { adminService } from "@/modules/admin/admin.service";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { errorResponse, user } = await requireAdminApi();
  if (errorResponse) return errorResponse;

  try {
    const { id: lessonId } = await params;
    const blocks = await adminService.getBlocksByLessonId(user, lessonId);
    return NextResponse.json({ success: true, data: blocks });
  } catch (err) {
    return handleAdminError(err);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { errorResponse, user } = await requireAdminApi();
  if (errorResponse) return errorResponse;

  try {
    const { id: lessonId } = await params;
    const body = await req.json().catch(() => ({}));
    const block = await adminService.createBlock(user, {
      ...body,
      lessonId,
    });
    return NextResponse.json({ success: true, data: block }, { status: 201 });
  } catch (err) {
    return handleAdminError(err);
  }
}
