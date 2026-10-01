"use client";

import { useEffect, useRef, useState } from "react";
import { AudioUrlSchema } from "@/shared/validation/audio-url";

type Playback = { stop: (notify?: boolean) => void };
let activePlayback: Playback | null = null;

export function VocabularyAudioButton({
  hangul,
  audioUrl,
  showLabel = false,
}: {
  hangul: string;
  audioUrl?: string | null;
  showLabel?: boolean;
}) {
  const parsed = AudioUrlSchema.safeParse(audioUrl ?? "");
  const source = parsed.success && parsed.data ? parsed.data : null;
  return <AudioButtonControl key={`${hangul}:${source}`} hangul={hangul} source={source} showLabel={showLabel} />;
}

function AudioButtonControl({ hangul, source, showLabel }: { hangul: string; source: string | null; showLabel: boolean }) {
  const [state, setState] = useState<"idle" | "loading" | "playing" | "error">("idle");
  const playback = useRef<Playback | null>(null);
  useEffect(() => () => playback.current?.stop(false), []);

  function togglePlayback() {
    if (!source) return;
    if (playback.current) {
      playback.current.stop();
      return;
    }
    activePlayback?.stop();
    document.querySelectorAll("audio").forEach((audio) => audio.pause());
    setState("loading");

    try {
      const audio = new Audio();
      audio.preload = "none";
      audio.src = source;
      let disposed = false;
      let timeout: ReturnType<typeof setTimeout>;
      const current: Playback = {
        stop(notify = true) {
          if (disposed) return;
          disposed = true;
          clearTimeout(timeout);
          audio.removeEventListener("playing", playing);
          audio.removeEventListener("waiting", waiting);
          audio.removeEventListener("ended", ended);
          audio.removeEventListener("error", failed);
          document.removeEventListener("play", otherAudioStarted, true);
          audio.pause();
          audio.removeAttribute("src");
          audio.load();
          if (activePlayback === current) activePlayback = null;
          if (playback.current === current) playback.current = null;
          if (notify) setState("idle");
        },
      };
      function playing() {
        if (!disposed) {
          clearTimeout(timeout);
          setState("playing");
        }
      }
      function waiting() {
        if (!disposed) {
          setState("loading");
          clearTimeout(timeout);
          timeout = setTimeout(failed, 15_000);
        }
      }
      function ended() { current.stop(); }
      function failed() {
        if (disposed) return;
        current.stop(false);
        setState("error");
      }
      function otherAudioStarted(event: Event) {
        if (event.target instanceof HTMLMediaElement && event.target !== audio) current.stop();
      }
      audio.addEventListener("playing", playing);
      audio.addEventListener("waiting", waiting);
      audio.addEventListener("ended", ended);
      audio.addEventListener("error", failed);
      document.addEventListener("play", otherAudioStarted, true);
      playback.current = current;
      activePlayback = current;
      timeout = setTimeout(failed, 15_000);
      void audio.play().then(playing).catch(failed);
    } catch {
      playback.current?.stop(false);
      setState("error");
    }
  }

  const busy = state === "loading" || state === "playing";
  const description = !source ? "Chưa có âm thanh" : state === "loading" ? "Đang tải âm thanh…" : state === "error" ? "Không phát được âm thanh, thử lại." : "";
  const label = busy ? `Dừng phát âm ${hangul}` : `Nghe phát âm ${hangul}`;

  return (
    <span className="inline-flex shrink-0 flex-col items-start gap-1 align-middle">
      <button
        type="button"
        disabled={!source}
        onClick={togglePlayback}
        aria-label={label}
        aria-pressed={busy}
        title={description || label}
        className={`inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-xl border px-2 text-indigo-300 transition-colors hover:bg-indigo-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400 disabled:cursor-not-allowed disabled:border-slate-800 disabled:text-slate-500 disabled:hover:bg-transparent ${busy ? "border-indigo-500 bg-indigo-950" : "border-slate-700 bg-slate-900"}`}
      >
        {state === "loading" ? (
          <svg aria-hidden="true" className="h-5 w-5 animate-spin motion-reduce:animate-none" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" opacity="0.3" /><path d="M12 3a9 9 0 0 1 9 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
        ) : state === "playing" ? (
          <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
        ) : (
          <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m11 4-6 5H2v6h3l6 5V4Z" /><path d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14" /></svg>
        )}
        {showLabel && <span className="text-xs font-semibold">{busy ? "Dừng" : "Nghe thử"}</span>}
      </button>
      <span role="status" className={`max-w-48 text-[11px] font-normal ${state === "error" ? "text-rose-300" : "text-slate-400"}`}>{description}</span>
    </span>
  );
}
