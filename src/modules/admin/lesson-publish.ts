import { LessonFormSchema, LessonBlockFormSchema, VocabularyFormSchema, QuestionFormSchema, ExerciseFormSchema } from "./admin.schema";
import { isManualQuestion } from "@/modules/exercises/question.schema";
import { ValidationError } from "@/shared/errors/domain-errors";

interface PublishLesson {
  chapterId: string; title: string; slug: string; estimatedMinutes: number;
  blocks: { id: string; type: string; content: unknown; lessonId: string }[];
  vocabularies: { id: string; lessonId: string; hangul: string; romanization: string; vietnameseMeaning: string }[];
  exercises: { title: string; status: string; lessonId?: string; questions: { type: string; prompt: string; exerciseId: string; content?: unknown; options: unknown[] }[] }[];
}

export function validateLessonForPublish(lesson: PublishLesson) {
  const errors: string[] = [];
  const check = (label: string, result: { success: boolean; error?: { issues: { message: string }[] } }) => {
    if (!result.success) errors.push(`${label}: ${result.error?.issues[0]?.message}`);
  };
  check("Thông tin bài học", LessonFormSchema.safeParse(lesson));
  const vocabularyIds = new Set(lesson.vocabularies.map((word) => word.id));
  lesson.vocabularies.forEach((word) => check(word.hangul, VocabularyFormSchema.safeParse(word)));
  lesson.blocks.forEach((block, index) => {
    const parsed = LessonBlockFormSchema.safeParse(block);
    check(`Khối ${index + 1}`, parsed);
    if (parsed.success && parsed.data.type === "VOCABULARY" && "vocabularyIds" in parsed.data.content &&
      parsed.data.content.vocabularyIds?.some((id) => !vocabularyIds.has(id))) errors.push(`Khối ${index + 1}: từ vựng tham chiếu không thuộc bài học`);
  });
  lesson.exercises.filter((exercise) => exercise.status === "PUBLISHED").forEach((exercise) => {
    check(`Bài tập ${exercise.title}`, ExerciseFormSchema.safeParse(exercise));
    if (!exercise.questions.length) errors.push(`${exercise.title}: chưa có câu hỏi`);
    exercise.questions.forEach((question, index) => {
      check(`${exercise.title}, câu ${index + 1}`, QuestionFormSchema.safeParse(question));
      if (isManualQuestion(question.type)) errors.push(`${exercise.title}: câu chấm thủ công cần giữ bản nháp cho đến khi có quy trình duyệt điểm`);
    });
  });
  if (errors.length) throw new ValidationError(`Chưa thể xuất bản. ${errors.join("; ")}`, { publish: { _errors: errors } });
}
