// Pure server configuration: also read by Next's server startup hook.
export interface AiProviderConfig {
  provider: "openai" | "http" | "mock" | "disabled";
  apiKey: string;
  model: string;
  baseUrl: string;
  endpoint: string;
  timeoutMs: number;
  maxAttempts: number;
  maxOutputTokens: number;
  rateLimit: number;
  rateWindowMs: number;
}
export class AiProviderConfigurationError extends Error {
  constructor(public readonly variable: string) { super(`Invalid AI configuration: ${variable}. See .env.example and docs/AI_PROVIDER_HARDENING.md.`); }
}
export function readAiProviderConfig(env: NodeJS.ProcessEnv = process.env): AiProviderConfig {
  const raw = env.AI_LESSON_PROVIDER?.trim() || (env.NODE_ENV === "production" ? "" : "disabled");
  if (!["openai", "http", "mock", "disabled"].includes(raw)) throw new AiProviderConfigurationError("AI_LESSON_PROVIDER");
  const provider = raw as AiProviderConfig["provider"];
  if (provider === "mock" && env.NODE_ENV === "production") throw new AiProviderConfigurationError("AI_LESSON_PROVIDER (mock is dev/test only)");
  const integer = (name: string, fallback: number, min: number, max: number) => {
    const value = env[name]?.trim() ? Number(env[name]) : fallback;
    if (!Number.isInteger(value) || value < min || value > max) throw new AiProviderConfigurationError(name);
    return value;
  };
  const apiKey = env.AI_LESSON_API_KEY?.trim() ?? "";
  const model = env.AI_LESSON_MODEL?.trim() ?? "";
  const baseUrl = env.AI_LESSON_BASE_URL?.trim() || "https://api.openai.com/v1";
  const endpoint = env.AI_LESSON_ENDPOINT?.trim() ?? "";
  if (provider === "openai" || provider === "http") {
    if (!apiKey || /[\r\n]/.test(apiKey)) throw new AiProviderConfigurationError("AI_LESSON_API_KEY");
    if (!model || model.length > 100 || !/^[a-zA-Z0-9._:/-]+$/.test(model)) throw new AiProviderConfigurationError("AI_LESSON_MODEL");
    let url: URL;
    try { url = new URL(provider === "openai" ? baseUrl : endpoint); } catch { throw new AiProviderConfigurationError(provider === "openai" ? "AI_LESSON_BASE_URL" : "AI_LESSON_ENDPOINT"); }
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) throw new AiProviderConfigurationError("AI_LESSON_BASE_URL / AI_LESSON_ENDPOINT");
  }
  return { provider, apiKey, model: provider === "mock" ? "fixture" : model, baseUrl, endpoint,
    timeoutMs: integer("AI_LESSON_TIMEOUT_MS", 90000, 1000, 120000), maxAttempts: integer("AI_LESSON_MAX_ATTEMPTS", 3, 1, 3),
    maxOutputTokens: integer("AI_LESSON_MAX_OUTPUT_TOKENS", 12000, 256, 32000), rateLimit: integer("AI_LESSON_RATE_LIMIT", 5, 1, 100),
    rateWindowMs: integer("AI_LESSON_RATE_WINDOW_MS", 600000, 1000, 86400000) };
}
