import { NextRequest, NextResponse } from "next/server";
import { exerciseService } from "@/modules/exercises/exercise.service";
import { DomainError } from "@/shared/errors/domain-errors";
import { unexpectedHttpError } from "@/shared/errors/http-error";
import { getServerSession } from "@/shared/auth/session";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: { code: "UNAUTHORIZED", message: "Yêu cầu đăng nhập để xem bài tập." } }, { status: 401 });
    }
    const { id: exerciseId } = await params;
    const exercise = await exerciseService.getExerciseForStudent(exerciseId, session.user.id);

    if (!exercise) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "NOT_FOUND",
            message: "Không tìm thấy bài tập hoặc bài tập chưa được công khai.",
          },
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: exercise,
    });
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
