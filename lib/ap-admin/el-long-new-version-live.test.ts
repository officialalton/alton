import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseSwapPlan, resolveSwaps } from "./new-version";
import { checkNewVersionComposition, type NewVersionContext, type SlotItem } from "../mock-exam/new-version";

// 2026-10-15 라이브 DB 의 SELECT 스냅샷(공개 EL1·EL2 v3 슬롯, 후보 메타, el-long 새 문제)으로 관리자 새 버전 미리보기와 같은 경로(resolveSwaps → checkNewVersionComposition)를 재생한다.
// 재편 계획은 옛 세트(예: r23)를 크기가 다른 새 묶음 둘에 걸쳐 바꾸므로 예전 'set_replacement_split' 검사에 걸렸다(실제 미리보기 위반).
type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const snap = JSON.parse(readFileSync("lib/ap-admin/__fixtures__/el-long-live-snapshot.json", "utf-8")) as { slots: Json[]; cands: Json[]; newProblems: Json[] };
const meta = new Map(snap.cands.map((c) => [c.candidate_key as string, c]));
const brief = (key: string | null) => { const c = key ? meta.get(key) : undefined; return { candidateKey: key, kind: (c?.kind === "mc" ? "mc" : c?.kind ? "frq" : null) as "mc" | "frq" | null, unit: (c?.keyword_code as string | undefined)?.split(".")[0] ?? null, family: (c?.item_family_id as string | undefined) ?? null, calculator: (c?.calculator as string | undefined) ?? null }; };
const assign = JSON.parse(readFileSync("data/ap/stock/exact-assign-el-long-el1-el2.json", "utf-8")).sets as Json[];

function replay(name: string, planFile: string) {
  const src = snap.slots.filter((s) => s.name === name); const slots: SlotItem[] = src.map((s) => ({ section: s.section, position: s.position, problemId: s.problem_id, ...brief(s.key) }));
  const res = resolveSwaps(parseSwapPlan(JSON.parse(readFileSync(planFile, "utf-8"))).swaps, slots.map((s) => ({ section: s.section, position: s.position, candidateKey: s.candidateKey })));
  const byKey = new Map<string, string[]>(); for (const p of [...snap.newProblems].sort((a, b) => a.item_index - b.item_index)) byKey.set(p.key, [...(byKey.get(p.key) ?? []), p.problem_id]);
  const probFor = (sw: { addKey: string; addIndex?: number }) => byKey.get(sw.addKey)?.[sw.addIndex ?? 0];
  const actionSwaps = res.swaps.map((s) => ({ section: s.section, position: s.position, problemId: probFor(s)! }));
  const ctx: NewVersionContext = { apLabel: "full_practice", sectionCalculator: { ap_mc: "na", ap_frq: "na" }, usedByOtherExams: new Set(), setSizes: new Map([...byKey].map(([k, ids]) => [k, ids.length] as [string, number])),
    replacements: new Map(res.swaps.map((s) => [probFor(s)!, { problemId: probFor(s)!, ...brief(s.addKey) }])) };
  return { slots, res, actionSwaps, out: checkNewVersionComposition(slots, actionSwaps, ctx) };
}
describe("EL long-passage regroup plans against the live snapshot", () => {
  for (const [id, name] of [["EL1", "AP English Language — Practice Exam 1"], ["EL2", "AP English Language — Practice Exam 2"]] as const) {
    it(`${id}: plan resolves, passes the composition check, and the result equals the assignment`, () => {
      const r = replay(name, `data/ap/stock/${id.toLowerCase()}-long-v4-swap-plan.json`);
      expect(r.res.problems).toEqual([]); expect(r.out.issues).toEqual([]);
      const keys: string[] = []; for (const it of [...r.out.items].filter((i) => i.section === "ap_mc").sort((a, b) => a.position - b.position)) { if (it.candidateKey && !keys.includes(it.candidateKey)) keys.push(it.candidateKey); }
      const want = (assign.find((s) => s.id === id)!.mcA as string[]); expect(keys.slice().sort()).toEqual(want.slice().sort());
      // 짧은 묶음은 제자리, FRQ 는 그대로
      const sw = new Set(r.res.swaps.map((s) => `${s.section}:${s.position}`)); expect(r.slots.filter((s) => s.section === "ap_frq").some((s) => sw.has(`${s.section}:${s.position}`))).toBe(false);
      expect(r.slots.filter((s) => s.section === "ap_mc").length).toBe(45);
    });
  }
});
