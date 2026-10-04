import type { AiLessonDraft, AiLessonIssue, AiLessonValidationResult, AiQuestion } from "./ai-lesson.schema";

export interface KnowledgeIndex {
  hangulCharacters: Set<string>; vocabulary: Set<string>; grammarPatterns: Set<string>; examples: Set<string>; listeningAssets: Set<string>;
  context: Set<string>; aliases: Map<string, Set<string>>; transcripts: Map<string, string>;
}
const canonical = (value: string) => value.trim().normalize("NFC").toLowerCase().replace(/[.,!?;:]/g, "").replace(/\s+/g, " ");
const korean = (value: string) => value.match(/[\u1100-\u11ff\u3130-\u318f\uac00-\ud7af]+/g) ?? [];
const isCharacter = (value: string) => /^[\u1100-\u11ff\u3130-\u318f]$/.test(value);
const meanings = (value: string) => [canonical(value), ...value.split(/[,;/]/).map(canonical)].filter(Boolean);

export function buildKnowledgeIndex(draft: AiLessonDraft): KnowledgeIndex {
  const index: KnowledgeIndex = { hangulCharacters: new Set(), vocabulary: new Set(), grammarPatterns: new Set(), examples: new Set(), listeningAssets: new Set(), context: new Set(), aliases: new Map(), transcripts: new Map() };
  const addContext = (value?: string | null) => { if (value) index.context.add(canonical(value)); };
  const addAudio = (url?: string | null, transcript?: string | null) => { if (url) { index.listeningAssets.add(url); if (transcript) index.transcripts.set(url, canonical(transcript)); } };
  draft.vocabulary.forEach((word) => {
    index.vocabulary.add(canonical(word.hangul));
    index.aliases.set(canonical(word.hangul), new Set([...meanings(word.vietnamese), ...meanings(word.english ?? ""), canonical(word.romanization)]));
    addContext(word.hangul); addContext(word.vietnamese); addContext(word.english); addContext(word.exampleSentenceHangul); addContext(word.exampleSentenceVi); addAudio(word.audioUrl, word.hangul);
  });
  draft.contentBlocks.forEach((block) => {
    switch (block.type) {
      case "HANGUL": block.content.characters.forEach((char) => {
        index.hangulCharacters.add(canonical(char.char)); addContext(char.char); addAudio(char.audioUrl, char.char);
        index.aliases.set(canonical(char.char), new Set([canonical(char.romanization)]));
        if (char.example) { index.examples.add(canonical(char.example.hangul)); addContext(char.example.hangul); addContext(char.example.vietnamese); }
      }); break;
      case "GRAMMAR": index.grammarPatterns.add(canonical(block.content.pattern)); addContext(block.content.pattern); block.content.rules.forEach(addContext);
        block.content.examples.forEach((e) => { index.examples.add(canonical(e.korean)); addContext(e.korean); addContext(e.vietnamese); addAudio(e.audioUrl, e.korean); }); break;
      case "EXAMPLE": block.content.items.forEach((e) => { index.examples.add(canonical(e.korean)); addContext(e.korean); addContext(e.vietnamese); addAudio(e.audioUrl, e.korean); }); break;
      case "DIALOGUE": block.content.lines.forEach((line) => { index.examples.add(canonical(line.korean)); addContext(line.korean); addContext(line.vietnamese); addAudio(line.audioUrl, line.korean); }); addAudio(block.content.audioUrl, block.content.lines.map((l) => l.korean).join(" ")); break;
      case "AUDIO": addContext(block.content.transcript); addAudio(block.content.audioUrl, block.content.transcript); break;
      case "TEXT": addContext(block.content.markdown); break;
      case "VOCABULARY": break; // Bank already indexed; schema enforces references.
      case "CALLOUT": addContext(block.content.message); break;
      case "IMAGE": break;
    }
  });
  return index;
}

export function validateLessonKnowledge(draft: AiLessonDraft, verifiedAudio?: ReadonlySet<string>): AiLessonValidationResult {
  const index = buildKnowledgeIndex(draft);
  const issues: AiLessonIssue[] = [];
  if (verifiedAudio) {
    const audio = (url: string | null | undefined, path: string) => {
      if (url && !verifiedAudio.has(url)) issues.push({ code: "LESSON_AUDIO_UNVERIFIED", message: "Audio chưa có trong tài nguyên đã xác minh. Hãy bỏ URL hoặc chọn asset thật.", severity: "ERROR", path });
    };
    draft.vocabulary.forEach((v, i) => audio(v.audioUrl, `vocabulary.${i}.audioUrl`));
    draft.contentBlocks.forEach((b, i) => {
      const prefix = `contentBlocks.${i}.content`;
      if (b.type === "AUDIO" || b.type === "DIALOGUE") audio(b.content.audioUrl, `${prefix}.audioUrl`);
      if (b.type === "HANGUL") b.content.characters.forEach((v, j) => audio(v.audioUrl, `${prefix}.characters.${j}.audioUrl`));
      if (b.type === "GRAMMAR") b.content.examples.forEach((v, j) => audio(v.audioUrl, `${prefix}.examples.${j}.audioUrl`));
      if (b.type === "EXAMPLE") b.content.items.forEach((v, j) => audio(v.audioUrl, `${prefix}.items.${j}.audioUrl`));
      if (b.type === "DIALOGUE") b.content.lines.forEach((v, j) => audio(v.audioUrl, `${prefix}.lines.${j}.audioUrl`));
    });
    draft.exercises.forEach((e, i) => e.questions.forEach((q, j) => audio(q.audioUrl, `exercises.${i}.questions.${j}.audioUrl`)));
  }
  const introduced = (value: string) => {
    const key = canonical(value);
    return !!key && (index.hangulCharacters.has(key) || index.vocabulary.has(key) || [...index.context].some((s) => s.includes(key)));
  };
  const answerIntroduced = (answer: string, prompt = "") => introduced(answer) || [...index.aliases].some(([word, aliases]) => aliases.has(canonical(answer)) && (korean(prompt).length === 0 || canonical(prompt).includes(word)));
  draft.exercises.forEach((exercise, ei) => exercise.questions.forEach((q, qi) => {
    const path = `exercises.${ei}.questions.${qi}`;
    const add = (code: string, message: string, severity: AiLessonIssue["severity"] = "ERROR", suffix = "") => issues.push({ code, message, severity, path: path + suffix });
    const checkTarget = (target: string) => {
      if (isCharacter(target) ? !index.hangulCharacters.has(canonical(target)) : !introduced(target)) add(isCharacter(target) ? "QUESTION_UNKNOWN_HANGUL" : "QUESTION_UNKNOWN_VOCABULARY", `'${target}' chưa xuất hiện trong nội dung bài học.`);
    };
    const choices = (question: AiQuestion) => question.options.filter((o) => o.isCorrect).map((o) => o.text);
    switch (q.type) {
      case "MULTIPLE_CHOICE": case "MULTIPLE_SELECT": case "LISTENING_CHOICE": {
        const answers = choices(q);
        const targets = answers.flatMap(korean);
        targets.forEach(checkTarget);
        if (/nghĩa|meaning/i.test(q.prompt)) targets.filter((t) => !isCharacter(t) && !index.vocabulary.has(canonical(t))).forEach((t) => add("QUESTION_UNKNOWN_VOCABULARY", `'${t}' chưa có trong ngân hàng từ vựng đã học.`));
        const promptTargets = korean(q.prompt);
        const promptKey = canonical(q.prompt);
        const meaningTargets = /nghĩa|meaning/i.test(q.prompt) ? draft.vocabulary.filter((word) => [...meanings(word.vietnamese), ...meanings(word.english ?? "")].some((meaning) => meaning.length >= 2 && promptKey.includes(meaning))).map((word) => canonical(word.hangul)) : [];
        if (meaningTargets.length && targets.length && targets.some((target) => !meaningTargets.includes(canonical(target)))) add("QUESTION_MEANING_MISMATCH", "Đáp án không khớp nghĩa từ được hỏi trong ngân hàng.");
        const romanTarget = q.prompt.match(/phiên âm\s+["'“]?([a-z]+)\b/i)?.[1]?.toLowerCase();
        if (romanTarget && targets.some((target) => index.hangulCharacters.has(canonical(target)) && !index.aliases.get(canonical(target))?.has(romanTarget))) add("QUESTION_ROMANIZATION_MISMATCH", "Đáp án không khớp phiên âm của ký tự đã dạy.");
        if (!targets.length) {
          if (promptTargets.length) promptTargets.forEach(checkTarget);
          const grounded = (answer: string) => /nghĩa|meaning/i.test(q.prompt) && promptTargets.length
            ? [...index.aliases].some(([word, aliases]) => aliases.has(canonical(answer)) && promptKey.includes(word))
            : answerIntroduced(answer, q.prompt);
          if (!answers.every(grounded)) add("QUESTION_UNGROUNDED_ANSWER", "Đáp án đúng không khớp từ/nghĩa/phiên âm đã giới thiệu.");
        }
        const auxiliary = promptTargets.filter((target) => !introduced(target));
        if (targets.length && auxiliary.length) add("QUESTION_AUXILIARY_UNKNOWN", `Từ phụ trợ cần đối chiếu: ${auxiliary.join(", ")}.`, "WARNING");
        if (q.type === "LISTENING_CHOICE") {
          if (!q.audioUrl || !(verifiedAudio ?? index.listeningAssets).has(q.audioUrl)) add("QUESTION_AUDIO_MISSING", "Audio chưa có trong danh sách tài nguyên đã xác minh.", "ERROR", ".audioUrl");
          const transcript = q.audioUrl ? index.transcripts.get(q.audioUrl) : undefined;
          if (transcript && !answers.every((a) => transcript.includes(canonical(a)) || answerIntroduced(a))) add("QUESTION_AUDIO_ANSWER_MISMATCH", "Đáp án không liên quan transcript hoặc kiến thức bài học.");
          if (!transcript) add("QUESTION_AUDIO_TRANSCRIPT_REVIEW", "Chưa có transcript; admin cần nghe và đối chiếu đáp án.", "WARNING");
        }
        break;
      }
      case "FILL_BLANK": q.content.answers.forEach((answer) => { if (!answerIntroduced(answer)) checkTarget(answer); }); break;
      case "MATCHING": q.content.pairs.forEach((pair, pi) => {
        const left = canonical(pair.left), right = canonical(pair.right);
        if (!(index.vocabulary.has(left) && index.aliases.get(left)?.has(right)) && !(index.vocabulary.has(right) && index.aliases.get(right)?.has(left))) add("QUESTION_MATCHING_UNKNOWN_PAIR", `Cặp '${pair.left} / ${pair.right}' không khớp ngân hàng từ vựng.`, "ERROR", `.content.pairs.${pi}`);
      }); break;
      case "ORDERING": {
        const sentence = q.content.correctOrder.map((id) => q.content.items.find((item) => item.id === id)?.text ?? "").join(" ");
        const contexts = [...index.examples, ...index.grammarPatterns, ...index.context];
        if (!contexts.some((s) => s.includes(canonical(sentence))) || q.content.items.some((item) => !contexts.some((s) => s.includes(canonical(item.text))))) add("QUESTION_ORDERING_UNKNOWN_CONTEXT", "Câu/thẻ sắp xếp chưa có trong ví dụ, hội thoại hoặc cấu trúc đã dạy.");
        break;
      }
      case "ARRANGE_SENTENCE": if (!q.correctAnswer || !introduced(q.correctAnswer)) add("QUESTION_ORDERING_UNKNOWN_CONTEXT", "Câu chuẩn chưa xuất hiện trong nội dung."); break;
      case "TRANSLATION": if (!introduced(q.content.source)) add("QUESTION_TRANSLATION_UNKNOWN_SOURCE", `'${q.content.source}' chưa được giới thiệu.`, "ERROR", ".content.source"); break;
      case "TRUE_FALSE": add("QUESTION_SEMANTIC_REVIEW", "Cần admin đối chiếu ngữ nghĩa của câu đúng/sai.", "WARNING"); break;
      case "WRITING": add("QUESTION_MANUAL_REVIEW", "Câu viết giữ chấm thủ công; không kiểm tra đáp án tự động.", "INFO"); break;
      case "PRONUNCIATION": {
        const targets = korean(q.content.prompt);
        if (!targets.length) add("QUESTION_PRONUNCIATION_TARGET_MISSING", "Cần ghi rõ từ/ký tự tiếng Hàn phải đọc.");
        targets.forEach(checkTarget); break;
      }
    }
    if (!issues.some((issue) => issue.path.startsWith(path))) add("QUESTION_KNOWLEDGE_VALID", "Câu hỏi dựa trên nội dung đã giới thiệu.", "INFO");
  }));
  return { valid: !issues.some((i) => i.severity === "ERROR"), schemaValid: true, errors: issues.filter((i) => i.severity === "ERROR"), warnings: issues.filter((i) => i.severity === "WARNING"), info: issues.filter((i) => i.severity === "INFO") };
}
