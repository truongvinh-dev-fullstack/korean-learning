import recordings from "./vocabulary-recordings.json";

type VocabularyAudio = { hangul: string; audioUrl?: string | null };
const normalize = (word: string) => word.trim().normalize("NFC");

/** Explicit recordings win; bundled recordings also work for existing database rows. */
export function getVocabularyAudioUrl(
  hangul: string,
  audioUrl?: string | null,
  vocabularies: readonly VocabularyAudio[] = [],
): string | null {
  if (audioUrl?.trim()) return audioUrl.trim();
  const word = normalize(hangul);
  const matches = new Set(vocabularies
    .filter((vocabulary) => normalize(vocabulary.hangul) === word && vocabulary.audioUrl?.trim())
    .map((vocabulary) => vocabulary.audioUrl!.trim()));
  // Do not guess when separately authored entries disagree.
  if (matches.size > 1) return null;
  if (matches.size === 1) return [...matches][0];
  return recordings.find((recording) => recording.hangul === word)?.audioUrl ?? null;
}
