import { z } from "zod";
export interface AiGenerationUsage { inputTokens: number; outputTokens: number; totalTokens: number }
export const AiGenerationMetadataSchema = z.object({
  requestId: z.uuid(), provider: z.enum(["openai", "http", "mock", "custom"]), model: z.string().max(100),
  promptVersion: z.string().max(100), generatedAt: z.iso.datetime(), durationMs: z.number().int().nonnegative(), retryCount: z.number().int().min(0).max(2),
  usage: z.object({ inputTokens: z.number().int().nonnegative(), outputTokens: z.number().int().nonnegative(), totalTokens: z.number().int().nonnegative() }).strict().optional(),
}).strict();
export type AiGenerationMetadata = z.infer<typeof AiGenerationMetadataSchema>;
export interface AiGenerationContext {
  requestId: string; userId: string; provider: AiGenerationMetadata["provider"]; model: string; promptVersion?: string; startedAtMs?: number; retryCount: number; usage?: AiGenerationUsage;
}
