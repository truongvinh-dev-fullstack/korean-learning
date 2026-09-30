import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "@/shared/auth/session";
import { progressService } from "@/modules/progress/progress.service";
import { DomainError } from "@/shared/errors/domain-errors";

const UpdateProgressSchema = z.object({
  action: z.enum(["START", "COMPLETE"]),
  score: z.number().int().min(0).max(100).optional(),
});

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
            message: "Yêu cầu đăng nhập để cập nhật tiến độ bài học.",
          },
        },
        { status: 401 }
      );
    }

    const { id: lessonId } = await params;
    const bodyJson = await req.json().catch(() => ({}));
    const parseResult = UpdateProgressSchema.safeParse(bodyJson);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_REQUEST",
            message: "Dữ liệu yêu cầu không hợp lệ.",
            details: parseResult.error.format(),
          },
        },
        { status: 400 }
      );
    }

    const { action, score } = parseResult.data;

    let result;
    if (action === "START") {
      result = await progressService.startLesson({
        requestingUserId: session.user.id,
        targetUserId: session.user.id,
        lessonId,
      });
    } else {
      result = await progressService.completeLesson({
        requestingUserId: session.user.id,
        targetUserId: session.user.id,
        lessonId,
        score,
      });
    }

    return NextResponse.json(
      {
        success: true,
        data: result,
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
