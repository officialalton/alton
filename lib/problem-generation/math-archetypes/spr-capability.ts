// SPR 가능 여부 판정 — 원형 선언(spr)이 있으면 그것을, 없는 옛 원형은 시드 프로브로 판정한다(결과는 보고서에 '프로브 판정'으로 표시).
import type { Archetype } from "./types";
import { generateOne } from "./sweep";

export type SprCap = { capable: boolean; reason: string; declared: boolean };
const cache = new Map<string, SprCap>();
const PROBE_SEEDS = 30, PROBE_MIN = 15;

export function sprCapability(a: Archetype): SprCap {
  if (a.spr) return { ...a.spr, declared: true };
  const hit = cache.get(a.id); if (hit) return hit;
  let ok = 0; let why = "";
  for (let s = 0; s < PROBE_SEEDS; s++) { const g = generateOne(a, s, "spr"); if (g.ok) ok++; else if (!why && g.why === "genfail") why = g.msg; }
  const capable = ok >= PROBE_MIN;
  const r: SprCap = { capable, declared: false, reason: capable ? `프로브 판정: 시드 ${PROBE_SEEDS}개 중 ${ok}개가 SPR 로 변환됨` : `프로브 판정: 시드 ${PROBE_SEEDS}개 중 ${ok}개만 SPR 로 변환됨(${why.slice(0, 60) || "정답이 수치가 아니거나 그리드 표현 불가"})` };
  cache.set(a.id, r); return r;
}
export const levelOf = (a: Archetype): "easy" | "medium" | "hard" => (a as { level?: "easy" | "medium" | "hard" }).level ?? a.difficulty ?? "hard";
