// 조합 단위 개발용 스윕 — ITEMS=<조합ID 접두,…> 일 때만 돈다(평소 건너뜀). 병렬 에이전트가 자기 조합만 빠르게 확인하는 도구(게이트 G4~G8 과 같은 판정).
//   ITEMS=linear_functions.evaluate.TB.P N=200 npx vitest run lib/problem-generation/math-archetypes/figure-item-sweep.test.ts --project unit
import { describe, expect, it } from "vitest";
import { figureArchetypes, sweepFigureArchetype } from "./figure-coverage-gate";
import { sprCapability } from "./spr-capability";

describe.skipIf(!process.env.ITEMS)("조합 단위 스윕", () => {
  it("ITEMS 의 모든 원형 × 형식", () => {
    const pre = (process.env.ITEMS ?? "").split(","); const bad: string[] = [];
    for (const a of figureArchetypes().filter((x) => pre.some((p) => x.figureItem!.startsWith(p)))) {
      const fmts = a.level === "hard" && sprCapability(a).capable ? (["mc", "spr"] as const) : (["mc"] as const);
      for (const f of fmts) {
        const r = sweepFigureArchetype(a, Number(process.env.N ?? 60), f, { mutationSeeds: 12 });
        const ng = r.genFail || r.thrown || r.verifyFail || r.qaFail || r.produced === 0 || r.mutantsCaught / Math.max(1, r.mutants) < 0.97 || r.keyCaught < r.keyTotal || r.dup200 > Math.ceil(Math.min(200, r.produced) * 0.02);
        const line = `${ng ? "XX" : "ok"} ${a.id}(${f}) prod ${r.produced} gf ${r.genFail} th ${r.thrown} vf ${r.verifyFail} qa ${r.qaFail} mut ${r.mutantsCaught}/${r.mutants} key ${r.keyCaught}/${r.keyTotal} dup ${r.dup200} ind ${r.independent} slots ${r.slots.join("/")}`;
        console.log(ng ? `${line}\n   ${[...r.failSamples, ...r.qaSamples].join("\n   ")}` : line); if (ng) bad.push(a.id);
      }
    }
    expect(bad).toEqual([]);
  }, 1_800_000);
});
