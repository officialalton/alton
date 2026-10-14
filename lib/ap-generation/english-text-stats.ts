// AP English Language 지문 결정적 게이트용 텍스트 통계(2026-10-14, 무료). 정답 키를 코드로 검증할 수 없는 과목이라
// 길이·문장 길이·가독성 범위를 코드로 강제해 생성 지문의 모양을 고정한다. docs/ap/englang-groundwork.md §3.
export type TextStats = { words: number; sentences: number; avgSentenceWords: number; maxSentenceWords: number; avgWordLen: number; fleschKincaid: number; paragraphs: number };

const WORD = /[A-Za-z][A-Za-z'’-]*/g;
const syllables = (w: string): number => {
  const s = w.toLowerCase().replace(/[^a-z]/g, "");
  if (!s) return 0;
  const m = s.replace(/e$/, "").match(/[aeiouy]+/g);
  return Math.max(1, m ? m.length : 1);
};

export function textStats(text: string): TextStats {
  const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim()).length;
  const sentences = text.replace(/\b(Mr|Mrs|Ms|Dr|St|etc)\./g, "$1").split(/(?<=[.!?])["')\]]*\s+/).map((s) => s.trim()).filter(Boolean);
  const tokens = text.match(WORD) ?? [];
  const words = tokens.length;
  const sentWords = sentences.map((s) => (s.match(WORD) ?? []).length);
  const syl = tokens.reduce((a, w) => a + syllables(w), 0);
  const n = Math.max(1, sentences.length);
  const w = Math.max(1, words);
  return {
    words, sentences: sentences.length, paragraphs,
    avgSentenceWords: words / n,
    maxSentenceWords: sentWords.length ? Math.max(...sentWords) : 0,
    avgWordLen: tokens.reduce((a, t) => a + t.length, 0) / w,
    fleschKincaid: 0.39 * (words / n) + 11.8 * (syl / w) - 15.59,
  };
}

export type PassageBounds = { minWords: number; maxWords: number; minAvgSentence: number; maxAvgSentence: number; minGrade: number; maxGrade: number };
export function passageViolations(text: string, b: PassageBounds): string[] {
  const s = textStats(text); const v: string[] = [];
  if (s.words < b.minWords || s.words > b.maxWords) v.push(`words ${s.words} outside ${b.minWords}-${b.maxWords}`);
  if (s.avgSentenceWords < b.minAvgSentence || s.avgSentenceWords > b.maxAvgSentence) v.push(`avg sentence ${s.avgSentenceWords.toFixed(1)} outside ${b.minAvgSentence}-${b.maxAvgSentence}`);
  if (s.fleschKincaid < b.minGrade || s.fleschKincaid > b.maxGrade) v.push(`FK grade ${s.fleschKincaid.toFixed(1)} outside ${b.minGrade}-${b.maxGrade}`);
  return v;
}
/** 학생 에세이 편집기의 단어 수 표시용. */
export const countWords = (t: string): number => (t.match(/\S+/g) ?? []).length;
