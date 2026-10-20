// 엄격 규칙 배정 드라이버(csa): 공개 세트와 문항군·원형이 겹치는 재고를 모두 막고 CS3 을 풀어 부족 칸을 낸다. 사용: npx tsx _strict-csa.ts [CS3] [--write]
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { loadCsPool } from "./cs-pool";
import { solveCsSets, LIB_SINGLES, LIB_SETS, LIB_FRQ, toReportSet, verifyCsAssignment } from "./cs-assign";

const NEW = /^csa-x/;
const dir = "data/ap/stock";
const strs = (re: RegExp) => {
  const s = new Set<string>();
  for (const d of [dir, dir + "/assembled"]) for (const f of readdirSync(d)) {
    if (!re.test(f) || !f.endsWith(".json") || /items|pass-keys|summary|mi3|ma3|cs3|-new-/.test(f)) continue;
    for (const m of readFileSync(`${d}/${f}`, "utf-8").matchAll(/"([^"\n]{6,120})"/g)) s.add(m[1]);
  }
  return s;
};
const { pool: pool0 } = loadCsPool({ requireScreen: false });
const pool = pool0.filter((c) => c.screen || NEW.test(c.batch));
const str = strs(/csa|cs\d/i);
const used = pool.filter((c) => str.has(c.key));
const uf = new Set(used.map((c) => c.fam)), ua = new Set(used.filter((c) => c.archetype).map((c) => c.archetype));
import { tooSimilar } from "./_strict-lib";
const simBlocked = tooSimilar("ap_computer_science_a", new Set(used.map((c) => c.key)), pool.map((c) => c.key), 0.85, "code");
console.log("blocked by code similarity >= 0.85:", simBlocked.size);
const ok = pool.filter((c) => !str.has(c.key) && !uf.has(c.fam) && !(c.archetype && ua.has(c.archetype)) && !simBlocked.has(c.key));
const okArch = new Set(ok.map((c) => c.archetype));
const unusedS = LIB_SINGLES.filter((e) => !ua.has(e.id) && !okArch.has(e.id));
const unusedT = LIB_SETS.filter((e) => !ua.has(e.id) && !okArch.has(e.id));
const seenF = new Set<string>(); const cnt: Record<string, number> = {};
for (const c of ok.filter((x) => x.kind === "mc")) { const m = c.members[0]; if (seenF.has(c.fam)) continue; seenF.add(c.fam); const k = `u${m.unit} ${m.skill}`; cnt[k] = (cnt[k] ?? 0) + 1; }
console.log("pool", pool.length, "ok mc items", ok.filter((c) => c.kind === "mc").length, "fams", seenF.size, "| unused lib singles", unusedS.length, "sets", unusedT.length, "| frq ok:", ok.filter((c) => c.kind === "frq").map((c) => c.frqType + ":" + c.archetype).join(","));
console.log("ok fams by cell:", JSON.stringify(Object.fromEntries(Object.entries(cnt).sort())));
console.log("unused singles:", unusedS.map((e) => `${e.id.slice(3)}[${e.topic},${e.skill}]`).join(" "));
console.log("unused sets:", unusedT.map((e) => e.id).join(" "));
const ID = process.argv.find((a) => /^CS\d/.test(a)) ?? "CS3";
const uS = new Set(unusedS.map((e) => e.id)), uT = new Set(unusedT.map((e) => e.id));
LIB_SINGLES.splice(0, LIB_SINGLES.length, ...LIB_SINGLES.filter((e) => uS.has(e.id)));
LIB_SETS.splice(0, LIB_SETS.length, ...LIB_SETS.filter((e) => uT.has(e.id)));
for (let u = 1; u <= 4; u++) for (const s of ["2.A", "2.B", "2.C", "3.A", "3.B", "3.C", "3.D", "4.A", "4.B"]) for (let n = 0; n < 4; n++) {
  LIB_SINGLES.push({ id: `NEW_${u}_${s}_${n}`, topic: `${u}.1`, unit: u, practice: Number(s[0]), skill: s, key: `NEW_${u}_${s}_${n}` } as never);
}
for (const u of [2, 3, 4]) for (let n = 0; n < 2; n++) LIB_SETS.push({ id: `NEWSET_${u}_${n}`, unit: u, members: [{ unit: u, practice: 3, skill: "3.A" }, { unit: u, practice: 3, skill: "3.B" }], key: `NEWSET_${u}_${n}` } as never);
const r2 = solveCsSets([ID], ok, { timeMs: 90000, log: () => {} });
const o = r2.out[0];
console.log("status", r2.res.status, "obj", r2.res.obj, "singles", o?.singles.length, "sets", o?.sets.length, "virtual", o?.virtual.length, "virtualSets", o?.virtualSets?.length, "frq", o?.frq.map((c) => c.frqType), "frqVirtual", o?.frqVirtual.map((v) => v.type));
const need: Record<string, number> = {};
for (const v of o?.virtual ?? []) { const k = `u${v.unit} p${v.practice} ${v.skill}${v.archetype.startsWith("NEW_") ? "" : " (existing " + v.archetype + ")"}`; need[k] = (need[k] ?? 0) + 1; }
console.log("virtual sets:", JSON.stringify(o?.virtualSetArchetypes));
console.log("virtual cells:", JSON.stringify(need));
if (process.argv.includes("--write") && o) {
  const bad = verifyCsAssignment(r2.out);
  console.log("verifier violations:", bad.length ? bad.join("; ") : 0);
  console.log("new singles:", o.singles.filter((c) => NEW.test(c.batch)).length, "old evidenced:", o.singles.filter((c) => !NEW.test(c.batch)).length);
  const lower = ID.toLowerCase();
  writeFileSync(`data/ap/stock/exact-assign-csa-${lower}.json`, JSON.stringify({ sets: r2.out.map(toReportSet) }, null, 1));
  writeFileSync(`data/ap/stock/exact-assign-csa-${lower}-verifier.txt`, `strict rule: no shared archetype/family with published CS1/CS2 (including swap plans); verifier violations: ${bad.length}\n`);
}
void LIB_FRQ;
