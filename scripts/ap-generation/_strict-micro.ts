// 엄격 규칙 배정 드라이버(micro): 공개 세트와 문항군(fam)·원형이 겹치는 재고를 모두 막고 MI3 을 풀어 부족 칸을 낸다.
import { readFileSync, readdirSync } from "node:fs";
import { loadMicroPool } from "./micro-pool";
import { solveMicroSets, LIB_SINGLES } from "./micro-assign";

const dir = "data/ap/stock";
const strs = (re: RegExp) => {
  const s = new Set<string>();
  for (const d of [dir, dir + "/assembled"]) for (const f of readdirSync(d)) {
    if (!re.test(f) || !f.endsWith(".json") || /items|pass-keys|summary|mi3|ma3|cs3|-new-/.test(f)) continue;
    for (const m of readFileSync(`${d}/${f}`, "utf-8").matchAll(/"([^"\n]{6,120})"/g)) s.add(m[1]);
  }
  return s;
};
const { pool: pool0 } = loadMicroPool({ requireScreen: false });
const pool = pool0.filter((c) => c.screen || /^micro-s5/.test(c.batch));
const str = strs(/micro|mi\d/i);
const used = pool.filter((c) => str.has(c.key));
const uf = new Set(used.map((c) => c.fam)), ua = new Set(used.filter((c) => c.archetype).map((c) => c.archetype));
import { tooSimilar } from "./_strict-lib";
const simBlocked = tooSimilar("ap_microeconomics", new Set(used.map((c) => c.key)), pool.map((c) => c.key), 0.5);
console.log("blocked by sentence similarity >= 0.5:", simBlocked.size);
const ok = pool.filter((c) => !str.has(c.key) && !uf.has(c.fam) && !(c.archetype && ua.has(c.archetype)) && !simBlocked.has(c.key));
const okArch = new Set(ok.map((c) => c.archetype));
const unused = LIB_SINGLES.filter((e) => !ua.has(e.id) && !okArch.has(e.id));
console.log("ok mc", ok.filter((c) => c.kind === "mc").length, "unused lib archetypes", unused.length);
const cnt: Record<string, number> = {}; const seenF = new Set<string>();
for (const c of ok.filter((x) => x.kind === "mc")) { const m = c.members[0]; if (seenF.has(c.fam)) continue; seenF.add(c.fam); const k = `u${m.unit} ${m.skill}`; cnt[k] = (cnt[k] ?? 0) + 1; }
console.log("ok by cell:", JSON.stringify(Object.fromEntries(Object.entries(cnt).sort())));
console.log("ok from s5:", ok.filter((c) => /^micro-s5/.test(c.batch) && c.kind === "mc").length, "fams:", new Set(ok.filter((c) => /^micro-s5/.test(c.batch)).map((c) => c.fam)).size);
const unusedIds =new Set(unused.map((e) => e.id));
const blockAll = new Set(LIB_SINGLES.filter((e) => !unusedIds.has(e.id)).map((e) => e.id));
const ok2 = ok;
const keep = LIB_SINGLES.filter((e) => unusedIds.has(e.id)); LIB_SINGLES.splice(0, LIB_SINGLES.length, ...keep);
const SK = ["1.A", "1.B", "1.C", "1.D", "2.A", "2.B", "2.C", "3.A", "3.B", "3.C"];
for (let u = 1; u <= 6; u++) for (const s of SK) for (let n = 0; n < 4; n++) if (!(s === "3.B" && ![2, 5].includes(u)) && !(s === "1.D" && ![2, 3, 4].includes(u))) LIB_SINGLES.push({ id: `NEW_${u}_${s}_${n}`, topic: `${u}.1`, unit: u, skill: s, key: `NEW_${u}_${s}_${n}|${u}.1` });
const r2 = solveMicroSets(["MI3"], ok2, { timeMs: 60000, log: () => {} });
import { writeFileSync } from "node:fs";
import { toReportSet, verifyMicroAssignment } from "./micro-assign";
if (process.argv.includes("--write") && r2.out[0]) {
  const bad = verifyMicroAssignment(r2.out);
  console.log("verifier violations:", bad.length ? bad.join("; ") : 0);
  const o = r2.out[0];
  console.log("new items:", o.singles.filter((c) => /^micro-s5/.test(c.batch)).length, "old evidenced:", o.singles.filter((c) => !/^micro-s5/.test(c.batch)).length, "frq new:", o.frq.filter((c) => /^micro-s5/.test(c.batch)).length);
  writeFileSync("data/ap/stock/exact-assign-micro-mi3.json", JSON.stringify({ sets: r2.out.map(toReportSet) }, null, 1));
  writeFileSync("data/ap/stock/exact-assign-micro-mi3-verifier.txt", `strict rule: no shared archetype/family with published MI1/MI2 (including swap plans); verifier violations: ${bad.length}\n`);
}
console.log("RESTRICTED status", r2.res.status, "obj", r2.res.obj, "singles", r2.out[0]?.singles.length, "virtual", r2.out[0]?.virtual.length);
console.log("frq", r2.out[0]?.frq.map((c) => c.frqType), "frqVirtual", r2.out[0]?.frqVirtual.map((v) => v.type));
for (const v of r2.out[0]?.virtual ?? []) console.log(" v", v.archetype, v.topic, v.skill);
