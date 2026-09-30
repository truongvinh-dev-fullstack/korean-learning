import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi, handleAdminError } from "@/shared/auth/admin-guard";
import { adminService } from "@/modules/admin/admin.service";

export async function GET(req: NextRequest) {
  const { errorResponse, user } = await requireAdminApi();
  if (errorResponse) return errorResponse;

  try {
    const courseId = req.nextUrl.searchParams.get("courseId");
    if (!courseId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Thiếu tham số courseId trong yêu cầu.",
          },
        },
        { status: 400 }
      );
    }
    const chapters = await adminService.getChaptersByCourseId(user, courseId);
    return NextResponse.json({ success: true, data: chapters });
  } catch (err) {
    return handleAdminError(err);
  }
}

export async function POST(req: NextRequest) {
  const { errorResponse, user } = await requireAdminApi();
  if (errorResponse) return errorResponse;

  try {
    const body = await req.json().catch(() => ({}));
    const chapter = await adminService.createChapter(user, body);
    return NextResponse.json({ success: true, data: chapter }, { status: 201 });
  } catch (err) {
    return handleAdminError(err);
  }
}
