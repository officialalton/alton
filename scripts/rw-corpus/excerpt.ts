// 발췌 후보 자동 추출(초안, 순수 함수 + 얇은 실행 래퍼). 코퍼스 본문 파일에서 '자족적 지문 후보'(SAT 지문 길이)를 뽑는다. 실행은 총괄 승인 후.
// 규칙(문서: docs/qa/2026-10-01-rw-source-corpus-plan.md §C):
//  - 문단 경계·문장 경계에서만 자른다(문장 중간 절단 금지), 2~8개 연속 문장, 단어 수 60~150(빈칸형은 별도 25~90).
//  - 자족성: 첫 문장이 대명사·접속사(He/She/It/They/This/That/But/And/However/Then/Yet/So)로 시작하면 제외, 따옴표 짝 불일치 제외,
//    각주·장 제목·목차 표시([1], CHAPTER, *, ——) 포함 제외, 숫자·기호 비율이 높으면 제외, 마지막 문장이 종결 부호로 끝나지 않으면 제외.
//  - 고어·문체: 고어 어휘(thou/thee/hath 등)가 있는 후보는 제외(현대 영어와의 차이 완화).
//  - 출력은 위치(오프셋)와 해시뿐 — 본문은 이 스크립트가 저장소에 쓰지 않는다.
import { createHash } from "node:crypto";
import { verifyExcerpt } from "./quote-verify";
import type { Excerpt } from "./schema";

const OPENERS = /^(he|she|it|they|this|that|these|those|but|and|however|then|yet|so|also|thus|therefore|moreover)\b/i;
const ARCHAIC = /\b(thou|thee|thy|thine|hath|doth|ere|o'er|whence|whither|verily)\b/i;
const NOISE = /(\[\d+\]|\bCHAPTER\b|\*\*\*|^\s*[-=_]{3,}|Illustration|_{2,})/m;
const words = (s: string) => s.split(/\s+/).filter(Boolean).length;

export type Paragraph = { start: number; end: number; text: string };
export function paragraphs(src: string): Paragraph[] {
  const out: Paragraph[] = [];
  const re = /\S[\s\S]*?(?=\n\s*\n|$)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) { const text = m[0]; if (text.trim()) out.push({ start: m.index, end: m.index + text.length, text }); if (m[0].length === 0) re.lastIndex++; }
  return out;
}
export function sentences(p: Paragraph): { start: number; end: number; text: string }[] {
  const out: { start: number; end: number; text: string }[] = [];
  const re = /[^.!?]+[.!?]+["')\]]*\s*/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(p.text)) !== null) { const t = m[0].trimEnd(); if (t.trim()) out.push({ start: p.start + m.index, end: p.start + m.index + t.length, text: t }); }
  return out;
}
export function isSelfContained(text: string): boolean {
  const first = text.trimStart();
  if (OPENERS.test(first)) return false;
  if (NOISE.test(text)) return false;
  if (ARCHAIC.test(text)) return false;
  if (((text.match(/"/g) ?? []).length % 2) === 1) return false; // 따옴표 짝 불일치
  if (!/[.!?]["')\]]?\s*$/.test(text.trim())) return false;
  const digits = (text.match(/[0-9]/g) ?? []).length;
  if (digits / Math.max(1, text.length) > 0.03) return false;
  return true;
}
export type Options = { minWords: number; maxWords: number; minSentences: number; maxSentences: number };
export const DEFAULT_OPTIONS: Options = { minWords: 60, maxWords: 150, minSentences: 2, maxSentences: 8 };
/** 문단 안에서 연속 문장 창을 만들어 조건에 맞는 후보를 돌려준다(문단당 최대 perParagraph 개, 겹치지 않게). */
export function candidatesFromText(src: string, corpusId: string, opt: Options = DEFAULT_OPTIONS, perParagraph = 1): Excerpt[] {
  const out: Excerpt[] = [];
  for (const p of paragraphs(src)) {
    const ss = sentences(p);
    let taken = 0;
    for (let i = 0; i < ss.length && taken < perParagraph; i++) {
      for (let j = i + opt.minSentences - 1; j < Math.min(ss.length, i + opt.maxSentences); j++) {
        const text = src.slice(ss[i].start, ss[j].end);
        const w = words(text);
        if (w > opt.maxWords) break;
        if (w < opt.minWords || !isSelfContained(text)) continue;
        // 자기 검증: 코드가 만든 발췌는 원문에서 글자 그대로 나와야 한다(오프셋 오류 차단).
        if (!verifyExcerpt(src, text).ok) continue;
        out.push({ corpusId, startChar: ss[i].start, endChar: ss[j].end, elisions: [], wordCount: w, textSha256: createHash("sha256").update(text).digest("hex"), editorialChanges: [], verifiedAt: new Date().toISOString(), verifiedBy: "code:quote-match-v1" });
        taken++;
        i = j;
        break;
      }
    }
  }
  return out;
}
