// 2026-10-21 오너 정정: 중복 판정은 원형 이름·토픽·문자열 유사도만으로 하지 않는다. 금지 대상으로 제외된 후보를 공개 문항과 자료·조건·요구 과제·추론 단계로 다시 비교한다(무료, DB 없음).
//   npx tsx scripts/ap-generation/lookalike-recheck.ts chem|csa|psych [--write <경로>]
// 비교 단위(문항 한 개): ① 자료(표·그림 종류와 값 구조) ② 조건(상황·주어진 수치·코드 구조) ③ 요구 과제(질문 문장) ④ 풀이 단계(blueprint thinking). 숫자·이름·문자열 리터럴·식별자는 가려서(마스킹) 비교한다.
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { STOCK_FILES } from "./keys-file";
const subj = process.argv[2]; const arg = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : ""; };
type Raw = { stockKey: string; kind: string; keywordCode: string; itemFamilyId: string; payload: any; archetype?: string };
const raws = new Map<string, Raw>();
for (const f of STOCK_FILES) { try { for (const r of JSON.parse(readFileSync(`data/ap/stock/${f}.json`, "utf-8")) as Raw[]) if (!raws.has(r.stockKey)) raws.set(r.stockKey, r); } catch { /* 없는 파일 */ } }
const JAVA = new Set("abstract boolean break byte case catch char class continue default do double else extends final finally float for if implements import instanceof int interface long new null package private protected public return short static super switch this throw throws true false try void while String Math ArrayList List System out println length size get set add remove equals substring indexOf charAt".split(" "));
const mask = (s: string) => String(s ?? "").replace(/"[^"]*"/g, '"S"').replace(/\b\d+(\.\d+)?\b/g, "N").replace(/\b[A-Za-z_]\w*\b/g, (w) => (JAVA.has(w) || w.length <= 2 ? w : w.toLowerCase())).replace(/\s+/g, " ").trim();
const maskNames = (s: string) => mask(s).replace(/\b[A-Z][a-z]+\b/g, "X");
const toks = (s: string) => s.split(/[^A-Za-z0-9$\\{}_]+/).filter(Boolean);
const jacc = (a: string[], b: string[]) => { const A = new Set(a), B = new Set(b); let i = 0; for (const x of A) if (B.has(x)) i++; return i / (A.size + B.size - i || 1); };
const firstItem = (r: Raw) => (Array.isArray(r.payload.items) ? r.payload.items[0] : r.payload);
const stemOf = (r: Raw) => String(firstItem(r)?.stem ?? firstItem(r)?.question ?? r.payload.stem ?? "");
const keyOf = (r: Raw) => { const it = firstItem(r); const o = (it?.options ?? []) as any[]; const k = o.find((x) => x.correct || x.is_key) ?? o[it?.key_index ?? -1]; return String(k?.text ?? it?.key ?? ""); };
const stimOf = (r: Raw) => { const st = firstItem(r)?.stimulus ?? r.payload.stimulus ?? null; return st ? String(st.description ?? "") + JSON.stringify(st.data ?? {}) : ""; };
const fullText = (r: Raw) => JSON.stringify(r.payload, (k, v) => (k === "blueprint" || k === "why" || k === "difficulty_signals" || k === "variant_id" ? undefined : v));
const stepsOf = (r: Raw) => ((r.payload.blueprint ?? firstItem(r)?.blueprint)?.student_thinking ?? []) as string[];
type Row = { cand: string; pub: string; archetype: string; topic: string; stem: number; key: number; stim: number; steps: number; verdict: string };
async function main() {
  const pubKeys = new Set<string>((JSON.parse(readFileSync(`data/ap/stock/blocked-db-${subj}.json`, "utf-8")) as any).sets.flatMap((s: any) => [...(s.mcA ?? []), ...(s.frqA ?? [])]));
  let all: any[];
  if (subj === "chem") { const { loadChemPool } = await import("./chem-pool"); all = loadChemPool({ requireScreen: false }).all; }
  else if (subj === "csa") { const { loadCsPool } = await import("./cs-pool"); all = loadCsPool({ requireScreen: false }).all; }
  else { const { loadPsychPool } = await import("./psych-pool"); all = loadPsychPool({ requireScreen: false }).all; }
  const pubFam = new Map<string, any[]>(); for (const c of all) if (pubKeys.has(c.key)) (pubFam.get(c.fam) ?? pubFam.set(c.fam, []).get(c.fam)!).push(c);
  const pubAll = all.filter((c) => pubKeys.has(c.key));
  const excluded = all.filter((c) => !pubKeys.has(c.key) && pubFam.has(c.fam));
  const rows: Row[] = [];
  for (const c of excluded) {
    const rc = raws.get(c.key); if (!rc) continue;
    let best: Row | null = null;
    for (const p of pubAll) {
      const rp = raws.get(p.key); if (!rp) continue;
      const stem = jacc(toks(maskNames(stemOf(rc))), toks(maskNames(stemOf(rp)))), key = jacc(toks(maskNames(keyOf(rc))), toks(maskNames(keyOf(rp)))), stim = stimOf(rc) === stimOf(rp) ? 1 : jacc(toks(mask(stimOf(rc))), toks(mask(stimOf(rp)))), steps = jacc(stepsOf(rc).flatMap((s) => toks(mask(s))), stepsOf(rp).flatMap((s) => toks(mask(s))));
      const full = jacc(toks(maskNames(fullText(rc))), toks(maskNames(fullText(rp))));
      const hasStim = stimOf(rc) !== "" || stimOf(rp) !== ""; const sameStruct = rc.kind === "frq_bundle" ? full >= 0.8 : hasStim ? stim >= 0.85 && stem >= 0.5 : stem >= 0.75; // 마스킹 후 자료·조건·과제가 같음 = 숫자·이름·문장만 다른 변형(선택지 파싱 차이로 key 만 어긋나도 같다고 본다). FRQ 번들은 전체 본문 비교
      const r: Row = { cand: c.key, pub: p.key, archetype: c.archetype, topic: c.members?.[0]?.topic ?? "", stem: +(rc.kind === "frq_bundle" ? full : stem).toFixed(2), key: +key.toFixed(2), stim: +stim.toFixed(2), steps: +steps.toFixed(2), verdict: sameStruct ? "same_structure" : (!hasStim && stem >= 0.55 && steps >= 0.9 && rc.kind !== "frq_bundle") ? "needs_review" : "different_material_or_task" };
      const sc = (rc.kind === "frq_bundle" ? full : stem + (hasStim ? stim : 0)); if (!best || sc > (best as any)._s) best = Object.assign(r, { _s: sc });
    }
    if (best) rows.push(best);
  }
  const same = rows.filter((r) => r.verdict === "same_structure"), review = rows.filter((r) => r.verdict === "needs_review"), diff = rows.filter((r) => r.verdict === "different_material_or_task");
  console.log(`[${subj}] 제외 후보 ${excluded.length}개 재검토: 구조 동일(숫자·이름·문장만 다름) ${same.length}, 자료·조건·과제가 달라 복구 후보 ${diff.length}, 풀이 단계 같고 과제·조건 일부만 달라 수동 검토 ${review.length}`);
  for (const r of diff.slice(0, 12)) console.log(`  복구후보 ${r.cand} ↔ ${r.pub} [${r.archetype} ${r.topic}] stem ${r.stem} key ${r.key} stim ${r.stim} steps ${r.steps}`);
  const w = arg("--write"); if (w) writeFileSync(w, JSON.stringify({ subject: subj, excluded: excluded.length, same: same.length, recoverable: diff.map((r) => r.cand), needsReview: review.map((r) => r.cand), rows }, null, 1));
}
main();
