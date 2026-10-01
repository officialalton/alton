// 자료 원형 조합(항목) 정의 DSL — 조합 하나 = 파일 하나(`items/<조합ID>.ts`)가 hard 4(서로 다른 연산자) + easy/medium 틀을 이 함수로 선언한다.
// 원형 id = `<접두>.<kind>.<자료코드>.<위치>.<연산자 | easy_이름 | med_이름>`, Archetype.kind = `<kind>.<자료코드>.<위치>`(기존 skill.kind 당 hard 4 테스트가 그대로 적용).
// 파일럿(two_variable_data)의 규칙을 그대로 따른다: 수치 먼저 → figure → 지문은 값을 되풀이하지 않고 "the table shown" 으로 가리킨다. 정보는 자료에만 있다.
import type { Instance, OperatorId } from "../../types";
import type { Rng } from "../../rng";
import { asLevel, type LArch } from "../../levels-d";

export const SPR_OK = "정답이 하나의 수(정수·소수·분수)이고 질문이 선택지를 가리키지 않아 선택지 없이 낼 수 있다";
export type HardDef = { op: OperatorId; structure: string; extra: string; concepts: string[]; /** 생략하면 SPR 가능(SPR_OK). 불가면 사유 문자열. */ sprNo?: string; gen: (rng: Rng) => Instance };
export type EmDef = { lv: "easy" | "medium"; name: string; structure: string; extra: string; concepts: string[]; sprNo?: string; gen: (rng: Rng) => Instance };
export type ItemDef = { prefix: string; itemId: string; mediumSteps?: number; hard: HardDef[]; em: EmDef[] };

export function defineItem(d: ItemDef): LArch[] {
  const [skill, kind, fig, loc] = d.itemId.split(".");
  const base = `${d.prefix}.${kind}.${fig}.${loc}`; const k = `${kind}.${fig}.${loc}`;
  const spr = (no?: string) => ({ capable: !no, reason: no ?? SPR_OK });
  const hard = d.hard.map((h) => asLevel({ id: `${base}.${h.op}`, skill, kind: k, operator: h.op, structure: h.structure, extraThinking: h.extra, concepts: h.concepts, mediumSteps: d.mediumSteps ?? 3, figureItem: d.itemId, spr: spr(h.sprNo), generate: (rng) => h.gen(rng) }));
  const em = d.em.map((e) => asLevel({ id: `${base}.${e.lv === "easy" ? "easy" : "med"}_${e.name}`, skill, kind: k, operator: "repr_shift" as OperatorId, structure: e.structure, extraThinking: e.extra, concepts: e.concepts, mediumSteps: e.lv === "easy" ? 1 : 2, figureItem: d.itemId, spr: spr(e.sprNo), generate: (rng) => e.gen(rng) }, e.lv));
  return [...hard, ...em];
}
