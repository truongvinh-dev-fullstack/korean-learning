import { NextRequest } from "next/server";
import { handleAiLessonRequest } from "@/modules/ai-lessons/ai-lesson.api";
export const runtime = "nodejs";
export const maxDuration = 180;
export async function POST(req: NextRequest) { return handleAiLessonRequest(req, "generate"); }
