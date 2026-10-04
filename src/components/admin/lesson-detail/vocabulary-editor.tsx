"use client";

import { mapVocabularyDtoToForm } from "@/modules/admin/lesson-detail.mapper";
import type { FieldErrors } from "@/modules/admin/admin.client";
import { Field, AudioField, SelectField, StringListEditor } from "./form-controls";

export function VocabularyEditor({ form, onChange, errors }: { form: ReturnType<typeof mapVocabularyDtoToForm>; onChange: (form: ReturnType<typeof mapVocabularyDtoToForm>) => void; errors: FieldErrors }) {
  const labels = { hangul: "Từ tiếng Hàn (Hangeul)", romanization: "Phiên âm", vietnameseMeaning: "Nghĩa tiếng Việt", englishMeaning: "Nghĩa tiếng Anh", partOfSpeech: "Từ loại", exampleSentenceHangul: "Câu ví dụ tiếng Hàn", exampleSentenceVi: "Câu ví dụ tiếng Việt" };
  const keys = ["hangul", "romanization", "vietnameseMeaning", "englishMeaning", "partOfSpeech", "exampleSentenceHangul", "exampleSentenceVi"] as const;
  return <div className="space-y-4"><div className="grid gap-3 sm:grid-cols-2">
    {keys.map((key) => <Field key={key} label={labels[key]} value={form[key]} errors={errors} path={key} onChange={(value) => onChange({ ...form, [key]: value })} />)}
    <AudioField label="Audio từ vựng" value={form.audioUrl} path="audioUrl" errors={errors} onChange={(audioUrl) => onChange({ ...form, audioUrl })} />
    <SelectField label="Độ khó" value={form.difficulty?.toString() ?? ""} onChange={(value) => onChange({ ...form, difficulty: value ? Number(value) : null })}>
      <option value="">Chưa phân loại</option>{[1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>{value}</option>)}
    </SelectField>
  </div><StringListEditor label="Nhãn từ vựng" values={form.tags} path="tags" errors={errors} onChange={(tags) => onChange({ ...form, tags })} /></div>;
}
