// US History US1/US2 자료 유형 감사: 공개 배정 데이터에서 세트·문항별 stimulus 유형과 ALTON 작성/실제 자료 여부를 집계한다(읽기 전용).
import { readFileSync, writeFileSync } from "node:fs";
export type Row = { exam: string; part: "mc" | "saq" | "dbq" | "leq"; key: string; cell: string; topic: string; stimTypes: string[]; composed: boolean; real: boolean; theme: string };
type Src = { kind?: string; real_data?: boolean };
const read = (f: string) => JSON.parse(readFileSync(f, "utf-8"));
const FILES: Record<string, string> = { "ush-p1-b": "ush-p1b-items.json", "ush-p2-a": "ush-p2a-items.json", "ush-p3-a": "ush-p3a-items.json", "ush-p1-a": "ush-p1a-items.json" };
export function frqTypes(cell: string, p: { set_intro?: string; stimulus?: { kind?: string } }): string[] {
  const si = p.set_intro ?? "";
  const docs = [...si.matchAll(/Document \d \(([^)]*)\)/g)].map((m) => m[1].replace(/ text$/, "_text"));
  if (docs.length) return docs;
  if (/^ap_us_history-leq/.test(cell)) return ["none(prompt only)"];
  if (p.stimulus?.kind) return [p.stimulus.kind];
  return [...si.matchAll(/(?:^|\n)(?:Source [A-Z] )?\((primary|secondary) source\)/g)].map((m) => `${m[1]}_text`);
}
export function buildRows(assign: { sets: { id: string; mcA: string[]; frqA: string[] }[] }, stock: Record<string, any[]>): Row[] {
  const rows: Row[] = [];
  for (const s of assign.sets) for (const k of [...s.mcA, ...s.frqA]) {
    const [pre, cell] = k.split(":"); const it = stock[pre].find((x) => x.cellId === cell.replace(/-k0$/, ""))!; const p = it.payload;
    const part = it.kind === "mc" ? "mc" : /saq/.test(cell) ? "saq" : /dbq/.test(cell) ? "dbq" : "leq";
    let types: string[]; let real = false; let composed = true;
    if (part === "mc") { const us = p.ush_set; const srcs: Src[] = us?.sources ?? []; types = srcs.map((x) => x.kind === "table" ? "table" : x.kind!); real = srcs.some((x) => x.real_data === true); composed = srcs.length > 0 && srcs.every((x) => x.real_data !== true); }
    else { types = frqTypes(cell, p); composed = /ALTON-composed stimulus/.test(p.set_intro ?? "") || part === "leq"; real = !composed; }
    rows.push({ exam: s.id, part, key: k, cell, topic: p.topic, stimTypes: types, composed, real, theme: p.ush_set?.theme ?? p.title ?? "" });
  }
  return rows;
}
export function tally(rows: Row[]) { const t: Record<string, Record<string, number>> = {}; for (const r of rows) for (const ty of r.stimTypes) { const k = r.part; (t[k] ??= {})[ty] = (t[k][ty] ?? 0) + 1; } return t; }
if (require.main === module) {
  const assign = read("data/ap/stock/exact-assign-ushistory-us1-us2.json"); const stock: Record<string, any[]> = {};
  for (const [pre, f] of Object.entries(FILES)) stock[pre] = read(`data/ap/stock/${f}`);
  const rows = buildRows(assign, stock);
  const summary = { exams: ["US1", "US2"], rows: rows.length, byPart: tally(rows), composedItems: rows.filter((r) => r.composed).length, realItems: rows.filter((r) => r.real).length, noStimulus: rows.filter((r) => r.stimTypes[0]?.startsWith("none")).length };
  writeFileSync("data/ap/ushistory-material-audit.json", JSON.stringify({ generated: "2026-10-15", ced: "AP Central exam page: MC 55q sets of 3-4 (primary/secondary sources, images, graphs, maps); SAQ1 secondary text, SAQ2 primary text, SAQ3 primary or secondary non-text; DBQ 7 documents (written, quantitative or visual; no visual minimum stated); LEQ prompt only", summary, rows }, null, 1));
  console.log(JSON.stringify(summary, null, 1));
  for (const e of ["US1", "US2"]) console.log(e, JSON.stringify(tally(rows.filter((r) => r.exam === e))));
}
