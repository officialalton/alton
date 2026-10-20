// 공개 AP 세트의 문항 순서를 공식 규칙(lib/ap-exam/official-order.ts)과 대조한다(읽기 전용: 원격 SELECT 결과 rows.json 입력).
//   npx tsx scripts/ap-generation/order-audit.ts <rows.json> <out.json>
// rows.json 은 mock_exam_sets ⨝ mock_exam_set_items ⨝ ap_candidate_* 조인(sid,name,subj,section,position,kw,skill_primary,tpl,item_index …).
import { readFileSync, writeFileSync } from "node:fs";
import { frqOrderComplies } from "../../lib/ap-exam/official-order";
import { elangSectionOf } from "../../lib/ap-exam/elang-rules";

type Row = { sid: string; name: string; subj: string; section: string; position: number; kw: string | null; skill_primary: string | null; tpl: string | null; ckey: string | null };
const rows: Row[] = JSON.parse(readFileSync(process.argv[2], "utf8"));
const sets = new Map<string, Row[]>();
for (const r of rows) (sets.get(r.sid) ?? sets.set(r.sid, []).get(r.sid)!).push(r);
const unitOf = (kw: string | null) => Number(String(kw ?? "").replace(/^U/, "").split(".")[0]);

const out: Record<string, unknown>[] = [];
for (const [sid, items] of sets) {
  const { subj, name } = items[0];
  const by = (sec: string) => items.filter((i) => i.section === sec).sort((a, b) => a.position - b.position);
  const frq = [...by("ap_frq"), ...by("ap_saq")];
  const frqTypes = by("ap_frq").map((i) => i.tpl ?? "");
  const rec: Record<string, unknown> = { setId: sid, subject: subj, name };
  // FRQ 번호 순(규칙 있는 과목만)
  const c = frqOrderComplies(subj, frqTypes); if (c !== null && frqTypes.length) rec.frqOfficialOrderOk = c;
  // USH/WH: SAQ1→2→3, DBQ(frq1)→LEQ(frq2)
  if (subj === "ap_us_history" || subj === "ap_world_history") rec.historyFrqOrderOk = by("ap_saq").map((i) => i.tpl).join() === "saq1,saq2,saq3" && by("ap_frq").map((i) => i.tpl).join() === "dbq,leq";
  // Lang: 읽기 묶음 → 쓰기 묶음(CED Sample Exam: 첫 묶음 읽기, 두 번째 묶음 쓰기)
  if (subj === "ap_english_language") { const kinds = by("ap_mc").map((i) => elangSectionOf(i.skill_primary)); const lastR = kinds.lastIndexOf("reading"), firstW = kinds.indexOf("writing"); rec.langReadingBeforeWritingOk = firstW < 0 || lastR < firstW; }
  // 참고 지표(공식 규칙 아님): MC 단원 오름차순 비율 = 인접 쌍 중 단원이 줄어들지 않는 비율
  for (const sec of ["ap_mc", "ap_mc_a", "ap_mc_b"]) { const m = by(sec); if (m.length > 1) { let ok = 0; for (let i = 1; i < m.length; i++) if (unitOf(m[i].kw) >= unitOf(m[i - 1].kw)) ok++; rec[`${sec}UnitAscRate`] = +(ok / (m.length - 1)).toFixed(3); } }
  rec.frqCount = frq.length;
  out.push(rec);
}
writeFileSync(process.argv[3], JSON.stringify(out, null, 1));
const agg: Record<string, { sets: number; frqOk: number; frqRule: number; asc: number[] }> = {};
for (const r of out) { const a = (agg[r.subject as string] ??= { sets: 0, frqOk: 0, frqRule: 0, asc: [] }); a.sets++; for (const k of ["frqOfficialOrderOk", "historyFrqOrderOk"]) if (k in r) { a.frqRule++; if (r[k]) a.frqOk++; } for (const k of Object.keys(r)) if (k.endsWith("UnitAscRate")) a.asc.push(r[k] as number); }
for (const [s, a] of Object.entries(agg)) console.log(s.padEnd(24), `sets ${a.sets}`, `FRQ순서 ${a.frqRule ? `${a.frqOk}/${a.frqRule}` : "규칙없음"}`, `MC단원오름 평균 ${(a.asc.reduce((x, y) => x + y, 0) / (a.asc.length || 1)).toFixed(3)}`);
