import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { requireAdminApi, handleAdminError } from "@/shared/auth/admin-guard";
import { ValidationError } from "@/shared/errors/domain-errors";
import { aiLessonService } from "./ai-lesson.service";
import { readLimitedJson } from "./lesson-ai-provider";
import { AiGenerationLimitError } from "./ai-generation-limit";

const previewRequest = z.object({ draft: z.unknown(), target: z.unknown(), generationToken: z.string().max(2000).optional() }).strict();
const generateRequest = z.object({ input: z.unknown(), target: z.unknown(), requestId: z.uuid().optional() }).strict();
export async function handleAiLessonRequest(req: NextRequest, action: "generate" | "validate" | "import") {
  const { user, errorResponse } = await requireAdminApi();
  if (errorResponse) return errorResponse;
  let requestId: string = randomUUID();
  try {
    const body = await readLimitedJson(req);
    if (action === "import") return NextResponse.json({ success: true, data: await aiLessonService.importAiLessonDraft(user, body) });
    if (action === "generate") { const data = generateRequest.parse(body); requestId = data.requestId ?? requestId; return NextResponse.json({ success: true, data: await aiLessonService.generateDraft(user, data.input, data.target, requestId) }, { headers: { "X-Request-Id": requestId } }); }
    const data = previewRequest.parse(body); return NextResponse.json({ success: true, data: await aiLessonService.validateDraft(user, data.draft, data.target, data.generationToken) });
  } catch (error) {
    const response = handleAdminError(error instanceof z.ZodError ? new ValidationError("Yêu cầu AI không hợp lệ.", error.flatten()) : error);
    if (action === "generate") response.headers.set("X-Request-Id", requestId);
    if (error instanceof AiGenerationLimitError) response.headers.set("Retry-After", String(error.retryAfterSeconds));
    return response;
  }
}
