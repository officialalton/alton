// 확장 묶음 후처리(LLM·DB 없음): 통과한 새 문항 중 시험 구성(공식 5묶음 + 8범주)에 맞게 남길 문항을 고르고 candidates.json 을 줄인다(원본은 candidates.full.json 에 보존).
//   npx tsx scripts/ap-generation/el-long-trim.ts --run englang-long-a --groups 'A=lr11,lr23,lw04,lw32|el-rv:ap_english_language-w05-k0;B=lr01,lr08,lw06,lw22|el-rv:ap_english_language-w02-k0'
import { existsSync, readFileSync, writeFileSync, copyFileSync } from "node:fs";
import path from "node:path";
import { chooseTrim, type TrimSet } from "../../lib/ap-generation/englang-trim";
import { elangCategoryOf } from "../../lib/ap-exam/elang-rules";

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const arg = (n: string, d = "") => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const RUN = arg("--run"), dir = path.resolve("data/ap/sample-2027", RUN);
const full = path.join(dir, "candidates.full.json"); if (!existsSync(full)) copyFileSync(path.join(dir, "candidates.json"), full);
const cands = JSON.parse(readFileSync(full, "utf-8")) as Json[]; const audit = JSON.parse(readFileSync(path.join(dir, "audit.json"), "utf-8")) as Json[];
const rv = JSON.parse(readFileSync("data/ap/stock/el-rv-items.json", "utf-8")) as Json[];
const keyOf = (id: string) => `ap_english_language-${id}-k0`;
const report: Json = {};
for (const g of arg("--groups").split(";").filter(Boolean)) {
  const [name, rest] = g.split("="); const [ids, shortKey] = rest.split("|"); const setIds = ids.split(",");
  const short = rv.find((r) => r.stockKey === shortKey); if (!short) throw new Error(`짧은 글쓰기 묶음 없음 ${shortKey}`);
  const fixedCats = (short.payload.items as Json[]).map((i) => elangCategoryOf(i.skill) ?? "?");
  const sets: TrimSet[] = []; const meta = new Map<string, { newIdx: number[] }>();
  for (const id of setIds) {
    const c = cands.find((x) => x.candidateKey === keyOf(id)); if (!c || c.reviewState !== "auto_passed") throw new Error(`묶음 ${id} 없음/탈락`);
    const rows = audit.filter((a) => a.set === id && a.pass); const items = c.payload.items as Json[];
    if (rows.length !== items.length) throw new Error(`${id}: audit 통과 ${rows.length} != 문항 ${items.length}`);
    const baseCats: string[] = [], candsOf: { cat: string; score: number }[] = [], newIdx: number[] = [];
    items.forEach((it, j) => { const cat = elangCategoryOf(it.skill) ?? "?"; if (rows[j].pre) baseCats.push(cat); else { candsOf.push({ cat, score: Number(it.key_confidence?.score ?? 0.8) }); newIdx.push(j); } });
    sets.push({ id, section: id.startsWith("lr") ? "reading" : "writing", baseCats, cands: candsOf }); meta.set(id, { newIdx });
  }
  const r = chooseTrim({ sets, fixedCats }); report[name] = r;
  console.log(`[${name}] ${r.ok ? "ok" : "INFEASIBLE"} sizes=${JSON.stringify(r.sizes)} counts=${JSON.stringify(r.counts)} (passed new: ${sets.map((s) => `${s.id}:${s.cands.length}`).join(" ")})`);
  if (!r.ok) continue;
  for (const id of setIds) {
    const c = cands.find((x) => x.candidateKey === keyOf(id))!; const items = c.payload.items as Json[]; const m = meta.get(id)!; const keepNew = new Set(r.keep[id].map((i) => m.newIdx[i]));
    const rows = audit.filter((a) => a.set === id && a.pass);
    const kept = items.filter((_, j) => rows[j].pre || keepNew.has(j)); const dropped = items.filter((_, j) => !rows[j].pre && !keepNew.has(j)).map((it) => ({ skill: it.skill, stem: it.stem, reason: "trimmed_for_exam_composition" }));
    c.payload.items = kept; c.payload.excluded_items = [...(c.payload.excluded_items ?? []), ...dropped]; c.payload.trim = { group: name, kept: kept.length };
    c.skillPrimary = kept[0].skill; c.difficulty = (c.difficulty as Json[]).filter((_: unknown, j: number) => rows[j].pre || keepNew.has(j));
  }
}
writeFileSync(path.join(dir, "candidates.json"), JSON.stringify(cands, null, 1)); writeFileSync(path.join(dir, "trim.json"), JSON.stringify(report, null, 1));
