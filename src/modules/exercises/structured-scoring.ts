import { z } from "zod";
import type { RawQuestionWithGrading } from "./exercise.service";
import type { StudentQuestionAnswerInput, QuestionGradingResult } from "./scoring";
import { normalizeFillBlankAnswer } from "./scoring";
import { parseQuestionContent } from "./question.schema";

export function parseMatchingAnswer(raw: string | null | undefined): Record<string, string> | null {
  try { return z.record(z.string(), z.string()).parse(JSON.parse(raw ?? "")); } catch { return null; }
}

export function gradeStructuredQuestion(question: RawQuestionWithGrading, answer: StudentQuestionAnswerInput): QuestionGradingResult | null {
  let isCorrect = false, studentAnswerDisplay = answer.textAnswer ?? "", correctAnswerDisplay = "";
  switch (question.type) {
    case "MULTIPLE_SELECT": {
      const selected = answer.selectedOptionIds ?? [];
      const correct = question.options.filter((option) => option.isCorrect);
      isCorrect = new Set(selected).size === selected.length && selected.length === correct.length && correct.every((option) => selected.includes(option.id));
      studentAnswerDisplay = selected.map((id) => question.options.find((option) => option.id === id)?.text ?? "(Không hợp lệ)").join(" · ");
      correctAnswerDisplay = correct.map((option) => option.text).join(" · "); break;
    }
    case "TRUE_FALSE": {
      const content = parseQuestionContent(question.type, question.content);
      isCorrect = answer.textAnswer === String(content.correctAnswer);
      studentAnswerDisplay = answer.textAnswer === "true" ? "Đúng" : "Sai";
      correctAnswerDisplay = content.correctAnswer ? "Đúng" : "Sai"; break;
    }
    case "MATCHING": {
      const content = parseQuestionContent(question.type, question.content);
      const pairs = parseMatchingAnswer(answer.textAnswer);
      isCorrect = !!pairs && Object.keys(pairs).length === content.pairs.length && content.pairs.every((pair) => pairs[pair.leftId] === pair.rightId);
      studentAnswerDisplay = content.pairs.map((pair) => `${pair.left} → ${content.pairs.find((item) => item.rightId === pairs?.[pair.leftId])?.right ?? "(Chưa chọn)"}`).join("; ");
      correctAnswerDisplay = content.pairs.map((pair) => `${pair.left} → ${pair.right}`).join("; "); break;
    }
    case "ORDERING": {
      const content = parseQuestionContent(question.type, question.content);
      const selected = answer.selectedOptionIds ?? [];
      isCorrect = selected.length === content.correctOrder.length && content.correctOrder.every((id, index) => id === selected[index]);
      const display = (ids: string[]) => ids.map((id) => content.items.find((item) => item.id === id)?.text ?? "(Không hợp lệ)").join(" → ");
      studentAnswerDisplay = display(selected); correctAnswerDisplay = display(content.correctOrder); break;
    }
    case "TRANSLATION": {
      const content = parseQuestionContent(question.type, question.content);
      const normalized = normalizeFillBlankAnswer(answer.textAnswer);
      isCorrect = !!normalized && content.acceptedAnswers.some((value) => normalizeFillBlankAnswer(value) === normalized);
      correctAnswerDisplay = content.acceptedAnswers.join(" / "); break;
    }
    default: return null;
  }
  return { questionId: question.id, type: question.type, isCorrect, score: isCorrect ? 10 : 0, maxScore: 10,
    studentAnswerDisplay, correctAnswerDisplay, explanation: question.explanation ?? null };
}
