// 수선 1회 준비(두 arm 공통 피드백 형식): 실패한 최초 후보만 골라 수선 run 디렉터리를 만든다. 최초 후보 수에는 섞지 않는다.
//   npx tsx scripts/ap-generation/s1-repair-prepare.ts --from s1a --to s1a-r
// arm A(코드 우선): 같은 팩(코드 사실 고정)에 피드백을 붙여 문장·해설만 다시 쓴다(pipeline2 gen, AP_REPAIR=1, AP_FEEDBACK_FILE).
// arm B(구방식): feedback.json 을 s1b-gen.ts --repair 가 읽어 피드백과 이전 시도를 주고 전체를 다시 쓴다.
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const arg = (n: string, d = "") => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const FROM = arg("--from"); const TO = arg("--to"); const root = path.resolve("data/ap/sample-2027");
const rj = <T,>(f: string): T => JSON.parse(readFileSync(f, "utf-8")) as T;
type Rev = Record<string, { pass?: boolean; notes?: string } | string | unknown>;
type V = { key: string; cellId: string; passed: boolean; reasons: string[]; solver?: { answers?: { ambiguous_or_flawed?: boolean; flaw_note?: string }[] } | null; review?: Rev | null };
const verdicts = rj<V[]>(path.join(root, FROM, "verdicts.json")); const cells = rj<Record<string, unknown>[]>(path.join(root, FROM, "cells.json"));
const packs = existsSync(path.join(root, FROM, "packs.json")) ? rj<Record<string, unknown[]>>(path.join(root, FROM, "packs.json")) : {};
const feedbackOf = (v: V) => {
  const parts = [`Rejection reasons: ${v.reasons.join("; ")}`];
  const r = v.review as Rev | null | undefined;
  if (r) { for (const k of ["scope_skill", "key_scoring", "stimulus_expression", "distractor_explanation", "exam_suitability"]) { const c = r[k] as { pass?: boolean; notes?: string } | undefined; if (c && c.pass === false) parts.push(`${k}: ${c.notes || "failed"}`); } if (typeof r.summary === "string") parts.push(`Reviewer summary: ${r.summary}`); }
  const fl = v.solver?.answers?.find((a) => a.ambiguous_or_flawed)?.flaw_note; if (fl) parts.push(`Independent solver flagged: ${fl}`);
  return parts.join("\n");
};
const failing = verdicts.filter((v) => !v.passed);
mkdirSync(path.join(root, TO), { recursive: true });
const newCells: unknown[] = []; const newPacks: Record<string, unknown[]> = {}; const fb: Record<string, string> = {}; const map: Record<string, string> = {};
for (const v of failing) {
  const m = v.key.match(/^(.*)-k(\d+)$/)!; const cell = cells.find((c) => c.cellId === m[1])!; const i = Number(m[2]);
  const nid = `${m[1]}-r${i}`; newCells.push({ ...cell, cellId: nid, candidates: 1 });
  if (packs[m[1]]) newPacks[nid] = [packs[m[1]][i]];
  fb[`${nid}-k0`] = feedbackOf(v); map[`${nid}-k0`] = v.key;
}
writeFileSync(path.join(root, TO, "cells.json"), JSON.stringify(newCells, null, 1));
if (Object.keys(newPacks).length) writeFileSync(path.join(root, TO, "packs.json"), JSON.stringify(newPacks));
writeFileSync(path.join(root, TO, "feedback.json"), JSON.stringify(fb, null, 1)); writeFileSync(path.join(root, TO, "repair_map.json"), JSON.stringify(map, null, 1));
console.log(`${TO}: 수선 대상 ${failing.length}건(최초 후보 ${verdicts.length}건 중). 정의: 후보당 수선 1회 상한`);
