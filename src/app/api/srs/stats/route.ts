import { NextResponse } from "next/server";
import { getServerSession } from "@/shared/auth/session";
import { srsService } from "@/modules/srs/srs.service";
import { DomainError } from "@/shared/errors/domain-errors";

export async function GET() {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message: "Yêu cầu đăng nhập để xem thông tin ôn tập.",
          },
        },
        { status: 401 }
      );
    }

    const summary = await srsService.getReviewSummaryForStudent(session.user.id);

    return NextResponse.json({
      success: true,
      data: summary,
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
