import { NextRequest, NextResponse } from "next/server";
import { exerciseService } from "@/modules/exercises/exercise.service";
import { DomainError } from "@/shared/errors/domain-errors";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: exerciseId } = await params;
    const exercise = await exerciseService.getExerciseForStudent(exerciseId);

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

    const message = err instanceof Error ? err.message : "Đã xảy ra lỗi.";
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
