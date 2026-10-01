import { NextResponse } from "next/server";

export function unexpectedHttpError(error: unknown) {
  console.error("Unexpected API error", error);
  return NextResponse.json(
    { success: false, error: { code: "INTERNAL_ERROR", message: "Đã xảy ra lỗi máy chủ nội bộ." } },
    { status: 500 }
  );
}
