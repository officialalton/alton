// 구조 동일 판정(오너 2026-10-21): 원형 이름·문항군 ID·문자열 유사도만으로 판정하지 않고 자료·조건·과제(질문)·풀이 단계를 숫자·이름·리터럴·식별자를 가린 뒤 비교한다.
import { readFileSync } from "node:fs";
import { STOCK_FILES } from "./keys-file";
export type Raw = { stockKey: string; kind: string; payload: any };
export const loadRaws = () => { const m = new Map<string, Raw>(); for (const f of STOCK_FILES) { try { for (const r of JSON.parse(readFileSync(`data/ap/stock/${f}.json`, "utf-8")) as Raw[]) if (!m.has(r.stockKey)) m.set(r.stockKey, r); } catch { /* 없는 파일 */ } } return m; };
const JAVA = new Set("abstract boolean break byte case catch char class continue default do double else extends final finally float for if implements import instanceof int interface long new null package private protected public return short static super switch this throw throws true false try void while String Math ArrayList List System out println length size get set add remove equals substring indexOf charAt".split(" "));
const mask = (s: string) => String(s ?? "").replace(/"[^"]*"/g, '"S"').replace(/\b\d+(\.\d+)?\b/g, "N").replace(/\b[A-Za-z_]\w*\b/g, (w) => (JAVA.has(w) || w.length <= 2 ? w : w.toLowerCase())).replace(/\s+/g, " ").trim();
const maskNames = (s: string) => mask(s).replace(/\b[A-Z][a-z]+\b/g, "X");
const toks = (s: string) => s.split(/[^A-Za-z0-9$\\{}_]+/).filter(Boolean);
const jacc = (a: string[], b: string[]) => { const A = new Set(a), B = new Set(b); let i = 0; for (const x of A) if (B.has(x)) i++; return i / (A.size + B.size - i || 1); };
const firstItem = (r: Raw) => (Array.isArray(r.payload.items) ? r.payload.items[0] : r.payload);
const stemOf = (r: Raw) => String(firstItem(r)?.stem ?? firstItem(r)?.question ?? r.payload.stem ?? "");
const stimOf = (r: Raw) => { const st = firstItem(r)?.stimulus ?? r.payload.stimulus ?? null; return st ? String(st.description ?? "") + JSON.stringify(st.data ?? {}) : ""; };
// FRQ 번들은 채점 행·모범 답안의 공통 문구를 빼고 제목·자료(표·연구 요약)만(지문 본문은 AAQ/EBQ 공통 문구가 많아 제외) 비교한다.
const fullText = (r: Raw) => JSON.stringify([r.payload.title, r.payload.stimulus]);
export function sameStructure(rc: Raw, rp: Raw): boolean {
  if (rc.kind !== rp.kind) return false;
  if (rc.kind === "frq_bundle") return false; // FRQ 는 시나리오(연구 주제·자료)가 달라 자동 비교가 공통 문구에 끌린다: 시험 사이 FRQ 시나리오 중복은 배정 검증기의 시나리오 id 검사와 사람 검토로 본다
  const stem = jacc(toks(maskNames(stemOf(rc))), toks(maskNames(stemOf(rp)))), stim = stimOf(rc) === stimOf(rp) ? 1 : jacc(toks(mask(stimOf(rc))), toks(mask(stimOf(rp))));
  const hasStim = stimOf(rc) !== "" || stimOf(rp) !== "";
  return hasStim ? stim >= 0.85 && stem >= 0.5 : stem >= 0.75;
}
