import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "@/shared/auth/session";
import { exerciseService } from "@/modules/exercises/exercise.service";
import { DomainError } from "@/shared/errors/domain-errors";

const AnswerItemSchema = z.object({
  questionId: z.string().min(1, "Thiếu questionId"),
  selectedOptionId: z.string().nullable().optional(),
  selectedOptionIds: z.array(z.string()).nullable().optional(),
  textAnswer: z.string().nullable().optional(),
});

const SubmitAttemptSchema = z.object({
  answers: z.array(AnswerItemSchema).default([]),
  startedAt: z.string().datetime().optional(),
  idempotencyKey: z.string().optional(),
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
            message: "Yêu cầu đăng nhập để nộp bài tập.",
          },
        },
        { status: 401 }
      );
    }

    const { id: exerciseId } = await params;
    const bodyJson = await req.json().catch(() => ({}));
    const parseResult = SubmitAttemptSchema.safeParse(bodyJson);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_REQUEST",
            message: "Dữ liệu nộp bài không hợp lệ.",
            details: parseResult.error.format(),
          },
        },
        { status: 400 }
      );
    }

    const { answers, startedAt, idempotencyKey } = parseResult.data;

    const result = await exerciseService.submitAttempt({
      userId: session.user.id,
      exerciseId,
      answers,
      startedAt: startedAt ? new Date(startedAt) : undefined,
      idempotencyKey,
    });

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

    const message = err instanceof Error ? err.message : "Đã xảy ra lỗi nộp bài tập.";
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
