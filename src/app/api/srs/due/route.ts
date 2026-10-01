import { NextResponse } from "next/server";
import { getServerSession } from "@/shared/auth/session";
import { srsService } from "@/modules/srs/srs.service";
import { DomainError } from "@/shared/errors/domain-errors";
import { unexpectedHttpError } from "@/shared/errors/http-error";

export async function GET() {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message: "Yêu cầu đăng nhập để truy cập ôn tập từ vựng.",
          },
        },
        { status: 401 }
      );
    }

    const dueCards = await srsService.getDueCardsForStudent(session.user.id);

    return NextResponse.json({
      success: true,
      data: dueCards,
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
