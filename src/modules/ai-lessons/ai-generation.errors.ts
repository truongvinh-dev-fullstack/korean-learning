export const AI_GENERATION_MESSAGES = {
  AI_PROVIDER_UNAVAILABLE: "Dịch vụ AI chưa sẵn sàng. Vui lòng liên hệ quản trị hệ thống hoặc thử lại sau.",
  AI_PROVIDER_TIMEOUT: "AI tạo bài học mất quá nhiều thời gian. Vui lòng thử lại.",
  AI_RATE_LIMITED: "Bạn đã đạt giới hạn tạo bài học AI hoặc đang có yêu cầu chạy. Vui lòng thử lại sau.",
  AI_INVALID_RESPONSE: "AI trả về dữ liệu không hợp lệ. Vui lòng thử tạo lại bản nháp.",
  AI_SCHEMA_VALIDATION_FAILED: "Bản nháp AI không đúng cấu trúc. Hãy xem kết quả kiểm tra và thử tạo lại.",
  AI_GENERATION_FAILED: "Không tạo được bản nháp. Vui lòng thử lại hoặc kiểm tra cấu hình provider.",
} as const;
export type AiGenerationErrorCode = keyof typeof AI_GENERATION_MESSAGES;
export function aiGenerationErrorMessage(code?: string) {
  return code && Object.hasOwn(AI_GENERATION_MESSAGES, code) ? AI_GENERATION_MESSAGES[code as AiGenerationErrorCode] : undefined;
}
