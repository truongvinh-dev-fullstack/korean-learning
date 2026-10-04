import "server-only";
import { DomainError } from "@/shared/errors/domain-errors";
import { AI_GENERATION_MESSAGES, type AiGenerationErrorCode } from "./ai-generation.errors";
import type { AiGenerationContext } from "./ai-generation.types";
export function providerError(code: AiGenerationErrorCode, status = 502) { return new DomainError(AI_GENERATION_MESSAGES[code], code, status); }
class TransientFailure extends Error {
  constructor(readonly code: AiGenerationErrorCode, readonly retryAfterMs = 0) { super(code); }
}
const networkCodes = new Set(["ECONNRESET", "ECONNREFUSED", "ECONNABORTED", "ENETUNREACH", "EHOSTUNREACH", "EPIPE", "ETIMEDOUT", "EAI_AGAIN", "ENOTFOUND", "UND_ERR_CONNECT_TIMEOUT", "UND_ERR_HEADERS_TIMEOUT", "UND_ERR_BODY_TIMEOUT", "UND_ERR_SOCKET"]);
function transientNetwork(error: unknown) {
  if (error instanceof TypeError && error.message === "fetch failed") return true;
  const cause = error instanceof Error ? error.cause : null;
  return !!cause && typeof cause === "object" && "code" in cause && networkCodes.has(String(cause.code));
}
export async function assertProviderResponse(response: Response) {
  if (response.ok) return;
  const retryAfter = response.headers.get("retry-after");
  const delay = retryAfter ? Math.min(5000, Math.max(0, Number(retryAfter) * 1000 || Date.parse(retryAfter) - Date.now() || 0)) : 0;
  await response.body?.cancel(); // Never read/log provider error bodies.
  if (response.status === 429) throw new TransientFailure("AI_RATE_LIMITED", delay);
  if (response.status >= 500) throw new TransientFailure("AI_PROVIDER_UNAVAILABLE", delay);
  throw providerError("AI_PROVIDER_UNAVAILABLE", 503); // 400/401/403 never retry.
}
export async function runProviderRequest<T>(operation: (signal: AbortSignal) => Promise<T>, options: { timeoutMs: number; maxAttempts: number }, context?: AiGenerationContext): Promise<T> {
  const deadline = Date.now() + options.timeoutMs;
  for (let attempt = 0; attempt < options.maxAttempts; attempt++) {
    if (context) context.retryCount = attempt;
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw providerError("AI_PROVIDER_TIMEOUT", 504);
    // Reserve time for retries while bounding the entire generation HTTP operation.
    const slice = Math.max(1, Math.floor(remaining / (options.maxAttempts - attempt)));
    const controller = new AbortController(); let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([operation(controller.signal), new Promise<never>((_, reject) => {
        timer = setTimeout(() => { controller.abort(); reject(new TransientFailure("AI_PROVIDER_TIMEOUT")); }, slice);
      })]);
    } catch (error) {
      if (timer) clearTimeout(timer); controller.abort();
      const failure = error instanceof TransientFailure ? error : transientNetwork(error) ? new TransientFailure("AI_PROVIDER_UNAVAILABLE") : null;
      if (!failure) {
        if (error instanceof DomainError && error.code.startsWith("AI_")) throw error;
        throw providerError("AI_PROVIDER_UNAVAILABLE", 503);
      }
      if (attempt + 1 === options.maxAttempts) throw providerError(failure.code, failure.code === "AI_PROVIDER_TIMEOUT" ? 504 : failure.code === "AI_RATE_LIMITED" ? 429 : 503);
      const delay = Math.max(Math.min(250 * 2 ** attempt, 2000), failure.retryAfterMs);
      if (Date.now() + delay >= deadline) throw providerError(failure.code, failure.code === "AI_PROVIDER_TIMEOUT" ? 504 : failure.code === "AI_RATE_LIMITED" ? 429 : 503);
      await new Promise((resolve) => setTimeout(resolve, delay));
    } finally { if (timer) clearTimeout(timer); controller.abort(); }
  }
  throw providerError("AI_GENERATION_FAILED");
}
