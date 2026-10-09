// AP 문항의 자료 텍스트(passage)는 변환 때 stimulus.description 에서 온다. 그림·표가 없는 text 자료의 description 은 대개 본문(stem)이 이미 말한 모델·상황의 요약이라
// 학생 화면에 그대로 두면 본문 위에 원문 TeX 가 섞인 같은 문장이 한 번 더 나온다(2026-10-09 리뷰 환경 점검). 본문과 겹치는 자료 텍스트는 숨기고, 남는 것은 수식을 입혀 그린다.
import { autoMathExplanation } from "./explanation-math";

const words = (t: string): string[] => (t.replace(/\$[^$]*\$/g, " ").toLowerCase().match(/[a-z]{3,}/g) ?? []);
const norm = (t: string) => t.replace(/\\[a-z]+|[\s$\\{}]/gi, "").toLowerCase().replace(/[^a-z0-9<>=+\-*/^().]/g, "");

/** 본문과 실질적으로 같은 내용이면 true(단어 80% 이상이 본문에 있거나, 수식 문자열이 본문에 그대로 들어 있음). */
export function passageDuplicatesStem(passage: string, stem: string): boolean {
  const pw = words(passage); if (!pw.length) return norm(passage).length > 0 && norm(stem).includes(norm(passage));
  const sw = new Set(words(stem));
  const hit = pw.filter((w) => sw.has(w) || [...sw].some((s) => s.startsWith(w.slice(0, 5)) && w.length >= 5)).length;
  return hit / pw.length >= 0.8;
}
/** 화면에 그릴 자료 텍스트(없으면 null). */
export function apPassageForDisplay(passage: string | null | undefined, stem: string | null | undefined): string | null {
  const p = (passage ?? "").trim(); if (!p) return null;
  if (passageDuplicatesStem(p, stem ?? "")) return null;
  return autoMathExplanation(p);
}
