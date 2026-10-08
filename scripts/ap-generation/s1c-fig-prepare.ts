// S1c 그림·표 결함 탐지 준비: 실제 렌더 산출물(표 HTML / 그래프 SVG → PNG)에 결함을 넣는다. 데이터 명세만이 아니라 학생이 보는 렌더가 대상이다.
//   npx tsx scripts/ap-generation/s1c-fig-prepare.ts --run s1c-fig --seed 5
// 결함: table_wrong_value(해설에 쓰인 수의 칸 값 변경), table_body_missing(본문 행 삭제), graph_series_shifted(곡선 평행이동), graph_labels_swapped(곡선 라벨 교환).
// 정상 대조군: 같은 유형의 결함 없는 렌더. 정답표는 truth.json 에만 둔다. 이미지 입력은 pipeline2 의 AP_IMAGE_DIR 모드가 읽는다.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { gateCandidate } from "../../lib/ap-figures/gate";
import { renderFigureSvg } from "../../lib/problem-figures/render";
import { tableTextContradictions } from "../../lib/ap-generation/table-consistency";
import { validateAp } from "../../lib/problem-figures/templates/ap-figures";

const arg = (n: string, d = "") => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const RUN = arg("--run", "s1c-fig"); let seed = Number(arg("--seed", "5")); const exclude = new Set<string>(arg("--exclude").split(",").filter(Boolean));
const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
const shuffle = <T,>(a: T[]) => { const x = [...a]; for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; } return x; };
type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const scan = new Set((JSON.parse(readFileSync("data/ap/stock/defect-scan.json", "utf-8")) as { key: string }[]).map((r) => r.key));
const all = ([...JSON.parse(readFileSync("data/ap/stock/items.json", "utf-8")), ...JSON.parse(readFileSync("data/ap/stock/s1a-items.json", "utf-8"))] as Json[]).filter((i) => i.apSubjectCode === "ap_calculus_ab" && i.kind === "mc" && !scan.has(i.stockKey) && i.validation !== "exact_duplicate" && i.validation !== "rejected" && !exclude.has(i.stockKey));
const gated = all.map((i) => ({ i, g: gateCandidate({ stockKey: i.stockKey, candidateKey: i.stockKey, apSubjectCode: i.apSubjectCode, kind: i.kind, payload: i.payload }) })).filter((x) => x.g.status === "pass" && x.g.spec && (x.g.spec.type === "ap_table" || x.g.spec.type === "ap_graph"));
const tables = shuffle(gated.filter((x) => x.g.spec!.type === "ap_table")); const graphs = shuffle(gated.filter((x) => x.g.spec!.type === "ap_graph"));
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
const nums = (s: string): string[] => (s.match(/-?\d+(?:\.\d+)?/g) ?? []) as string[];
const relevant = { v: true }; const mutInfo: { v: Json | null } = { v: null }; let bodyMissingBlocked = 0;
function mutate(spec: Json, kind: string, expl: string): Json | null {
  const s = clone(spec);
  if (kind === "table_body_missing") { if (!Array.isArray(s.rows) || !s.rows.length) return null; s.rows = []; return s; }
  if (kind === "table_wrong_value") {
    if (!Array.isArray(s.rows)) return null; const cand: [number, number][] = [];
    s.rows.forEach((r: unknown[], ri: number) => r.forEach((c, ci) => { if (ci > 0 && /^-?\d+(\.\d+)?$/.test(String(c)) && nums(expl).includes(String(c))) cand.push([ri, ci]); }));
    if (!cand.length) { s.rows.forEach((r: unknown[], ri: number) => r.forEach((c, ci) => { if (ci > 0 && /^-?\d+(\.\d+)?$/.test(String(c))) cand.push([ri, ci]); })); relevant.v = false; } else relevant.v = true;
    if (!cand.length) return null; const [ri, ci] = cand[Math.floor(rnd() * cand.length)]; const v = Number(s.rows[ri][ci]); const dec = (String(s.rows[ri][ci]).split(".")[1] ?? "").length;
    let nv = (Math.abs(v) < 5 ? v + 3 : v * 1.4).toFixed(dec); if (nv === String(s.rows[ri][ci])) nv = (v + 7).toFixed(dec); // 값이 실제로 바뀌어야 결함이다(이전 판은 음의 정수에서 반올림되어 무변경이었음)
    if (nv === String(s.rows[ri][ci])) return null; mutInfo.v = { row: ri, col: ci, from: String(s.rows[ri][ci]), to: nv }; s.rows[ri][ci] = nv; return s;
  }
  if (kind === "graph_series_shifted") { if (!s.series?.length || !s.y) return null; const d = (s.y.max - s.y.min) * 0.3; s.series[0].points = s.series[0].points.map(([x, y]: [number, number]) => [x, y + d]); return s; }
  if (kind === "graph_labels_swapped") { if ((s.series?.length ?? 0) < 2) return null; const a = s.series[0].label; s.series[0].label = s.series[1].label; s.series[1].label = a; return s; }
  return null;
}
const wrapHtml = (out: string, isTable: boolean) => `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#fff;font-family:Georgia,serif"><div id="fig" style="display:inline-block;padding:12px;background:#fff">${isTable ? out : out}</div>`;
const rows: { it: Json; spec: Json; defect: string; render: string; table: boolean }[] = [];
const plan: [string, Json[], string[], number][] = [
  ["table", tables.map((x) => x.i), ["table_wrong_value"], 12],
  ["graph", graphs.map((x) => x.i), ["graph_series_shifted", "graph_labels_swapped"], 6],
];
const gOf = new Map(gated.map((x) => [x.i.stockKey as string, x.g]));
const used = new Set<string>();
for (const [type, pool, defects, nDef] of plan) {
  let made = 0; for (const it of pool) { if (made >= nDef) break; const g = gOf.get(it.stockKey)!; const d = defects[made % defects.length]; const m = mutate(g.spec as Json, d, String(it.payload.explanation_en ?? "")); if (!m) continue;
    const v = validateAp(m as Record<string, unknown>); if (!v.ok) continue;
    (m as Json).__relevant = relevant.v; (m as Json).__mut = mutInfo.v; used.add(it.stockKey); rows.push({ it, spec: m, defect: d, render: renderFigureSvg(v.spec as never), table: type === "table" }); made++; }
}
const nCtrl = { table: 12, graph: 6 }; const ctrl: typeof rows = [];
for (const [type, pool] of [["table", tables.map((x) => x.i)], ["graph", graphs.map((x) => x.i)]] as [string, Json[]][]) { let n = 0; for (const it of pool) { if (n >= nCtrl[type as "table" | "graph"]) break; if (used.has(it.stockKey)) continue; ctrl.push({ it, spec: gOf.get(it.stockKey)!.spec as Json, defect: "none", render: gOf.get(it.stockKey)!.output!, table: type === "table" }); n++; } }
const mix = shuffle([...rows, ...ctrl]);
const dir = path.resolve("data/ap/sample-2027", RUN); mkdirSync(path.join(dir, "img"), { recursive: true });
const cells: unknown[] = []; const packs: Record<string, unknown[]> = {}; const truth: Json = {};
(async () => {
  const br = await chromium.launch(); const pg = await br.newPage({ viewport: { width: 760, height: 600 } });
  for (const [n, r] of mix.entries()) {
    const cellId = `${RUN}-${String(n + 1).padStart(2, "0")}`; const key = `${cellId}-k0`;
    await pg.setContent(wrapHtml(r.render, r.table)); await (await pg.$("#fig"))!.screenshot({ path: path.join(dir, "img", `${key}.png`) });
    const p = clone(r.it.payload); if (Array.isArray(p.options) && typeof p.options[0] === "string") p.options = p.options.map((t: string, i: number) => ({ text: t, why: (p.option_rationale ?? [])[i] ?? null, value: null })); // 구형식 보기(문자열) → 객체
    cells.push({ cellId, archetype: r.it.payload.archetype ?? "legacy", kind: "mc", unitCode: r.it.unitCode, topic: r.it.keywordCode, skill: r.it.skillPrimary, calculator: r.it.calculator, candidates: 1, extraTopics: [] }); packs[cellId] = [p];
    const det = r.defect === "table_wrong_value" ? tableTextContradictions({ ...p, stimulus: { kind: "table", description: "", data: { columns: (r.spec as Json).columns, rows: (r.spec as Json).rows } } }).length > 0 : null;
    truth[key] = { mutatedCell: (r.spec as Json).__mut ?? null, deterministicConsistencyDetected: det, answerRelevantCell: (r.spec as Json).__relevant ?? null, defect: r.defect, source: r.it.stockKey, figure: r.table ? "table" : "graph", validation: r.it.validation };
  }
  await br.close();
  writeFileSync(path.join(dir, "cells.json"), JSON.stringify(cells, null, 1)); writeFileSync(path.join(dir, "packs.json"), JSON.stringify(packs)); writeFileSync(path.join(dir, "truth.json"), JSON.stringify(truth, null, 1));
  const c = (f: (t: Json) => boolean) => Object.values(truth).filter(f).length;
  console.log(`${RUN}: 결함 ${c((t) => t.defect !== "none")}(표 ${c((t) => t.defect !== "none" && t.figure === "table")}, 그래프 ${c((t) => t.defect !== "none" && t.figure === "graph")}), 정상 ${c((t) => t.defect === "none")}(표 ${c((t) => t.defect === "none" && t.figure === "table")}, 그래프 ${c((t) => t.defect === "none" && t.figure === "graph")}); 유형별`, Object.fromEntries(["table_wrong_value", "table_body_missing", "graph_series_shifted", "graph_labels_swapped"].map((d) => [d, c((t) => t.defect === d)])));
})();
