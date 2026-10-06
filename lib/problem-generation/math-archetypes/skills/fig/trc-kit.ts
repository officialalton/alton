// 삼각형(TR) 선택지형(C) 키트 — 선택지 4개가 삼각형 그림(각 라벨이 숫자)이고 지문의 조건을 만족하는 그림을 고른다.
// 모든 선택지는 실제 삼각형이다(세 각의 합 180°) — 그림은 라벨대로 그려지고 angles[].value 는 라벨과 같다. 정답 판정은 CHOICES 의 라벨만 읽는다.
// 오답 규칙: 각 자리 맞바꿈(swap_AB·swap_AC·swap_BC)·순환(rotate)·두 각 사이 이동(shift)·항목별 오독 규칙 — 모두 diagnoseJs 가 라벨만 보고 판정한다.
import { GenFail } from "../../types";
import type { Rng } from "../../rng";
import { placeChoices } from "../../figure-kit";
import type { Tri3 } from "./tri-kit";

export type TriFig = { type: "triangle"; vertices: Tri3; kind: "scalene" | "isosceles"; sides?: { between: [string, string]; tick: 1 }[]; angles: { at: string; label: string; value: number }[] };
export const angLab = (n: number) => `${n}°`;
/** 세 각(vertices 순서)이 숫자로 라벨된 삼각형 그림. */
export function scaleneFig(v: Tri3, t: [number, number, number]): TriFig { return { type: "triangle", vertices: v, kind: "scalene", angles: v.map((n, i) => ({ at: n, label: angLab(t[i]), value: t[i] })) }; }
/** 이등변 그림: apex 이름이 vertices[0], 나머지 둘이 밑각(눈금 한 개씩). t = {apex, base}. */
export function isoFig(apexName: string, others: [string, string], apex: number, base: number): TriFig {
  return { type: "triangle", vertices: [apexName, others[0], others[1]], kind: "isosceles", sides: [{ between: [apexName, others[0]], tick: 1 }, { between: [apexName, others[1]], tick: 1 }], angles: [{ at: apexName, label: angLab(apex), value: apex }, { at: others[0], label: angLab(base), value: base }, { at: others[1], label: angLab(base), value: base }] };
}
/** 라벨 → 이름별 각(JS). m(c)[이름]. */
export const M_JS = "const m=(x)=>{ const o={}; x.angles.forEach((g)=>{ const n=parseFloat(String(g.label)); if(!(n>0)) throw new Error('각 라벨 형식'); o[g.at]=n; }); return o; };";
/** 공통 오답 진단(자리 맞바꿈·순환·이동): 이름 N=P.v 의 정답과 비교. 항목별 규칙은 앞에 spec 로 끼운다. */
const PRELUDE = "const N=P.v; const a=m(c), b=m(ok);";
export const GENERIC_DIAG = "const df=N.filter((n)=>a[n]!==b[n]); if (df.length===0) return null; const sa=N.map((n)=>a[n]).sort().join(), sb=N.map((n)=>b[n]).sort().join(); if (sa===sb){ return df.length===2 ? 'swap_'+N.filter((n)=>df.includes(n)).join('') : 'rotate'; } if (df.length===2 && a[df[0]]+a[df[1]]===b[df[0]]+b[df[1]]) return 'shift'; return null;";
/** 이름 이름표(JS) — 진단 함수 본문 앞에 붙인다. */
export const diagBody = (spec = "") => `${M_JS}${PRELUDE}${spec}${GENERIC_DIAG}`;

const fn = (args: string[], body: string) => new Function(...args, body) as (...a: unknown[]) => unknown;
/** 후보 그림 중 조건을 만족하지 않고 진단 규칙이 서로 다른 3개를 골라 정답과 함께 섞는다. predBody(c,i,P)·diagBody(c,ok,P) 는 JS 본문(choiceInst 와 같은 형식). */
export function triChoices(rng: Rng, ok: TriFig, cands: TriFig[], P: Record<string, number | string | string[]>, predBody: string, diag: string): { choices: unknown[]; correctIndex: number; rules: string[] } {
  const pred = fn(["c", "i", "P"], `${M_JS}${predBody}`), dg = fn(["c", "ok", "P"], diag);
  const valid = (f: TriFig) => f.angles.every((g) => g.value >= 24 && g.value <= 126 && Number.isInteger(g.value)) && f.angles.reduce((s, g) => s + g.value, 0) === 180;
  if (!pred(ok, 0, P)) throw new GenFail("정답 그림이 조건을 만족하지 않음");
  const seen = new Set<string>([JSON.stringify(ok)]); const rules = new Set<string>(); const picked: { fig: unknown; rule: string }[] = [];
  for (const f of rng.shuffle(cands)) {
    if (picked.length >= 3) break; const k = JSON.stringify(f); if (seen.has(k) || !valid(f) || pred(f, 0, P)) continue;
    const rule = dg(f, ok, P) as string | null; if (!rule || rules.has(rule)) continue; seen.add(k); rules.add(rule); picked.push({ fig: f, rule });
  }
  if (picked.length < 3) throw new GenFail("삼각형 오답 후보 부족");
  return placeChoices(rng, ok, picked);
}
/** 정답 세 각 t(이름 v 순서)의 후보 오답들: 자리 맞바꿈·순환·두 각 사이 이동. */
export function genericTriCands(v: Tri3, t: [number, number, number]): TriFig[] {
  const out: TriFig[] = []; const perms = [[1, 0, 2], [2, 1, 0], [0, 2, 1], [1, 2, 0], [2, 0, 1]];
  for (const p of perms) out.push(scaleneFig(v, [t[p[0]], t[p[1]], t[p[2]]]));
  for (const [i, j] of [[0, 1], [0, 2], [1, 2]]) for (const d of [8, 12, 16, 20]) for (const s of [1, -1]) { const u: [number, number, number] = [...t] as [number, number, number]; u[i] += s * d; u[j] -= s * d; out.push(scaleneFig(v, u)); }
  return out;
}
