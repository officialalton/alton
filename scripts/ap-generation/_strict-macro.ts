// 엄격 규칙 배정 드라이버(macro): 공개 세트와 문항군(fam)·원형이 겹치는 재고를 모두 막고 MA3 을 풀어 부족 칸을 낸다. 사용: npx tsx _strict-macro.ts [--write]
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { loadMacroPool } from "./macro-pool";
import { solveMacroSets, LIB_SINGLES, toReportSet, verifyMacroAssignment } from "./macro-assign";

const NEW = /^macro-x/;
const dir = "data/ap/stock";
const strs = (re: RegExp) => {
  const s = new Set<string>();
  for (const d of [dir, dir + "/assembled"]) for (const f of readdirSync(d)) {
    if (!re.test(f) || !f.endsWith(".json") || /items|pass-keys|summary|mi3|ma3|cs3|-new-|published-slots/.test(f)) continue;
    for (const m of readFileSync(`${d}/${f}`, "utf-8").matchAll(/"([^"\n]{6,120})"/g)) s.add(m[1]);
  }
  return s;
};
// 게시 슬롯 파일은 변환된 모든 키(convertedKeys)를 담고 있어 통째로 읽으면 미사용 후보까지 막는다 — 게시 세트 슬롯·게시 그룹 사용 키만 쓴다.
const slots = JSON.parse(readFileSync("data/ap/stock/macro-ma1-ma2-published-slots.json", "utf-8")) as { MA1: { slots: { candidateKey: string }[] }; MA2: { slots: { candidateKey: string }[] }; usedByGroup: Record<string, string[]> };
const publishedExtra = new Set<string>([...slots.MA1.slots, ...slots.MA2.slots].map((x) => x.candidateKey).concat(...Object.values(slots.usedByGroup)));
const { pool: pool0 } = loadMacroPool({ requireScreen: false });
const pool = pool0.filter((c) => c.screen || NEW.test(c.batch));
const str = strs(/macro|ma\d/i); for (const k of publishedExtra) str.add(k);
const used = pool.filter((c) => str.has(c.key));
const uf = new Set(used.map((c) => c.fam)), ua = new Set(used.filter((c) => c.archetype).map((c) => c.archetype));
import { tooSimilar } from "./_strict-lib";
const simBlocked = tooSimilar("ap_macroeconomics", new Set(used.map((c) => c.key)), pool.map((c) => c.key), 0.5);
console.log("blocked by sentence similarity >= 0.5:", simBlocked.size);
const ok = pool.filter((c) => !str.has(c.key) && !uf.has(c.fam) && !(c.archetype && ua.has(c.archetype)) && !simBlocked.has(c.key));
const okArch = new Set(ok.map((c) => c.archetype));
const unused = LIB_SINGLES.filter((e) => !ua.has(e.id) && !okArch.has(e.id));
const seenF = new Set<string>(); const cnt: Record<string, number> = {};
for (const c of ok.filter((x) => x.kind === "mc")) { const m = c.members[0]; if (seenF.has(c.fam)) continue; seenF.add(c.fam); const k = `u${m.unit} ${m.skill}`; cnt[k] = (cnt[k] ?? 0) + 1; }
console.log("pool", pool.length, "ok mc items", ok.filter((c) => c.kind === "mc").length, "distinct fams", seenF.size, "unused lib archetypes", unused.length, "| frq ok:", ok.filter((c) => c.kind === "frq").map((c) => c.frqType).join(","));
console.log("ok fams by cell:", JSON.stringify(Object.fromEntries(Object.entries(cnt).sort())));
console.log("unused lib:", unused.map((e) => `${e.id.slice(3)}[${e.topic},${e.skill}]`).join(" "));
const unusedIds = new Set(unused.map((e) => e.id));
const keep = LIB_SINGLES.filter((e) => unusedIds.has(e.id)); LIB_SINGLES.splice(0, LIB_SINGLES.length, ...keep);
const SK = ["1.A", "1.B", "1.C", "1.D", "2.A", "2.B", "2.C", "3.A", "3.B", "3.C"];
for (let u = 1; u <= 6; u++) for (const s of SK) for (let n = 0; n < 4; n++) LIB_SINGLES.push({ id: `NEW_${u}_${s}_${n}`, topic: `${u}.1`, unit: u, skill: s, key: `NEW_${u}_${s}_${n}|${u}.1` });
const ID = process.argv.find((a) => /^MA\d/.test(a)) ?? "MA3";
const r2 = solveMacroSets([ID], ok, { timeMs: 90000, log: () => {} });
const o = r2.out[0];
console.log("status", r2.res.status, "obj", r2.res.obj, "singles", o?.singles.length, "virtual", o?.virtual.length, "frq", o?.frq.map((c) => c.frqType), "frqVirtual", o?.frqVirtual.map((v) => v.type));
const need: Record<string, number> = {};
for (const v of o?.virtual ?? []) { const k = `u${v.unit} ${v.skill}${v.archetype.startsWith("NEW_") ? "" : " (existing " + v.archetype + ")"}`; need[k] = (need[k] ?? 0) + 1; }
console.log("virtual cells:", JSON.stringify(need));
if (process.argv.includes("--write") && o) {
  const bad = verifyMacroAssignment(r2.out);
  console.log("verifier violations:", bad.length ? bad.join("; ") : 0);
  console.log("new items:", o.singles.filter((c) => NEW.test(c.batch)).length, "old evidenced:", o.singles.filter((c) => !NEW.test(c.batch)).length, "frq new:", o.frq.filter((c) => NEW.test(c.batch)).length);
  const lower = ID.toLowerCase();
  writeFileSync(`data/ap/stock/exact-assign-macro-${lower}.json`, JSON.stringify({ sets: r2.out.map(toReportSet) }, null, 1));
  writeFileSync(`data/ap/stock/exact-assign-macro-${lower}-verifier.txt`, `strict rule: no shared archetype/family with published MA1/MA2 (including swap plans); verifier violations: ${bad.length}\n`);
}
