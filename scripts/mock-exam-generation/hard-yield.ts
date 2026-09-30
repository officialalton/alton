// hard 판정 수율표: 출처(생성 방식)별 판정 등급 비율. 실행: npx tsx scripts/mock-exam-generation/hard-yield.ts --run <id>
import path from "node:path";
import { readdirSync } from "node:fs";
import { loadRun, hardTier } from "./aggregate-lib";
const base = path.resolve("data/mock-exam-generation", process.argv[process.argv.indexOf("--run") + 1]);
const run = loadRun(base);
const file = new Map<string, string>(); for (const f of readdirSync(path.join(base, "raw"))) file.set(f.replace(/^.*__/, "").replace(".json", ""), f);
const src = (g: string, sys: string) => { const f = file.get(g) ?? ""; return /__r7__/.test(f) ? "archetype(RW)" : /__c6__/.test(f) ? "compiler(Math)" : /__p1__/.test(f) ? "promote" : /__r5__/.test(f) ? "hard-prompt" : `baseline-${sys === "sat_rw" ? "RW" : "Math"}`; };
const tab: Record<string, Record<string, number>> = {};
for (const [g, w] of run.weak ?? []) {
  const rev = run.reviews.get(g); const blindOk = Boolean(rev?.blind?.agrees && !rev?.blind?.otherDefensible);
  const raw = run.raws.find((r) => r.gid === g); if (!raw) continue;
  const k = src(g, w.system); const o = (tab[k] ??= { judged: 0, A: 0, B: 0, C: 0, none: 0, accLe40: 0 });
  o.judged++; const t = hardTier(w, blindOk); o[t ?? "none"]++; if (w.acc <= 0.4) o.accLe40++;
}
console.log(JSON.stringify(tab, null, 1));
