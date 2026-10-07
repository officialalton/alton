// SPR 독립 그룹 보강(G10, 브랜치 fix/spr-groups-b) 공용 도구 — 원형 하나가 서로 다른 풀이 구조의 변형(= 유사문항 그룹) 여러 개를 가진다.
// 변형은 질문하는 양·풀이 경로·장면이 서로 다르다(숫자 범위만 바꾼 복제 금지). 정답은 모두 수치이고 verificationJs 가 인쇄된 수만으로 다른 경로로 다시 계산한다.
import { GenFail, type Archetype, type OperatorId } from "./types";
import { finish, type Draft } from "./text";
import type { Rng } from "./rng";
import type { DistractorKind } from "../review";
import { withOpen, OPEN_GEN } from "./c-kit";

export const T = (ko: string, en: string): [string, string] => [ko, en];
export const W = (v: number, kind: DistractorKind, reason: string) => ({ v, kind, reason });
export type VFn = (rng: Rng) => Omit<Draft, "variant">;
export type MultiSpec = { id: string; skill: string; kind: string; operator: OperatorId; structure: string; extraThinking: string; concepts: string[]; mediumSteps: number; variants: Record<string, VFn> };
export function multi(o: MultiSpec): Archetype {
  const names = Object.keys(o.variants);
  return {
    id: o.id, skill: o.skill, kind: o.kind, operator: o.operator, structure: o.structure, extraThinking: o.extraThinking, concepts: o.concepts, mediumSteps: o.mediumSteps,
    spr: { capable: true, reason: "정답이 그리드에 들어가는 양의 정수이고 질문이 선택지를 가리키지 않는다" },
    generate(rng) {
      const name = rng.pick(names);
      const d = o.variants[name](rng);
      if (!Number.isInteger(d.correct) || (d.correct as number) <= 0 || (d.correct as number) > 9999) throw new GenFail("정답이 1~9999 정수가 아님");
      return finish(rng, { ...d, stimulus: withOpen(rng, OPEN_GEN, d.stimulus), variant: name });
    },
  };
}
export { GenFail };
