// AP Biology BI1·BI2 주제 분산 점검(읽기 전용·DB 없음·유료 없음).
//   npx tsx scripts/audit/bio-topic-spread.ts --slots data/ap/stock/bio-bi1-bi2-published-v3v4-slots.json     (게시본 스냅샷)
//   npx tsx scripts/audit/bio-topic-spread.ts --assign data/ap/stock/exact-assign-bio-bi1-bi2-v4.json         (배정 보고서)
// FRQ: 시험별 6문항의 유형·시나리오·CED 토픽·점수, 단원(주제 영역)별 점수 비중. MC: 단원·Practice 문항 수 vs CED 비중(범위·중앙값).
import { readFileSync } from "node:fs";
import { BIO_MC_PRACTICE_PCT, BIO_MC_UNIT_PCT, BIO_MC_COUNT } from "../../lib/ap-exam/full-set-rules";
import { BIO_FRQ_POINTS, bioFrqSpread, verifyBioFrqSpread } from "../../lib/ap-exam/bio-frq-spread";
import { loadBioPool } from "../ap-generation/bio-pool";

const arg = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : ""; };
const { all } = loadBioPool({ requireScreen: false });
const byKey = new Map(all.map((c) => [c.key, c]));
const get = (k: string) => { const c = byKey.get(k); if (!c) throw new Error(`재고에 없는 키 ${k}`); return c; };
const rd = <T>(p: string) => JSON.parse(readFileSync(p, "utf-8")) as T;
const exams: Record<string, { mc: string[]; frq: string[] }> = {};
if (arg("--slots")) {
  const s = rd<Record<string, { slots: { section: string; position: number; candidateKey: string }[] }>>(arg("--slots"));
  for (const id of ["BI1", "BI2"]) {
    const sl = s[id].slots; const seen = new Set<string>(); const mc: string[] = [];
    for (const x of sl.filter((x) => x.section === "ap_mc").sort((a, b) => a.position - b.position)) if (!seen.has(x.candidateKey)) { seen.add(x.candidateKey); mc.push(x.candidateKey); }
    exams[id] = { mc, frq: sl.filter((x) => x.section === "ap_frq").sort((a, b) => a.position - b.position).map((x) => x.candidateKey) };
  }
} else for (const st of rd<{ sets: { id: string; mcA: string[]; frqA: string[] }[] }>(arg("--assign")).sets) exams[st.id] = { mc: st.mcA, frq: st.frqA };

for (const [id, e] of Object.entries(exams)) {
  console.log(`\n### ${id}\n`);
  console.log("| FRQ | 유형 | 시나리오 | CED 토픽(단원) | 점수 |\n|---|---|---|---|---|");
  e.frq.map(get).forEach((c, i) => console.log(`| ${i + 1} | ${c.frqType.replace("bio_", "")} | ${c.archetype.replace(/^bif_/, "")} | ${c.frqTopic} (U${String(c.frqTopic).split(".")[0]}) | ${BIO_FRQ_POINTS[c.frqType]} |`));
  const sp = bioFrqSpread(e.frq.map(get).map((c) => ({ type: c.frqType, topic: c.frqTopic ?? "" })));
  console.log(`\nFRQ 단원별 점수: ${Object.entries(sp.byUnit).sort().map(([u, p]) => `U${u} ${p}점(${((p / sp.total) * 100).toFixed(0)}%)`).join(", ")} — 최대 영역 ${sp.maxPct.toFixed(0)}%, 영역 ${sp.areas}개. 규칙(≤35%, ≥4영역) 위반: ${verifyBioFrqSpread(e.frq.map(get).map((c) => ({ type: c.frqType, topic: c.frqTopic ?? "" }))).join(", ") || "없음"}`);
  const items = e.mc.map(get); const cu: Record<string, number> = {}, cp: Record<string, number> = {}, ck: Record<string, number> = {}; let exam = 0;
  for (const c of items) { exam += c.exam ?? 0; for (const m of c.members) { cu[m.unit] = (cu[m.unit] ?? 0) + 1; const p = m.skill.split(".")[0]; cp[p] = (cp[p] ?? 0) + 1; ck[m.skill] = (ck[m.skill] ?? 0) + 1; } }
  console.log(`\nMC 단원(문항 ${BIO_MC_COUNT}): | 단원 | 문항 | 공식 범위 | 중앙값 | 편차 |\n|---|---|---|---|---|`);
  for (const [u, [lo, hi]] of Object.entries(BIO_MC_UNIT_PCT)) { const mid = ((lo + hi) / 2 * BIO_MC_COUNT) / 100, n = cu[u] ?? 0; console.log(`| U${u} | ${n} | ${((lo * BIO_MC_COUNT) / 100).toFixed(1)}–${((hi * BIO_MC_COUNT) / 100).toFixed(1)} | ${mid.toFixed(1)} | ${(n - mid >= 0 ? "+" : "") + (n - mid).toFixed(1)} |`); }
  console.log(`\nMC Practice: | Practice | 문항 | 공식 범위 | 중앙값 | 편차 |\n|---|---|---|---|---|`);
  for (const [p, [lo, hi]] of Object.entries(BIO_MC_PRACTICE_PCT)) { const mid = ((lo + hi) / 2 * BIO_MC_COUNT) / 100, n = cp[p] ?? 0; console.log(`| P${p} | ${n} | ${((lo * BIO_MC_COUNT) / 100).toFixed(1)}–${((hi * BIO_MC_COUNT) / 100).toFixed(1)} | ${mid.toFixed(1)} | ${(n - mid >= 0 ? "+" : "") + (n - mid).toFixed(1)} |`); }
  console.log(`\nMC 스킬 코드: ${Object.entries(ck).sort().map(([k, v]) => `${k}:${v}`).join(" ")}; exam_prep ${exam}/60`);
}
