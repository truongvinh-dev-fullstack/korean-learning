import React from "react";
import { ValidatedLessonBlock } from "@/modules/lessons/lesson-block.schema";

export function LessonBlockRenderer({ block }: { block: ValidatedLessonBlock }) {
  switch (block.type) {
    case "TEXT": {
      const { title, markdown } = block.content;
      return (
        <section className="space-y-3 p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80">
          {title && <h3 className="text-xl font-bold text-white tracking-tight">{title}</h3>}
          <div className="text-sm sm:text-base text-slate-300 leading-relaxed whitespace-pre-line">
            {markdown}
          </div>
        </section>
      );
    }

    case "HANGUL": {
      const { title, description, characters } = block.content;
      return (
        <section className="space-y-4 p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80">
          <div>
            {title && <h3 className="text-xl font-bold text-white tracking-tight">{title}</h3>}
            {description && <p className="text-xs sm:text-sm text-slate-400 mt-1">{description}</p>}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 pt-2">
            {characters.map((item, idx) => (
              <div
                key={idx}
                className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-indigo-600/60 transition-colors flex flex-col items-center text-center space-y-2 group shadow-sm"
              >
                <span className="text-4xl font-extrabold text-white group-hover:text-indigo-300 transition-colors font-mono">
                  {item.char}
                </span>
                <div className="space-y-0.5">
                  <span className="text-xs font-bold text-indigo-400">[{item.romanization}]</span>
                  {item.name && <p className="text-[11px] text-slate-400">{item.name}</p>}
                </div>
                {item.strokeCount && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
                    {item.strokeCount} nét
                  </span>
                )}
                {item.soundHint && (
                  <p className="text-[11px] text-slate-400 leading-tight italic">
                    {item.soundHint}
                  </p>
                )}
                {item.audioUrl && (
                  <audio controls className="w-full mt-2 h-7" src={item.audioUrl}>
                    Trình duyệt không hỗ trợ phát âm thanh.
                  </audio>
                )}
              </div>
            ))}
          </div>
        </section>
      );
    }

    case "VOCABULARY": {
      const { title, items } = block.content;
      return (
        <section className="space-y-4 p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80">
          {title && <h3 className="text-xl font-bold text-white tracking-tight">{title}</h3>}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {items.map((word, idx) => (
              <div
                key={idx}
                className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-col justify-between space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xl font-bold text-white tracking-tight">
                        {word.hangul}
                      </span>
                      <span className="text-xs font-semibold text-indigo-400 font-mono">
                        [{word.romanization}]
                      </span>
                    </div>
                    <div className="mt-1 space-y-0.5">
                      <p className="text-sm font-medium text-emerald-300">{word.vietnamese}</p>
                      <p className="text-xs text-slate-400">{word.english}</p>
                    </div>
                  </div>

                  {word.partOfSpeech && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 border border-slate-700/60 shrink-0">
                      {word.partOfSpeech}
                    </span>
                  )}
                </div>

                {word.example && (
                  <div className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800/80 text-xs space-y-1">
                    <p className="text-slate-200 font-medium">{word.example.korean}</p>
                    <p className="text-slate-400">{word.example.vietnamese}</p>
                  </div>
                )}

                {word.audioUrl && (
                  <audio controls className="w-full h-7 mt-1" src={word.audioUrl}>
                    Trình duyệt không hỗ trợ phát âm thanh.
                  </audio>
                )}
              </div>
            ))}
          </div>
        </section>
      );
    }

    case "GRAMMAR": {
      const { title, formula, explanation, examples } = block.content;
      return (
        <section className="space-y-4 p-6 rounded-2xl bg-gradient-to-br from-indigo-950/30 to-slate-900/60 border border-indigo-800/40">
          <div className="flex items-start sm:items-center justify-between gap-3 flex-wrap">
            <h3 className="text-xl font-bold text-white tracking-tight">{title}</h3>
            <span className="px-3 py-1 rounded-xl text-xs font-mono font-bold bg-indigo-600/30 text-indigo-300 border border-indigo-500/40">
              {formula}
            </span>
          </div>

          <p className="text-sm text-slate-300 leading-relaxed">{explanation}</p>

          <div className="space-y-2 pt-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Ví dụ minh họa:
            </span>
            <div className="space-y-2">
              {examples.map((ex, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-1"
                >
                  <p className="text-sm font-semibold text-white">{ex.korean}</p>
                  <p className="text-xs text-slate-300">{ex.vietnamese}</p>
                  {ex.note && <p className="text-[11px] text-slate-400 italic">💡 {ex.note}</p>}
                </div>
              ))}
            </div>
          </div>
        </section>
      );
    }

    case "DIALOGUE": {
      const { title, lines, audioUrl } = block.content;
      return (
        <section className="space-y-4 p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80">
          <div className="flex items-center justify-between flex-wrap gap-3">
            {title && <h3 className="text-xl font-bold text-white tracking-tight">{title}</h3>}
            {audioUrl && (
              <audio controls preload="none" aria-label={`Âm thanh hội thoại: ${title || "Toàn đoạn"}`} className="h-8 w-full max-w-xs" src={audioUrl}>
                Trình duyệt không hỗ trợ phát âm thanh.
              </audio>
            )}
          </div>

          <div className="space-y-3 pt-2">
            {lines.map((line, idx) => (
              <div
                key={idx}
                className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/60"
              >
                <div className="w-8 h-8 rounded-full bg-indigo-900/60 border border-indigo-700/60 text-xs font-bold text-indigo-300 flex items-center justify-center shrink-0">
                  {line.speaker[0]}
                </div>
                <div className="space-y-1 min-w-0 flex-1">
                  <span className="text-xs font-semibold text-indigo-400">{line.speaker}</span>
                  <p className="text-sm font-bold text-white">{line.korean}</p>
                  <p className="text-xs text-slate-300">{line.vietnamese}</p>
                  {line.audioUrl && (
                    <audio controls preload="none" aria-label={`Âm thanh ${line.speaker}, câu ${idx + 1}: ${line.korean}`} className="w-full max-w-xs h-8" src={line.audioUrl}>
                      Trình duyệt không hỗ trợ phát âm thanh.
                    </audio>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      );
    }

    case "AUDIO": {
      const { audioUrl, title, caption, transcript } = block.content;
      return (
        <section className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-3">
          {title && <h3 className="text-lg font-bold text-white tracking-tight">{title}</h3>}
          {caption && <p className="text-xs text-slate-400">{caption}</p>}
          <audio controls className="w-full" src={audioUrl}>
            Trình duyệt không hỗ trợ phát âm thanh.
          </audio>
          {transcript && (
            <details className="mt-2 text-xs text-slate-400">
              <summary className="cursor-pointer hover:text-indigo-300 transition-colors">
                Xem bản dịch lời thoại (Transcript)
              </summary>
              <div className="p-3 mt-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-300">
                {transcript}
              </div>
            </details>
          )}
        </section>
      );
    }

    case "CALLOUT": {
      const { variant, title, message } = block.content;
      const variantStyles = {
        info: "bg-indigo-950/30 border-indigo-800/50 text-indigo-200",
        warning: "bg-amber-950/30 border-amber-800/50 text-amber-200",
        tip: "bg-emerald-950/30 border-emerald-800/50 text-emerald-200",
        note: "bg-purple-950/30 border-purple-800/50 text-purple-200",
      }[variant || "info"];

      const icons = {
        info: "ℹ️",
        warning: "⚠️",
        tip: "💡",
        note: "📝",
      }[variant || "info"];

      return (
        <aside className={`p-5 rounded-2xl border ${variantStyles} flex items-start gap-3.5`}>
          <span className="text-xl shrink-0">{icons}</span>
          <div className="space-y-1">
            {title && <h4 className="font-bold text-white text-sm">{title}</h4>}
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">{message}</p>
          </div>
        </aside>
      );
    }

    default:
      return null;
  }
}
