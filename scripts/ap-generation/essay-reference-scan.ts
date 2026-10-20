// 에세이 참고답 점수·설명 충돌 스캔(백로그 B2). 재고 항목 + 샘플 후보 전체의 FRQ 참고답에 검사기를 돌려 위반 목록·수정 후보를 낸다.
//   npx tsx scripts/ap-generation/essay-reference-scan.ts [--out data/audit/essay-reference-scan-20261019.json]
// 읽기 전용: 후보·재고 파일은 고치지 않는다. 공개 세트에 들어간 항목의 수정은 새 버전 교체안으로 따로 만든다(총괄 적재).
import fs from "node:fs";
import path from "node:path";
import { checkEssayReference, parseSamples, proposedHeading } from "../../lib/ap-generation/essay-reference-check";

const ROOT = path.resolve(__dirname, "../..");
const SUBJECTS = ["ap_world_history", "ap_european_history", "ap_us_history", "ap_english_literature", "ap_english_language"];
const outArg = process.argv.indexOf("--out");
const OUT = path.resolve(ROOT, outArg > 0 ? process.argv[outArg + 1] : "data/audit/essay-reference-scan-20261019.json");

type Row = { run: string; candidateKey: string; subject: string; template: string; source: string; reference: string; points?: number };
const rows = new Map<string, Row>();
const add = (it: Record<string, unknown>, source: string) => {
  const subject = (it.apSubjectCode ?? it.ap_subject_code) as string;
  const p = it.payload as Record<string, unknown> | undefined;
  if (!SUBJECTS.includes(subject) || !p || typeof p.reference_text !== "string") return;
  const parts = (p.parts as { points?: number }[] | undefined) ?? [];
  const key = String(it.candidateKey ?? it.candidate_key ?? p.archetype);
  const id = `${subject}|${key}|${p.reference_text.length}`;
  if (!rows.has(id)) rows.set(id, { run: String(it.run ?? ""), candidateKey: key, subject, template: String(p.template ?? ""), source, reference: p.reference_text, points: parts.reduce((a, x) => a + (x.points ?? 0), 0) || undefined });
};
const walk = (dir: string, re: RegExp, cb: (f: string) => void) => { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const f = path.join(dir, e.name); if (e.isDirectory()) walk(f, re, cb); else if (re.test(e.name)) cb(f); } };
walk(path.join(ROOT, "data/ap/stock"), /-items\.json$/, (f) => { for (const it of JSON.parse(fs.readFileSync(f, "utf8"))) add(it, path.relative(ROOT, f)); });
walk(path.join(ROOT, "data/ap/sample-2027"), /^candidates\.json$/, (f) => { const d = JSON.parse(fs.readFileSync(f, "utf8")); for (const it of Array.isArray(d) ? d : d.candidates ?? []) add(it, path.relative(ROOT, f)); });

// 공개(배정) 세트에 쓰인 키: exact-assign-* 보고서에 키 문자열이 나오면 배정된 것으로 본다.
const assignText: string[] = [];
walk(path.join(ROOT, "data/ap/stock"), /^exact-assign-.*\.json$/, (f) => assignText.push(fs.readFileSync(f, "utf8")));
const inAssign = (run: string, k: string) => assignText.some((t) => t.includes(`"${run}:${k}"`));

const violations: Record<string, unknown>[] = [];
const bySubject: Record<string, { checked: number; withViolations: number }> = {};
for (const r of rows.values()) {
  const s = (bySubject[r.subject] ??= { checked: 0, withViolations: 0 });
  s.checked++;
  const v = checkEssayReference(r.reference, { expectedMax: r.points });
  if (v.length) {
    s.withViolations++;
    const heads = new Map(parseSamples(r.reference).map((x) => [x.band, x.heading]));
    const withFix = v.map((x) => ({ ...x, proposedHeading: x.proposal && x.band && heads.get(x.band) ? { from: heads.get(x.band), to: proposedHeading(heads.get(x.band)!, x.proposal) } : undefined }));
    violations.push({ candidateKey: r.candidateKey, run: r.run, subject: r.subject, template: r.template, source: r.source, inAssignedSet: inAssign(r.run, r.candidateKey), violations: withFix });
  }
}
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify({ generatedAt: "2026-10-19", checked: rows.size, bySubject, flagged: violations.length, violations }, null, 1) + "\n");
console.log(JSON.stringify({ checked: rows.size, bySubject, flagged: violations.length, out: path.relative(ROOT, OUT) }, null, 1));
const codes: Record<string, number> = {};
for (const x of violations) for (const v of x.violations as { code: string }[]) codes[v.code] = (codes[v.code] ?? 0) + 1;
console.log(codes);

// 새 버전 교체안: 위반이 있는 참고답의 머리글을 설명에 맞춘 점수로 고친 문자열(여러 위반이 같은 샘플이면 합쳐 총점을 다시 계산).
// 설명이 더 구체적이라 점수를 설명에 맞추는 쪽을 기본으로 한다. 샘플 본문은 그대로이며, 채점자가 설명 쪽이 틀렸다고 판단하면 이 교체안을 쓰지 않는다.
type Prop = { area?: string; from?: number; to: number; total: number };
const esc = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const fixes: Record<string, unknown>[] = [];
for (const x of violations as { candidateKey: string; run: string; subject: string; template: string; inAssignedSet: boolean; violations: { band?: string; proposal?: Prop }[] }[]) {
  const row = [...rows.values()].find((r) => r.candidateKey === x.candidateKey && r.run === x.run && checkEssayReference(r.reference, { expectedMax: r.points }).length);
  if (!row) continue;
  const replacements: { from: string; to: string }[] = [];
  for (const s of parseSamples(row.reference)) {
    const ps = x.violations.filter((v) => v.band === s.band && v.proposal?.area).map((v) => v.proposal!);
    if (!ps.length) continue;
    let h = s.heading;
    for (const p of ps) h = h.replace(new RegExp(`(${esc(p.area!)}\\s+)${p.from}(?=\\s*(?:,|\\)|:|$))`), `$1${p.to}`);
    const total = parseSamples(h)[0].areas.reduce((a, y) => a + y.score, 0);
    replacements.push({ from: s.heading, to: h.replace(/(\d+)(\s*\/\s*\d+)/, `${total}$2`) });
  }
  if (replacements.length) fixes.push({ candidateKey: x.candidateKey, run: x.run, subject: x.subject, template: x.template, inAssignedSet: x.inAssignedSet, replacements, note: "heading-only correction; also update verification.sample_totals if present and re-check band order" });
}
fs.writeFileSync(OUT.replace(/\.json$/, "-fixes.json"), JSON.stringify({ generatedAt: "2026-10-19", fixes }, null, 1) + "\n");
console.log({ fixCandidates: fixes.length });
