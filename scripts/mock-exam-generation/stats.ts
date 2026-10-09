// 기법별 통과율 점검: repaired 문항 중 통과 수와 실패 사유. 실행: npx tsx scripts/mock-exam-generation/stats.ts --run <id>
import path from "node:path";
import { loadRun, evaluateAll } from "./aggregate-lib";
const i = process.argv.indexOf("--run");
const run = loadRun(path.resolve("data/mock-exam-generation", process.argv[i + 1]));
const ev = evaluateAll(run);
const rep = ev.filter((e) => e.repaired);
const reasons: Record<string, number> = {};
for (const e of rep) for (const r of e.reasons) reasons[r.replace(/:.*/, "")] = (reasons[r.replace(/:.*/, "")] ?? 0) + 1;
console.log(JSON.stringify({ repaired: rep.length, pass: rep.filter((e) => e.verdict === "pass").length, reasons, byDifficulty: Object.fromEntries(["easy", "medium", "hard"].map((d) => [d, [rep.filter((e) => e.finalDifficulty === d).length, rep.filter((e) => e.finalDifficulty === d && e.verdict === "pass").length]])) }));
// 승격 변형본 통과율(칸 유형별) — quality.promotedFrom 이 있는 문항.
const prom = ev.filter((e) => (e.raw.quality as { promotedFrom?: string } | undefined)?.promotedFrom);
const out: Record<string, { n: number; pass: number; passHard: number; reasons: Record<string, number> }> = {};
for (const e of prom) {
  const k = e.raw.examSystem === "sat_rw" ? "RW" : "Math";
  const o = (out[k] ??= { n: 0, pass: 0, passHard: 0, reasons: {} });
  o.n++; if (e.verdict === "pass") { o.pass++; if (e.finalDifficulty === "hard") o.passHard++; }
  for (const r of e.reasons) o.reasons[r.replace(/:.*/, "")] = (o.reasons[r.replace(/:.*/, "")] ?? 0) + 1;
}
console.log("promoted", JSON.stringify(out));
// 직접 생성 hard 통과율(유형별) — 승격 변형이 아닌 문항을 파일명 라운드 태그로 구분: __r5__ 는 개선 프롬프트 시험, 나머지는 기준선.
import { readdirSync } from "node:fs";
const names = new Map<string, string>();
for (const f of readdirSync(path.resolve("data/mock-exam-generation", process.argv[i + 1], "raw"))) names.set(f.replace(/^.*__/, "").replace(".json", ""), f);
const grp: Record<string, { n: number; passAsHard: number; passAny: number }> = {};
for (const e of ev) {
  if ((e.raw.quality as { promotedFrom?: string } | undefined)?.promotedFrom || e.raw.difficulty !== "hard") continue;
  const f = names.get(e.raw.gid) ?? "";
  const k = `${/__r5__/.test(f) ? "improved" : "baseline"}-${e.raw.examSystem === "sat_rw" ? "RW" : "Math"}`;
  const o = (grp[k] ??= { n: 0, passAsHard: 0, passAny: 0 });
  o.n++; if (e.verdict === "pass") { o.passAny++; if (e.finalDifficulty === "hard") o.passAsHard++; }
}
console.log("hard-direct", JSON.stringify(grp));
