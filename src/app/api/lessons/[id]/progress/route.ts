import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "@/shared/auth/session";
import { progressService } from "@/modules/progress/progress.service";
import { DomainError } from "@/shared/errors/domain-errors";
import { unexpectedHttpError } from "@/shared/errors/http-error";

const UpdateProgressSchema = z.object({
  action: z.enum(["START", "COMPLETE"]),
}).strict();

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

    const { action } = parseResult.data;

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

    return unexpectedHttpError(err);
  }
}
