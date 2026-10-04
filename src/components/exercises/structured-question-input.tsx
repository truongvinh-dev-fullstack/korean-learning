"use client";

import type { SanitizedQuestion } from "@/modules/exercises/exercise.service";

export interface QuestionAnswerState { selectedOptionId?: string; selectedOptionIds?: string[]; textAnswer?: string }
const buttonClass = "rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-200 hover:border-indigo-400";
const inputClass = "w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white";
function matchingValues(answer: QuestionAnswerState): Record<string, string> {
  try { const value = JSON.parse(answer.textAnswer ?? "{}"); return value && typeof value === "object" && !Array.isArray(value) ? value : {}; } catch { return {}; }
}
export function isQuestionAnswered(question: SanitizedQuestion, answer?: QuestionAnswerState) {
  if (!answer) return false;
  if (question.type === "MATCHING") {
    const values = matchingValues(answer);
    return question.content?.leftItems?.every((item) => !!values[item.id]) ?? false;
  }
  if (question.type === "ORDERING") return answer.selectedOptionIds?.length === question.content?.items?.length;
  return !!(answer.selectedOptionId || answer.selectedOptionIds?.length || answer.textAnswer?.trim());
}

export function StructuredQuestionInput({ question, answer, onChange }: { question: SanitizedQuestion; answer: QuestionAnswerState; onChange: (answer: QuestionAnswerState) => void }) {
  switch (question.type) {
    case "MULTIPLE_SELECT": return <div className="space-y-3"><p className="text-xs text-slate-400">Chọn tất cả đáp án đúng.</p>
      {question.options.map((option) => <label key={option.id} className={`flex items-center gap-3 ${buttonClass}`}><input type="checkbox" checked={answer.selectedOptionIds?.includes(option.id) ?? false}
        onChange={(event) => onChange({ selectedOptionIds: event.target.checked ? [...(answer.selectedOptionIds ?? []), option.id] : answer.selectedOptionIds?.filter((id) => id !== option.id) })} />{option.text}</label>)}</div>;
    case "TRUE_FALSE": return <div className="flex gap-3">{(["true", "false"] as const).map((value) => <button key={value} type="button" aria-pressed={answer.textAnswer === value}
      className={`${buttonClass} ${answer.textAnswer === value ? "border-indigo-400 bg-indigo-950" : ""}`} onClick={() => onChange({ textAnswer: value })}>{value === "true" ? "Đúng" : "Sai"}</button>)}</div>;
    case "MATCHING": {
      const values = matchingValues(answer);
      return <div className="space-y-3">{question.content?.leftItems?.map((left) => <label key={left.id} className="grid gap-2 text-sm text-slate-200 sm:grid-cols-2">
        <span>{left.text}</span><select aria-label={`Ghép với ${left.text}`} value={values[left.id] ?? ""} className={inputClass}
          onChange={(event) => onChange({ textAnswer: JSON.stringify({ ...values, [left.id]: event.target.value }) })}>
          <option value="">Chọn vế phải</option>{question.content?.rightItems?.map((right) => <option key={right.id} value={right.id}>{right.text}</option>)}
        </select></label>)}</div>;
    }
    case "ORDERING": {
      const items = question.content?.items ?? [];
      const selected = answer.selectedOptionIds ?? [];
      return <div className="space-y-3"><p className="text-xs text-slate-400">Chọn các mục theo thứ tự; nhấn mục đã chọn để gỡ.</p>
        <div className="flex min-h-16 flex-wrap gap-2 rounded-xl border border-slate-700 p-3">{selected.map((id) => <button key={id} type="button" className={`${buttonClass} border-indigo-600`} onClick={() => onChange({ selectedOptionIds: selected.filter((value) => value !== id) })}>{items.find((item) => item.id === id)?.text} ×</button>)}</div>
        <div className="flex flex-wrap gap-2">{items.map((item) => <button key={item.id} type="button" disabled={selected.includes(item.id)} className={`${buttonClass} disabled:opacity-30`}
          onClick={() => onChange({ selectedOptionIds: [...selected, item.id] })}>{item.text}</button>)}</div>
      </div>;
    }
    case "TRANSLATION": return <div className="space-y-3"><p className="text-lg text-white">{question.content?.source}</p><label className="block text-xs text-slate-400">Bản dịch của bạn
      <textarea className={`${inputClass} mt-2`} rows={3} value={answer.textAnswer ?? ""} onChange={(event) => onChange({ textAnswer: event.target.value })} /></label></div>;
    default: return null;
  }
}
