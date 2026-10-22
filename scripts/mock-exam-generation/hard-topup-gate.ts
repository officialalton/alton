// SAT R&W Hard 보강(2026-10-22): 후보 풀(미배정 Hard 또는 신규 채택분)의 답 누설 게이트 + 풀 내부·공개 세트 대비 지문 겹침 점검(읽기 전용, 파일 입력).
//   npx tsx scripts/mock-exam-generation/hard-topup-gate.ts --pool pool.json --published pub.json --out gate.json
import { readFileSync, writeFileSync } from "node:fs";
import { answerLeakGate, buildIdf, isLeakCheckedSkill } from "./answer-leak-detector";

const arg = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
type Item = { id: string; skill: string; passage: string; question: string; options: string[]; correctIndex: number };
const pool = JSON.parse(readFileSync(arg("--pool")!, "utf-8")) as Item[];
const pub = JSON.parse(readFileSync(arg("--published")!, "utf-8")) as Item[];
const idfBy = new Map<string, ReturnType<typeof buildIdf>>();
for (const sk of new Set(pub.map((p) => p.skill))) idfBy.set(sk, buildIdf(pub.filter((p) => p.skill === sk).flatMap((p) => [p.question ?? "", ...(p.options ?? [])])));
const sh = (s: string, n = 5) => { const w = (s ?? "").toLowerCase().match(/[a-z0-9']+/g) ?? []; const o = new Set<string>(); for (let i = 0; i < Math.max(1, w.length - n + 1); i++) o.add(w.slice(i, i + n).join(" ")); return o; };
const jac = (a: Set<string>, b: Set<string>) => { let x = 0; for (const t of a) if (b.has(t)) x++; return x / (a.size + b.size - x || 1); };
const pubSh = pub.map((p) => ({ p, s: sh(p.passage) }));
const res = pool.map((it, i) => {
  const leak = isLeakCheckedSkill(it.skill) && idfBy.get(it.skill) ? answerLeakGate({ question: it.question, options: it.options, correctIndex: it.correctIndex, skill: it.skill, passage: it.passage }, idfBy.get(it.skill)!) : { ok: true, reasons: [] as string[] };
  const s = sh(it.passage);
  let best = { j: 0, id: "" };
  for (const { p, s: ps } of pubSh) { const j = jac(s, ps); if (j > best.j) best = { j, id: p.id }; }
  let inner = { j: 0, id: "" };
  for (let k = 0; k < pool.length; k++) if (k !== i) { const j = jac(s, sh(pool[k].passage)); if (j > inner.j) inner = { j, id: pool[k].id }; }
  return { id: it.id, skill: it.skill, leakOk: leak.ok, leakReasons: leak.reasons, maxPublishedJaccard: Number(best.j.toFixed(3)), nearPublished: best.id, maxPoolJaccard: Number(inner.j.toFixed(3)), nearPool: inner.id };
});
writeFileSync(arg("--out")!, JSON.stringify(res, null, 1));
console.log("pool", res.length, "leak flagged", res.filter((r) => !r.leakOk).length, "pubJaccard>0.12", res.filter((r) => r.maxPublishedJaccard > 0.12).length, "poolJaccard>0.12", res.filter((r) => r.maxPoolJaccard > 0.12).length);
