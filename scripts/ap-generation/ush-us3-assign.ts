// US3 exact-assign 갱신(2026-10-21, DB 쓰기 없음): 실제 사료판 키(ush-real-f FRQ 5 + ush-real-g MC 14 + 기존 실제 Harriot)로 US3 배정을 바꾸고,
// ① ush-assign 독립 검증기(verifyUshAssignment: 구성 규칙·SAQ 시대 서로 다름·키·문항군 겹침)를 US1·US2(원격 스냅샷 기준) + US3 에 함께 돌려 위반 0 을 확인하고,
// ② 원격 읽기 전용 스냅샷(ush-remote-snapshot.ts 결과)에 있는 모든 기존 세트의 키·문제 id 와 US3 가 겹치지 않는지, 문항군(MC 테마·FRQ 키)이 겹치지 않는지 확인한다.
//   npx tsx scripts/ap-generation/ush-us3-assign.ts [--write]   # --write: 배정 파일과 검증 기록을 쓴다(검증 위반 0 일 때만)
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { loadUshPool, type UshItem } from "./ush-pool";
import { frqOrder, toReportSet, unitSummary, verifyUshAssignment, type UshResult } from "./ush-assign";

type Snap = { takenAt: string; target: string; sets: Record<string, { status: string; keys: string[]; problemIds: string[] }>; keys: string[]; problemIds: string[] };
const SNAP = "data/ap/stock/ush-remote-snapshot-2026-10-21.json"; const OUT = "data/ap/stock/exact-assign-ushistory-us3.json"; const PREV = "data/ap/stock/exact-assign-ushistory-us3-alton-composed.json"; const REPORT = "data/ap/stock/exact-assign-ushistory-us3-verifier.txt";
const MC_G = ["whitefield", "nworder", "beard", "northup", "nullification", "14th", "hayes", "turner", "cities", "bryan", "eo8802", "truman", "cra", "gulf"];
const mcA = ["ush-real-e:ap_us_history-real_e_harriot-k0", ...MC_G.map((c) => `ush-real-g:ap_us_history-real_g_${c}-k0`)];
const frqA = ["saq1", "saq2", "saq3", "dbq_coldwar", "leq"].map((c) => `ush-real-f:ap_us_history-real_f_${c}-k0`);
const write = process.argv.includes("--write");

function main() {
  const snap = JSON.parse(readFileSync(SNAP, "utf-8")) as Snap; const { all } = loadUshPool({ requireScreen: false }); const by = new Map(all.map((c) => [c.key, c]));
  const get = (k: string): UshItem => { const c = by.get(k); if (!c) throw new Error(`재고에 없음: ${k}`); return c; };
  const us3: UshResult = { id: "US3", sets: mcA.map(get), frq: frqA.map(get) };
  const resOf = (name: string, id: string): UshResult => { const ks = snap.sets[name].keys.map((k) => by.get(k)).filter((c): c is UshItem => !!c); return { id, sets: ks.filter((c) => c.kind === "mc"), frq: ks.filter((c) => c.kind === "frq") }; };
  const us1 = resOf("AP U.S. History — Practice Exam 1", "US1"); const us2 = resOf("AP U.S. History — Practice Exam 2", "US2");
  const L: string[] = [`# US3 exact-assign 검증 (${new Date().toISOString().slice(0, 10)}, DB 쓰기 없음) — 원격 읽기 전용 스냅샷 ${snap.takenAt} (${snap.target})`];
  // 스냅샷 키가 로컬 재고에 모두 있는지(없으면 문항군 비교가 불완전하다)
  const missing = [...snap.sets["AP U.S. History — Practice Exam 1"].keys, ...snap.sets["AP U.S. History — Practice Exam 2"].keys].filter((k) => !by.has(k));
  L.push(`US1·US2 스냅샷 키 ${snap.sets["AP U.S. History — Practice Exam 1"].keys.length}+${snap.sets["AP U.S. History — Practice Exam 2"].keys.length} 중 로컬 재고에 없는 키: ${missing.length ? missing.join(", ") : "0"}`);
  // 독립 검증기: US3 단독 구성 규칙 + US1·US2·US3 간 키·문항군 겹침
  const us3Only = verifyUshAssignment([us3]); L.push(`독립 검증기(US3 단독 구성 규칙): 위반 ${us3Only.length ? us3Only.join("; ") : "0"}`);
  const all3 = verifyUshAssignment([us1, us2, us3]).filter((v) => v.startsWith("US3:") && /겹침/.test(v)); L.push(`독립 검증기(US1·US2·US3 키·문항군 겹침, US3 관련): ${all3.length ? all3.join("; ") : "0"}`);
  // 원격 스냅샷 직접 대조: 모든 기존 세트(US1·US2 모든 버전, US3 초안 포함) 키·문제 id
  const us3Keys = new Set([...mcA, ...frqA]); const pub = new Set(["AP U.S. History — Practice Exam 1", "AP U.S. History — Practice Exam 2"].flatMap((n) => snap.sets[n].keys));
  const keyOverlap = [...us3Keys].filter((k) => pub.has(k)); L.push(`US3 키 ${us3Keys.size}개 ∩ 원격 US1·US2(모든 버전) 키 = ${keyOverlap.length} ${keyOverlap.join(", ")}`);
  const draftOverlap = [...us3Keys].filter((k) => snap.sets["AP U.S. History — Practice Exam 3"].keys.includes(k)); L.push(`US3 키 ∩ 원격 Practice Exam 3 초안(합성 자료 20키, 교체 대상) 키 = ${draftOverlap.length}`);
  const themesPub = new Set([...us1.sets, ...us2.sets].map((c) => c.fam)); const themeOverlap = us3.sets.filter((c) => themesPub.has(c.fam)).map((c) => c.fam); L.push(`US3 MC 문항군(테마) ∩ 원격 US1·US2 MC 문항군 = ${themeOverlap.length} ${themeOverlap.join(", ")}`);
  const frqFams = new Set([...us1.frq, ...us2.frq].map((c) => c.fam)); const frqOverlap = us3.frq.filter((c) => frqFams.has(c.fam)).map((c) => c.fam); L.push(`US3 FRQ 문항군 ∩ 원격 US1·US2 FRQ 문항군 = ${frqOverlap.length}`);
  // 실제 자료 겹침: US1·US2 가 쓴 레지스트리 자료가 US3 에 쓰였는지
  const regOf = (c: UshItem) => { const f = ["ush-real-a", "ush-real-b", "ush-real-c", "ush-real-d", "ush-real-e", "ush-real-f", "ush-real-g"]; void f; return c.key; };
  void regOf;
  const srcIds = (keys: string[]) => { const ids = new Set<string>(); for (const k of keys) { const [run] = k.split(":"); const p = `data/ap/stock/${run}-items.json`; if (!existsSync(p)) continue; for (const r of JSON.parse(readFileSync(p, "utf-8")) as { stockKey: string; sourceRegistryIds?: string[] }[]) if (r.stockKey === k) for (const i of r.sourceRegistryIds ?? []) ids.add(i); } return ids; };
  const sPub = srcIds([...pub]); const sUs3 = srcIds([...us3Keys]); const srcOverlap = [...sUs3].filter((i) => sPub.has(i)); L.push(`US3 가 쓴 레지스트리 실제 자료 ${sUs3.size}건 ∩ US1·US2 가 쓴 실제 자료 ${sPub.size}건 = ${srcOverlap.length} ${srcOverlap.join(", ")}`);
  // 구성 요약
  const units = unitSummary(us3); const types = us3.sets.reduce<Record<string, number>>((o, c) => { o[c.stim] = (o[c.stim] ?? 0) + 1; return o; }, {});
  L.push(`US3 구성: MC 세트 ${us3.sets.length} (문항 ${us3.sets.reduce((a, c) => a + c.members.length, 0)}), 단원별 문항 ${JSON.stringify(units)}, 자료 유형 ${JSON.stringify(types)}`);
  L.push(`US3 FRQ: ${frqOrder(us3).map((c) => `${c.template}(P${c.period}) ${c.key}`).join(" | ")}`);
  const screenMissing = [...us3Keys].filter((k) => !get(k).screen); L.push(`화면 증거(screen-evidence) 없는 US3 키: ${screenMissing.length}${screenMissing.length ? " (격리 스택 화면 증거 단계에서 채운다)" : ""}`);
  const bad = us3Only.length + all3.length + keyOverlap.length + themeOverlap.length + frqOverlap.length + srcOverlap.length; L.push(`종합: 위반 ${bad}`);
  console.log(L.join("\n"));
  if (write && !bad) {
    if (!existsSync(PREV)) writeFileSync(PREV, readFileSync(OUT, "utf-8")); // 합성 자료 배정은 삭제하지 않고 보존
    writeFileSync(OUT, JSON.stringify({ sets: [toReportSet(us3)] }, null, 1)); writeFileSync(REPORT, L.join("\n") + "\n"); console.error(`기록: ${OUT}, ${REPORT}`);
  }
  if (bad) process.exitCode = 1;
}
main();
