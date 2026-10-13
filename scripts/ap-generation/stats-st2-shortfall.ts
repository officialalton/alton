// ST2 부족분 계획(무료·DB 없음): 이미 쓰인 ST1 v2 항목을 막고, 아직 만들지 않은 "신규 시드" 후보(원형당 1, 같은 문항군)를 비용으로 더해 정수계획이 신규 문항을 최소로 쓰게 한다.
//   npx tsx scripts/ap-generation/stats-st2-shortfall.ts [--block-file <보고서.json>] [--exclude st_outlier_effect] [--hyp-cost 100] [--exam-bonus 0]
import { readFileSync } from "node:fs";
import { solveStatsSets, buildStatsOrder, type StatsResult } from "./stats-assign";
import { loadStatsPool, type StatsItem } from "./stats-pool";

const arg = (n: string, d = "") => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const block = new Set<string>();
for (const f of arg("--block-file", "data/ap/stock/assembled/stats-st1-s3a-prefer-ep.json").split(",").filter(Boolean)) for (const st of (JSON.parse(readFileSync(f, "utf-8")) as { sets: { mcA?: string[]; frqA?: string[] }[] }).sets) for (const k of [...(st.mcA ?? []), ...(st.frqA ?? [])]) block.add(k);
const { pool } = loadStatsPool({ requireScreen: true });
const excluded = new Set(arg("--exclude", "st_outlier_effect").split(",")); // 두 번 반려된 원형은 신규 후보에서 제외
type Raw = { apSubjectCode: string; kind: string; keywordCode: string; skillPrimary?: string; itemFamilyId: string; difficultyProvisional?: string; payload: { archetype?: string; items?: unknown[] } };
const obs = new Map<string, { unit: number; skill: number; exam: number; fam: string }>();
for (const f of ["stats-s1-items", "stats-s2a-items", "stats-s2b-items", "stats-s3a-items"]) for (const r of JSON.parse(readFileSync(`data/ap/stock/${f}.json`, "utf-8")) as Raw[]) {
  if (r.apSubjectCode !== "ap_statistics" || r.kind !== "mc" || r.payload.items) continue;
  const a = String(r.payload.archetype ?? ""); if (!a || excluded.has(a)) continue;
  const o = obs.get(a); const exam = r.difficultyProvisional === "exam_prep" ? 1 : 0;
  obs.set(a, { unit: Number(r.keywordCode.split(".")[0]), skill: Number(String(r.skillPrimary).charAt(0)), exam: Math.max(o?.exam ?? 0, exam), fam: o?.fam ?? r.itemFamilyId });
}
const famOf = new Map<string, string>(); for (const c of pool) if (c.archetype && !famOf.has(c.archetype)) famOf.set(c.archetype, c.fam);
const hyp: StatsItem[] = [...obs.entries()].map(([a, o]) => ({ key: `HYP:${a}`, kind: "mc", shared: false, members: [{ unit: o.unit, skill: o.skill, topic: "", skillCode: "" }], fam: famOf.get(a) ?? o.fam, frqType: "", archetype: a, screen: true, batch: "hyp", renderType: "", stimKind: "", exam: o.exam }));
// 신규 공유 세트(단원 5 회귀, 관측: 스킬 4·3·3, 문항 중 exam_prep 1)
hyp.push({ key: "HYP:st_set_regression", kind: "mc", shared: true, members: [4, 3, 3].map((s) => ({ unit: 5, skill: s, topic: "5.3", skillCode: "" })), fam: famOf.get("st_set_regression") ?? "hyp-set-regression", frqType: "", archetype: "st_set_regression", screen: true, batch: "hyp", renderType: "", stimKind: "", exam: 1 });
const bonus =Number(arg("--exam-bonus", "0")); const hypCost = Number(arg("--hyp-cost", "100"));
const m = solveStatsSets(["ST2"], [...pool, ...hyp], { timeMs: 120000, preferExamPrep: true, blocked: block, cost: (c) => (c.batch === "hyp" ? hypCost - bonus * (c.exam ?? 0) : 0) });
const r: StatsResult = m.out[0]; const used = r.singles.filter((c) => c.batch === "hyp");
console.log(`status=${m.res.status} obj=${m.res.obj}`);
console.log(`신규 단독 후보 ${used.length}`);
for (const c of used.sort((a, b) => a.members[0].unit - b.members[0].unit)) console.log(`  ${c.archetype} U${c.members[0].unit} S${c.members[0].skill} exam=${c.exam}`);
console.log(`가상 MC(단독) ${r.virtual.filter((v) => !v.fromSet).length}, 가상 세트 ${r.virtualSets.join(",")}, 세트 문항 가상 ${r.virtual.filter((v) => v.fromSet).length}, 가상 FRQ ${r.frqVirtual.map((v) => v.type).join(",")}`);
const ex = [...r.singles, ...r.sets].reduce((a, c) => a + (c.exam ?? 0), 0);
console.log(`기존 재고 단독 ${r.singles.length - used.length}, 세트 ${r.sets.length}, MC exam_prep(신규 포함) ${ex}/42`);
const u: Record<string, number> = {}; for (const it of buildStatsOrder(r)) u[it.unit] = (u[it.unit] ?? 0) + 1; console.log("단원", JSON.stringify(u));
const kk: Record<string, number> = {}; for (const c of r.virtual) { const k = `U${c.unit}S${c.skill}${c.fromSet ? "set" : ""}`; kk[k] = (kk[k] ?? 0) + 1; } console.log("가상 칸", JSON.stringify(kk));
