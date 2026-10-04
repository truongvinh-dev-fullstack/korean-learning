import "server-only";
import { stat } from "node:fs/promises";
import path from "node:path";
import type { AiLessonDraft } from "./ai-lesson.schema";
import { buildKnowledgeIndex } from "./lesson-knowledge-validator";
export async function verifiedAiAudio(draft: AiLessonDraft) {
  const urls = buildKnowledgeIndex(draft).listeningAssets;
  draft.exercises.forEach((e) => e.questions.forEach((q) => { if (q.audioUrl) urls.add(q.audioUrl); }));
  const verified = new Set<string>(), publicRoot = path.resolve(process.cwd(), "public");
  const remote = new Set((process.env.AI_LESSON_VERIFIED_AUDIO_URLS ?? "").split(",").map((u) => u.trim()).filter(Boolean));
  await Promise.all([...urls].map(async (url) => {
    if (remote.has(url)) { verified.add(url); return; }
    if (!url.startsWith("/") || url.startsWith("//") || /[?#\\]/.test(url)) return;
    const file = path.resolve(publicRoot, `.${url}`);
    if (!file.startsWith(`${publicRoot}${path.sep}`)) return;
    try { if ((await stat(file)).isFile() && /\.(ogg|mp3|wav|m4a|webm)$/i.test(file)) verified.add(url); } catch { /* Missing assets remain unverified. */ }
  }));
  return verified;
}
