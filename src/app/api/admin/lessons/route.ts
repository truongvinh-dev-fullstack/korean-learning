import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi, handleAdminError } from "@/shared/auth/admin-guard";
import { adminService } from "@/modules/admin/admin.service";

export async function GET(req: NextRequest) {
  const { errorResponse, user } = await requireAdminApi();
  if (errorResponse) return errorResponse;

  try {
    const chapterId = req.nextUrl.searchParams.get("chapterId");
    if (!chapterId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Thiếu tham số chapterId trong yêu cầu.",
          },
        },
        { status: 400 }
      );
    }
    const lessons = await adminService.getLessonsByChapterId(user, chapterId);
    return NextResponse.json({ success: true, data: lessons });
  } catch (err) {
    return handleAdminError(err);
  }
}

export async function POST(req: NextRequest) {
  const { errorResponse, user } = await requireAdminApi();
  if (errorResponse) return errorResponse;

  try {
    const body = await req.json().catch(() => ({}));
    const lesson = await adminService.createLesson(user, body);
    return NextResponse.json({ success: true, data: lesson }, { status: 201 });
  } catch (err) {
    return handleAdminError(err);
  }
}
