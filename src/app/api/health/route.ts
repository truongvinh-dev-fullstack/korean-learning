import { NextResponse } from "next/server";
import { prisma } from "@/shared/db/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const timestamp = new Date().toISOString();

  try {
    const rawResult = await prisma.$queryRaw<{ result: number; current_db: string }[]>`
      SELECT 1 as result, current_database() as current_db;
    `;

    const isDatabaseConnected =
      Array.isArray(rawResult) &&
      rawResult.length > 0 &&
      rawResult[0].result === 1;

    return NextResponse.json(
      {
        status: isDatabaseConnected ? "ok" : "degraded",
        app: "healthy",
        database: isDatabaseConnected ? "connected" : "degraded",
        databaseName: rawResult[0]?.current_db ?? "unknown",
        timestamp,
      },
      { status: isDatabaseConnected ? 200 : 503 }
    );
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown database error";

    return NextResponse.json(
      {
        status: "error",
        app: "healthy",
        database: "disconnected",
        error: errorMessage,
        timestamp,
      },
      { status: 503 }
    );
  }
}
