import { NextResponse } from "next/server";
import { getServerSession } from "@/shared/auth/session";
import { DomainError } from "@/shared/errors/domain-errors";
import { unexpectedHttpError } from "@/shared/errors/http-error";

export async function requireAdminApi() {
  const session = await getServerSession();
  if (!session?.user) {
    return {
      errorResponse: NextResponse.json(
        {
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message: "Yêu cầu đăng nhập để truy cập quản trị.",
          },
        },
        { status: 401 }
      ),
      user: null,
    };
  }

  if (session.user.role !== "ADMIN") {
    return {
      errorResponse: NextResponse.json(
        {
          success: false,
          error: {
            code: "FORBIDDEN",
            message: "Bạn không có quyền Quản trị viên (ADMIN) để thực hiện thao tác này.",
          },
        },
        { status: 403 }
      ),
      user: null,
    };
  }

  return { errorResponse: null, user: session.user };
}

export function handleAdminError(err: unknown) {
  if (err instanceof DomainError) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: err.code,
          message: err.message,
          details: "details" in err ? err.details : undefined,
        },
      },
      { status: err.statusCode }
    );
  }

  return unexpectedHttpError(err);
}
