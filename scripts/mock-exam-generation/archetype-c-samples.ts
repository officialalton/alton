// C 담당 원형 Preview 육안 확인용 샘플(원형당 2건: hard 는 2건, lite 는 easy·medium 각 1건)과 skill × 난이도 생산 가능 수량표. DB·API 없음.
// 실행: npx tsx scripts/mock-exam-generation/archetype-c-samples.ts [--out data/mock-exam-generation/math-archetype-C] [--supply]
// Preview 확인: npx tsx scripts/mock-exam-generation/import.ts --file <out>/passed.json --tag math-archetype-C   (총괄이 대상 DB 를 지정)
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { ARCHETYPES } from "../../lib/problem-generation/math-archetypes/registry";
import { LITE_C_ARCHETYPES } from "../../lib/problem-generation/math-archetypes/lite-c";
import { produceFromArchetypes, type PassedRecord } from "../../lib/problem-generation/math-archetypes/bulk";
import { generateOne } from "../../lib/problem-generation/math-archetypes/sweep";
import { generateLite, produceFromLite } from "../../lib/problem-generation/math-archetypes/c-lite";
import { semNoteOf } from "../../lib/problem-generation/math-archetypes/c-kit";
const arg = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
const out = path.resolve(arg("--out") ?? "data/mock-exam-generation/math-archetype-C"); mkdirSync(out, { recursive: true });
const C_SKILLS = ["percentages", "area_volume", "circles", "ratios_rates_units", "probability"];
const HARD_C = ARCHETYPES.filter((a) => ["percentages", "area_volume", "circles"].includes(a.skill));
const records: PassedRecord[] = []; const rows: string[] = ["archetype\tdifficulty\tseed\tgid\tsubpattern\t의미 일치 점검 포인트(수=수량 명사, ask=질문의 양)\t지문 미리보기"];
const GUIDE: Record<string, string> = { percentages: "퍼센트가 가리키는 기준량(전체·처음 값·남은 값)과 문장의 집단·방향어(증가/감소)가 일치하는지", area_volume: "수치가 가로·세로·높이·반지름·지름·넓이·부피 중 무엇인지와 질문의 양(넓이/부피/겉넓이)이 일치하는지", circles: "반지름/지름·둘레/넓이·호/부채꼴·중심각/원주각 서술이 수치와 일치하는지", ratios_rates_units: "비·축척·단위 환산의 방향(곱/나눔)과 묻는 단위가 일치하는지", probability: "분모(전체/조건 집단)와 묻는 사건이 문장과 일치하는지" };
const note = (skill: string, n: string) => n || `기계 검사 대상 아님 — 육안: ${GUIDE[skill] ?? ""}`;
const clip = (s: string) => s.replace(/\s+/g, " ").slice(0, 110);
for (const a of HARD_C) {
  const { records: rs } = produceFromArchetypes([a], { runId: "math-archetype-C", count: 2, seedStart: 0 });
  for (const r of rs) { const seed = (r.quality as { mockExamGeneration: { seed: number } }).mockExamGeneration.seed; const g = generateOne(a, seed); records.push(r); rows.push([a.id, "hard", seed, r.gid, r.subpattern, g.ok ? note(a.skill, semNoteOf(g.inst)) : "", g.ok ? clip(g.inst.stimulus.split(". ").slice(1).join(". ")) : ""].join("\t")); }
}
for (const a of LITE_C_ARCHETYPES) for (const lv of a.levels) {
  const { records: rs } = produceFromLite([a], lv, { runId: "math-archetype-C", count: 1, seedStart: 0 });
  for (const r of rs) { const seed = (r.quality as { mockExamGeneration: { seed: number } }).mockExamGeneration.seed; const g = generateLite(a, lv, seed); records.push(r); rows.push([a.id, lv, seed, r.gid, r.subpattern, g.ok ? note(a.skill, semNoteOf(g.inst)) : "", g.ok ? clip(g.inst.stimulus.split(". ").slice(1).join(". ")) : ""].join("\t")); }
}
writeFileSync(path.join(out, "passed.json"), JSON.stringify(records, null, 1)); writeFileSync(path.join(out, "samples.tsv"), rows.join("\n") + "\n"); console.log(`records ${records.length} -> ${out}`);

if (process.argv.includes("--supply")) {
  // 생산 가능 수량: 본문 유사도 0.6 미만 + 그룹(원형/변형)당 30 상한(모의고사 30세트, 세트당 그룹 1문항) 아래에서 skill × 난이도별로 뽑을 수 있는 최대 개수
  const need: Record<string, [number, number, number]> = { percentages: [10, 30, 10], area_volume: [20, 50, 10], circles: [10, 40, 10], ratios_rates_units: [10, 30, 10], probability: [10, 30, 0] };
  const rowsS: unknown[] = [];
  for (const skill of C_SKILLS) {
    const lite = LITE_C_ARCHETYPES.filter((a) => a.skill === skill); const hard = ARCHETYPES.filter((a) => a.skill === skill);
    const e = produceFromLite(lite, "easy", { runId: "supply", count: 6000, maxAttemptsPerItem: 4 }); const m = produceFromLite(lite, "medium", { runId: "supply", count: 6000, maxAttemptsPerItem: 4 }); const h = hard.length ? produceFromArchetypes(hard, { runId: "supply", count: 6000, maxAttemptsPerItem: 4 }) : null;
    rowsS.push({ skill, need: { easy: need[skill][0], medium: need[skill][1], hard: need[skill][2] }, supply: { easy: e.stats.accepted, medium: m.stats.accepted, hard: h?.stats.accepted ?? 0 }, groups: { easy: Object.keys(e.stats.byGroup).length, medium: Object.keys(m.stats.byGroup).length, hard: h ? Object.keys(h.stats.byGroup).length : 0 }, archetypes: { lite: lite.length, hard: hard.length } });
    console.log(JSON.stringify(rowsS[rowsS.length - 1]));
  }
  writeFileSync(path.join(out, "supply.json"), JSON.stringify(rowsS, null, 1));
}
