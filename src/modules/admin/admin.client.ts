export class AdminApiError extends Error {
  constructor(message: string, public readonly details?: unknown, public readonly httpStatus?: number, public readonly code?: string, public readonly requestId?: string) { super(message); }
}

export async function adminRequest<T>(url: string, method = "GET", payload?: unknown): Promise<T> {
  const response = await fetch(url, { method, headers: payload === undefined ? undefined : { "Content-Type": "application/json" },
    body: payload === undefined ? undefined : JSON.stringify(payload), cache: "no-store" });
  let result: unknown;
  try { result = await response.json(); }
  catch { throw new AdminApiError("Không đọc được phản hồi từ máy chủ. Tải lại để kiểm tra dữ liệu trước khi thử lại."); }
  if (!result || typeof result !== "object") throw new AdminApiError("Phản hồi từ máy chủ không hợp lệ.");
  if (!response.ok || !("success" in result) || result.success !== true) {
    const error = "error" in result && result.error && typeof result.error === "object" ? result.error : null;
    throw new AdminApiError(error && "message" in error && typeof error.message === "string" ? error.message : "Không thể thực hiện thao tác. Vui lòng thử lại.",
      error && "details" in error ? error.details : undefined, response.status, error && "code" in error && typeof error.code === "string" ? error.code : undefined, response.headers.get("X-Request-Id") ?? undefined);
  }
  if (!("data" in result)) throw new AdminApiError("Phản hồi thiếu dữ liệu. Tải lại để kiểm tra kết quả.");
  return result.data as T; // Validated envelope; endpoint DTO type is the API boundary.
}

export type FieldErrors = Record<string, string>;
export function issueErrors(issues: readonly { path: readonly PropertyKey[]; message: string }[]): FieldErrors {
  return Object.fromEntries(issues.map((issue) => [issue.path.join("."), issue.message]));
}
export function apiFieldErrors(details: unknown, prefix = ""): FieldErrors {
  if (!details || typeof details !== "object") return {};
  const result: FieldErrors = {};
  for (const [key, value] of Object.entries(details)) {
    if (key === "_errors" && Array.isArray(value) && value.length) result[prefix] = String(value[0]);
    else Object.assign(result, apiFieldErrors(value, prefix ? `${prefix}.${key}` : key));
  }
  return result;
}
