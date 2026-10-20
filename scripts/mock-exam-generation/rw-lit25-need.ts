// 문학 25% 조정(2026-10-19)용 비문학 R&W 신규 생성 필요량 산정. DB·API 호출 없음.
// rebalance-sets.ts 를 --force-plan 으로 돌린 계획(new-sets.json 은 재고 부족 시 빈 칸이 있는 불완전 세트, plan-report.json 의 litRelaxedInNewSets 는 문학 상한을 풀어야만 채운 칸)에서
//   필요량 = (새 세트 칸 수요 - 채운 문항) + 상한을 풀어 채운 문학 칸 + (T4~T9 문학 교체 NO_REPLACEMENT)
// 를 (영역 x 난이도)로 모은 뒤, skill 은 상대 블루프린트 비중으로(command_of_evidence_quant 는 표·그래프 자료 문항이라 생성하지 않음) 나누고,
// 과목은 계획된 10개 세트(T4~T9 + 새 세트)의 비문학 과목 목표 대비 부족분 큰 순으로 배정한다.
// 실행: npx tsx scripts/mock-exam-generation/rw-lit25-need.ts --plan DIR --dump D/dump.json --weights D/weights.json --topics D/topics.json --out need.json [--margin 0]
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { buildSlots, type Weights } from "./assemble-unique";
import { DOMAINS } from "./plan";
import { TARGET_MIX, SUBJECTS } from "./rw-topics-lib";

const arg = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
const plan = arg("--plan")!;
const W = JSON.parse(readFileSync(arg("--weights")!, "utf-8")) as Weights;
const topics = JSON.parse(readFileSync(arg("--topics")!, "utf-8")) as Record<string, { subject: string }>;
const newSets = JSON.parse(readFileSync(path.join(plan, "new-sets.json"), "utf-8")) as { problemId: string; domain: string; difficulty: string; skill: string | null; section: string }[][];
const report = JSON.parse(readFileSync(path.join(plan, "plan-report.json"), "utf-8"));
const swaps = JSON.parse(readFileSync(path.join(plan, "repair-plan.json"), "utf-8")) as { reason: string; status: string; domain: string; difficulty: string; skill: string | null; setName: string }[];
const litPct = Number(arg("--lit-pct") ?? 25);
const margin = Number(arg("--margin") ?? 0);

// 1) 새 세트: 칸 수요 vs 채운 R&W 문항
const demand = new Map<string, number>();
for (const sl of buildSlots(W, newSets.length)) if (sl.mod.section === "rw") demand.set(`${sl.cell.satDomain}|${sl.cell.difficulty}`, (demand.get(`${sl.cell.satDomain}|${sl.cell.difficulty}`) ?? 0) + sl.cell.targetCount);
const filled = new Map<string, number>();
for (const it of newSets.flat()) if (it.section === "rw") filled.set(`${it.domain}|${it.difficulty}`, (filled.get(`${it.domain}|${it.difficulty}`) ?? 0) + 1);
const need = new Map<string, number>(); // domain|difficulty
for (const [k, d] of demand) { const x = d - (filled.get(k) ?? 0); if (x > 0) need.set(k, x); }
const byId = new Map(newSets.flat().map((i) => [i.problemId, i]));
const relaxed: { skill: string; difficulty: string; domain: string }[] = [];
for (const r of (report.litRelaxedInNewSets ?? []) as string[]) { const id = r.split(" ")[0]; const it = byId.get(id); if (!it) continue; relaxed.push({ skill: String(it.skill), difficulty: it.difficulty, domain: it.domain }); const k = `${it.domain}|${it.difficulty}`; need.set(k, (need.get(k) ?? 0) + 1); }
// 2) 게시 세트(T4~T9) 문학 교체 불가
const noRepl = swaps.filter((s) => s.reason === "lit_excess" && s.status === "NO_REPLACEMENT");
for (const s of noRepl) { const k = `${s.domain}|${s.difficulty}`; need.set(k, (need.get(k) ?? 0) + 1); }

// 3) skill 배분 — 문학 상한을 풀어 채운 칸은 그 skill 을 그대로, 나머지는 블루프린트 비중(생성 불가 skill 제외)
const SKIP = new Set(["command_of_evidence_quant"]);
const skillCell = new Map<string, number>(); // skill|difficulty
const direct = new Map<string, number>(); for (const r of [...relaxed, ...noRepl.map((s) => ({ skill: String(s.skill), difficulty: s.difficulty, domain: s.domain }))]) { if (SKIP.has(r.skill)) continue; const k = `${r.skill}|${r.difficulty}`; direct.set(k, (direct.get(k) ?? 0) + 1); }
for (const [k, v] of direct) skillCell.set(k, v);
for (const [dd, total] of need) {
  const [domain, diff] = dd.split("|"); const dom = DOMAINS.find((d) => d.domain === domain)!;
  const already = [...direct].filter(([k]) => dom.skills.some((s) => k.startsWith(s.code + "|")) && k.endsWith("|" + diff)).reduce((a, [, v]) => a + v, 0);
  const inQuant = [...relaxed, ...noRepl.map((s) => ({ skill: String(s.skill), difficulty: s.difficulty, domain: s.domain }))].filter((r) => r.domain === domain && r.difficulty === diff && SKIP.has(r.skill)).length;
  let rest = total - already - inQuant; if (rest <= 0) continue;
  const sk = dom.skills.filter((s) => !SKIP.has(s.code)); const sw = sk.reduce((a, s) => a + s.w, 0);
  const ent = sk.map((s) => ({ s, x: (rest * s.w) / sw })); const base = ent.map((e) => ({ ...e, n: Math.floor(e.x) })); let left = rest - base.reduce((a, e) => a + e.n, 0);
  for (const e of [...base].sort((a, b) => (b.x - b.n) - (a.x - a.n))) { if (left <= 0) break; e.n++; left--; }
  for (const e of base) if (e.n > 0) skillCell.set(`${e.s.code}|${diff}`, (skillCell.get(`${e.s.code}|${diff}`) ?? 0) + e.n);
}
// 4) 과목 배정: 10개 세트의 비문학 과목 목표 대비 부족분
const mix: Record<string, number> = Object.fromEntries(SUBJECTS.map((s) => [s, s === "literature_fiction" ? litPct : (TARGET_MIX[s] * (100 - litPct)) / (100 - TARGET_MIX.literature_fiction)]));
const planSets = [...(report.perSet as { name: string; kind: string; subjects: Record<string, number> }[])].filter((s) => /Test (4|5|6|7|8|9|27|28|29|30)$/.test(s.name));
const cur: Record<string, number> = {}; let totalRw = 0;
for (const s of planSets) for (const [k, v] of Object.entries(s.subjects)) { cur[k] = (cur[k] ?? 0) + v; totalRw += v; }
const nNew = [...skillCell.values()].reduce((a, b) => a + b, 0); const finalRw = 81 * planSets.length;
// 새 세트의 문학 상한 초과분은 비문학으로 바뀌므로 현재 문학 수에서 빼 둔다.
cur.literature_fiction = Math.min(cur.literature_fiction ?? 0, Math.round((litPct / 100) * finalRw));
const out: { cell: string; need: Record<string, number>; total: number }[] = [];
const assigned: Record<string, number> = {};
const cells = [...skillCell].sort((a, b) => b[1] - a[1]);
for (const [cell, n] of cells) {
  const per: Record<string, number> = {};
  for (let i = 0; i < n; i++) {
    const best = SUBJECTS.filter((s) => s !== "literature_fiction").map((s) => ({ s, deficit: (mix[s] / 100) * finalRw - (cur[s] ?? 0) - (assigned[s] ?? 0) })).sort((a, b) => b.deficit - a.deficit)[0].s;
    per[best] = (per[best] ?? 0) + 1; assigned[best] = (assigned[best] ?? 0) + 1;
  }
  out.push({ cell, need: per, total: n });
}
writeFileSync(arg("--out")!, JSON.stringify({ note: "문학 25% 조정 비문학 R&W 필요량(margin 은 cands 단계의 factor 가 처리)", totalNeed: nNew, byDomainDifficulty: Object.fromEntries(need), relaxedLit: relaxed.length, noReplacementPubSets: noRepl.length, perCell: out }, null, 1));
console.log(JSON.stringify({ totalNeed: nNew, byDomainDifficulty: Object.fromEntries(need), assigned, margin, totalRw }, null, 1));
