import type { SupportedBlockType } from "@/modules/lessons/lesson-block.schema";
import type { SupportedQuestionType } from "@/modules/exercises/question.schema";

export const BLOCK_LABELS: Record<SupportedBlockType, string> = {
  TEXT: "📝 Văn bản", HANGUL: "한 Hangeul", VOCABULARY: "📚 Từ vựng", GRAMMAR: "📐 Ngữ pháp",
  EXAMPLE: "💬 Ví dụ", DIALOGUE: "👥 Hội thoại", AUDIO: "🎧 Audio", IMAGE: "🖼 Hình ảnh", CALLOUT: "💡 Ghi chú / Callout",
};
export const CALLOUT_LABELS = { tip: "Mẹo học", note: "Ghi chú", warning: "Cảnh báo", remember: "Ghi nhớ", culture: "Văn hóa", topik: "TOPIK", common_mistake: "Lỗi thường gặp", info: "Thông tin" };
export const QUESTION_LABELS: Record<SupportedQuestionType, string> = {
  MULTIPLE_CHOICE: "Trắc nghiệm một đáp án", MULTIPLE_SELECT: "Chọn nhiều đáp án", TRUE_FALSE: "Đúng / Sai",
  FILL_BLANK: "Điền từ", MATCHING: "Ghép cặp", ORDERING: "Sắp xếp thứ tự", LISTENING_CHOICE: "Nghe chọn đáp án",
  TRANSLATION: "Dịch câu", WRITING: "Viết (chấm thủ công)", PRONUNCIATION: "Phát âm (bản nháp)", ARRANGE_SENTENCE: "Sắp xếp từ ghép câu",
};
