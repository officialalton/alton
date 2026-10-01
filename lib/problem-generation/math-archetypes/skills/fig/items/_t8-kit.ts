// T8(표 선택지형 C) 조합 공용 헬퍼 — 값표 4개 중 조건을 만족하는 표 하나 고르기.
// 오답 후보는 '선언된 오답 규칙'으로 만들고, 같은 diagnoseJs 를 TS 에서도 실행해 '진단되는 규칙'으로 라벨한다(만든 규칙과 진단이 어긋나면 버림).
// 표 선택지 구별 보장: 네 표의 rows 를 JSON 으로 비교해 서로 다를 때만 쓴다(placeChoices 가 다시 확인) — 같은 x 열이라도 최소 한 칸의 값이 다르다.
import { GenFail } from "../../../types";
import type { Rng } from "../../../rng";
import { placeChoices } from "../../../figure-kit";

export type Rows = number[][];
export const tabFig = (cols: [string, string], rows: Rows) => ({ type: "data" as const, kind: "table" as const, columns: [...cols], rows: rows.map((r) => [...r]) });
type Fn = (...a: unknown[]) => unknown;
/** predicateJs·diagnoseJs 를 TS 에서 그대로 실행(검증기와 같은 판정). */
export const jsFn = (args: string[], body: string): Fn => new Function(...args, body) as Fn;

export function tableChoices(rng: Rng, o: { cols: [string, string]; ok: Rows; cands: { rule: string; rows: Rows | null }[]; P: Record<string, number | string>; predicateJs: string; diagnoseJs: string }) {
  const pred = jsFn(["c", "i", "P"], o.predicateJs); const diag = jsFn(["c", "ok", "P"], o.diagnoseJs);
  const okFig = tabFig(o.cols, o.ok); if (!pred(okFig, 0, o.P)) throw new GenFail("정답 표가 조건을 만족하지 않음");
  const seen = new Set<string>([JSON.stringify(o.ok)]); const rulesSeen = new Set<string>(); const picked: { fig: unknown; rule: string }[] = [];
  for (const w of rng.shuffle(o.cands)) {
    if (picked.length >= 3) break; if (!w.rows) continue;
    if (w.rows.some((r) => r.some((v) => !Number.isFinite(v) || !Number.isInteger(v) || Math.abs(v) > 99999))) continue;
    const fig = tabFig(o.cols, w.rows); const k = JSON.stringify(w.rows); if (seen.has(k) || pred(fig, 0, o.P)) continue;
    const rule = diag(fig, okFig, o.P) as string | null; if (rule !== w.rule || rulesSeen.has(rule)) continue;
    seen.add(k); rulesSeen.add(rule); picked.push({ fig, rule });
  }
  if (picked.length < 3) throw new GenFail("표 오답 후보 부족");
  return placeChoices(rng, okFig, picked);
}
export const SPR_NO_TABLE = "선택지가 값표 4개이고 그중 조건을 만족하는 표를 고르는 것이 문제의 핵심이라 선택지 없이는 성립하지 않는다";
