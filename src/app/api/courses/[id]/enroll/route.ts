import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/shared/auth/session";
import { courseService } from "@/modules/courses/course.service";
import { DomainError } from "@/shared/errors/domain-errors";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message: "Yêu cầu đăng nhập để đăng ký khóa học.",
          },
        },
        { status: 401 }
      );
    }

    const { id: courseId } = await params;
    const enrollment = await courseService.enrollStudent(session.user.id, courseId);

    return NextResponse.json(
      {
        success: true,
        data: enrollment,
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    if (err instanceof DomainError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: err.code,
            message: err.message,
          },
        },
        { status: err.statusCode }
      );
    }

    const message = err instanceof Error ? err.message : "Đã xảy ra lỗi không xác định.";
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message,
        },
      },
      { status: 500 }
    );
  }
}
