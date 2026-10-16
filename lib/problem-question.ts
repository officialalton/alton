// 질문(question) 을 지문/자료(passage)와 분리해 다룬다(2026-09-14 제품 오너 지시 — 복수 생성의 질문 누락 수정).
//
//   * 새 버전은 problem_versions.question 에 질문을 따로 저장한다.
//   * 옛 버전(question null)은 지문 안의 마지막 질문 단락을 그대로 읽는다(레거시 유지, 자동 수정 없음).
//   * 렌더·검증은 항상 "지문 + 빈 줄 + 질문" 한 덩어리로 본다 — RW 구조 검사(lib/rw-stimulus)와 그림 참조 검사가 그 텍스트를 읽는다.
import { isQuestionParagraph, parseRwStimulus } from "./rw-stimulus";

/** 저장된 지문과 질문을 화면·검증용 한 덩어리로 합친다. 질문이 없으면 지문 그대로. */
export function composeProblemText(passage: string | null | undefined, question: string | null | undefined): string {
  const p = (passage ?? "").trim();
  const q = (question ?? "").trim();
  if (!q) return p;
  if (!p) return q;
  return `${p}\n\n${q}`;
}

/** 옛 지문에서 질문 문장을 갈라낸다. 없으면 question=null. */
export function splitLegacyQuestion(passage: string | null | undefined): { passage: string; question: string | null } {
  const text = (passage ?? "").trim();
  if (!text) return { passage: "", question: null };
  const s = parseRwStimulus(text);
  if (!s.question) return { passage: text, question: null };
  if (s.blocks.length === 1) return { passage: "", question: s.question };
  const idx = text.lastIndexOf(s.question);
  return { passage: (idx > 0 ? text.slice(0, idx) : text).trim(), question: s.question };
}

/** 질문이 있는가 — 분리된 question 이 있거나 지문 안에 물음 문장이 있다(DB problem_version_has_question 과 같은 뜻). */
export function hasQuestion(passage: string | null | undefined, question: string | null | undefined): boolean {
  if ((question ?? "").trim()) return true;
  const text = (passage ?? "").trim();
  if (!text) return false;
  if (/\?\s*$/.test(text)) return true;
  return parseRwStimulus(text).question !== null || isQuestionParagraph(text);
}

/** 화면에 보일 질문 문장 — 분리 저장분이 있으면 그것, 없으면 지문에서 갈라낸다. */
export function effectiveQuestion(passage: string | null | undefined, question: string | null | undefined): string | null {
  if ((question ?? "").trim()) return (question ?? "").trim();
  return splitLegacyQuestion(passage).question;
}
