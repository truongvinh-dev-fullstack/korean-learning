import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/shared/auth/session";
import { srsService } from "@/modules/srs/srs.service";
import { SubmitCardReviewSchema } from "@/modules/srs/srs.schema";
import { DomainError } from "@/shared/errors/domain-errors";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message: "Yêu cầu đăng nhập để ghi nhận ôn tập.",
          },
        },
        { status: 401 }
      );
    }

    const bodyJson = await req.json().catch(() => ({}));
    const parseResult = SubmitCardReviewSchema.safeParse(bodyJson);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_REQUEST",
            message: "Dữ liệu đánh giá thẻ không hợp lệ.",
            details: parseResult.error.format(),
          },
        },
        { status: 400 }
      );
    }

    const { cardId, rating, idempotencyKey } = parseResult.data;

    const result = await srsService.submitCardReview({
      userId: session.user.id,
      cardId,
      rating,
      idempotencyKey,
    });

    return NextResponse.json({
      success: true,
      data: result,
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

    const message = err instanceof Error ? err.message : "Đã xảy ra lỗi khi chấm điểm thẻ.";
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
