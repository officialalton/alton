// S1c(조건 누락 결함 탐지) 준비: 정상 문항과 주입 문항을 섞어 pipeline2 가 읽는 run 디렉터리를 만든다. 정답표(truth)는 별도 파일에만 둔다.
//   npx tsx scripts/ap-generation/s1c-prepare.ts --run s1c --defects 20 --controls 30 --seed 7
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { inject, MISSING_CONDITION_ARCHETYPES } from "../../lib/ap-generation/defect-injection";
import type { McPack } from "../../lib/ap-generation/gates";

const arg = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const RUN = arg("--run", "s1c"); const ND = Number(arg("--defects", "20")); const NC = Number(arg("--controls", "30")); let seed = Number(arg("--seed", "7"));
const exclude = new Set((arg("--exclude", "")).split(",").filter(Boolean)); // 이전 라운드에 쓴 stockKey(새 사례 확보용)
const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
const shuffle = <T,>(a: T[]) => { const x = [...a]; for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; } return x; };
type It = { stockKey: string; apSubjectCode: string; kind: string; validation: string; run: string; unitCode: string; keywordCode: string; skillPrimary: string; calculator: string; payload: McPack };
const items = (JSON.parse(readFileSync("data/ap/stock/items.json", "utf-8")) as It[]).filter((i) => i.validation === "auto_passed" && i.kind === "mc" && i.apSubjectCode === "ap_calculus_ab" && i.run !== "run1" && i.payload.explanation_en && !exclude.has(i.stockKey));
const inj = shuffle(items.filter((i) => MISSING_CONDITION_ARCHETYPES.includes(i.payload.archetype)));
// 원형별로 돌아가며 결함 후보를 뽑는다(원형 쏠림 방지)
const byA = new Map<string, It[]>(); for (const i of inj) (byA.get(i.payload.archetype) ?? byA.set(i.payload.archetype, []).get(i.payload.archetype)!).push(i);
const defects: It[] = []; for (let round = 0; defects.length < ND && round < 10; round++) for (const l of byA.values()) if (l[round] && defects.length < ND) defects.push(l[round]);
const used = new Set(defects.map((d) => d.stockKey));
// 정상 대조군: 결함 원형과 같은 원형 우선(구조 유사), 부족분은 다른 원형에서
const sameA = shuffle(items.filter((i) => !used.has(i.stockKey) && byA.has(i.payload.archetype)));
const rest = shuffle(items.filter((i) => !used.has(i.stockKey) && !byA.has(i.payload.archetype)));
const controls = [...sameA, ...rest].slice(0, NC);
const rows = shuffle([...defects.map((i) => ({ i, defect: true })), ...controls.map((i) => ({ i, defect: false }))]);
const cells: unknown[] = []; const packs: Record<string, unknown[]> = {}; const truth: Record<string, unknown> = {};
rows.forEach(({ i, defect }, n) => {
  const cellId = `${RUN}-${String(n + 1).padStart(2, "0")}`; const p = defect ? inject(i.payload, "missing_condition")! : JSON.parse(JSON.stringify(i.payload)) as McPack;
  cells.push({ cellId, archetype: i.payload.archetype, kind: "mc", unitCode: i.unitCode, topic: i.keywordCode, skill: i.skillPrimary, calculator: i.calculator ?? i.payload.calculator, candidates: 1, extraTopics: [] });
  packs[cellId] = [p]; truth[`${cellId}-k0`] = { defect: defect ? "missing_condition" : "none", source: i.stockKey, archetype: i.payload.archetype };
});
const dir = path.resolve("data/ap/sample-2027", RUN); mkdirSync(dir, { recursive: true });
writeFileSync(path.join(dir, "cells.json"), JSON.stringify(cells, null, 1)); writeFileSync(path.join(dir, "packs.json"), JSON.stringify(packs));
writeFileSync(path.join(dir, "truth.json"), JSON.stringify(truth, null, 1));
console.log(`${RUN}: 결함 ${defects.length}, 정상 ${controls.length}, 원형(결함) ${[...new Set(defects.map((d) => d.payload.archetype))].length}종, 대조군 중 같은 원형 ${controls.filter((c) => byA.has(c.payload.archetype)).length}`);
