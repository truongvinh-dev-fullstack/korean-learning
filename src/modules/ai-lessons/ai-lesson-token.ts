import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { DomainError, ValidationError } from "@/shared/errors/domain-errors";
import type { AiLessonDraft, AiLessonTarget } from "./ai-lesson.schema";
import { AiGenerationMetadataSchema, type AiGenerationMetadata } from "./ai-generation.types";

// Stable object-key ordering; array order remains meaningful.
function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value).filter(([, v]) => v !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${stable(v)}`).join(",")}}`;
  return JSON.stringify(value);
}
export function aiImportHash(draft: AiLessonDraft, target: AiLessonTarget, generation?: AiGenerationMetadata) { return createHash("sha256").update(stable({ draft, target, generation })).digest("hex"); }
function sign(value: string, domain = "preview") {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret || secret.length < 32) throw new DomainError("Cấu hình máy chủ chưa sẵn sàng xác nhận bản nháp.", "AI_TOKEN_CONFIGURATION", 503);
  return createHmac("sha256", secret).update(`ai-lesson-${domain}:v1:${value}`).digest("base64url");
}
export function issueAiGenerationToken(userId: string, metadata: AiGenerationMetadata) {
  const value = Buffer.from(JSON.stringify({ userId, metadata: AiGenerationMetadataSchema.parse(metadata) })).toString("base64url");
  return `${value}.${sign(value, "generation")}`;
}
export function verifyAiGenerationToken(token: string | undefined, userId: string): AiGenerationMetadata | undefined {
  if (!token) return undefined;
  try {
    const [value, signature, extra] = token.split(".");
    if (!value || !signature || extra) throw new Error();
    const expected = Buffer.from(sign(value, "generation")), received = Buffer.from(signature);
    if (expected.length !== received.length || !timingSafeEqual(expected, received)) throw new Error();
    const payload = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    if (payload.userId !== userId) throw new Error();
    return AiGenerationMetadataSchema.parse(payload.metadata);
  } catch { throw new ValidationError("Thông tin nguồn AI không hợp lệ. Hãy tạo lại bản nháp."); }
}
export function issueAiValidationToken(userId: string, hash: string) {
  const value = Buffer.from(JSON.stringify({ userId, hash, expires: Date.now() + 30 * 60 * 1000 })).toString("base64url");
  return `${value}.${sign(value)}`;
}
export function verifyAiValidationToken(token: string, userId: string, hash: string) {
  try {
    const [value, signature, extra] = token.split(".");
    if (!value || !signature || extra) throw new Error();
    const expected = Buffer.from(sign(value)), received = Buffer.from(signature);
    if (expected.length !== received.length || !timingSafeEqual(expected, received)) throw new Error();
    const payload = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    if (payload.userId !== userId || payload.hash !== hash || typeof payload.expires !== "number" || payload.expires < Date.now()) throw new Error();
  } catch { throw new ValidationError("Bản nháp đã thay đổi hoặc xác nhận hết hạn. Hãy kiểm tra lại trước khi nhập."); }
}
