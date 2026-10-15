// AP U.S. History 풀 모의고사 배정용 재고 로더(읽기 전용, DB 없음). el-pool.ts 와 같은 재고 정의(자동 통과·결함 0·완전 중복 제외·렌더 게이트 통과·화면 증거 보유).
// 후보 모델: MC = 자료 세트 1개 = 후보 1개(문항 3–4: payload.items 의 skill·topic), FRQ = 문항 1개 = 후보 1개(유형 = payload.template: saq1|saq2|saq3|dbq|leq; 시대 = payload.ush_frq.period).
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { gateCandidate } from "../../lib/ap-figures/gate";
import { ushSkillCat, ushUnitOfTopic } from "../../lib/ap-exam/ush-rules";
import { STOCK_FILES } from "./keys-file";

type Json = Record<string, unknown>;
type Raw = { stockKey: string; apSubjectCode: string; kind: "mc" | "frq_bundle"; validation: string; keywordCode: string; itemFamilyId: string; payload: Json; duplicateOf?: string | null; archetype?: string; difficultyProvisional?: string | null; difficulty?: unknown };
/** skill: "3.B", cat: "3", topic: "3.5", unit: "3". */
export type UshMember = { skill: string; cat: string; topic: string; unit: string };
export type UshItem = { key: string; kind: "mc" | "frq"; members: UshMember[]; fam: string; template: string; period: number; stim: string; theme: string; screen: boolean; batch: string; renderType: string; stimKind: string; exam: number };

export function ushMembers(r: Pick<Raw, "kind" | "payload">): UshMember[] {
  if (r.kind !== "mc") return [];
  return (Array.isArray(r.payload.items) ? (r.payload.items as Json[]) : []).map((it) => ({ skill: String(it.skill), cat: ushSkillCat(String(it.skill)), topic: String(it.topic), unit: ushUnitOfTopic(String(it.topic)) }));
}
export function ushExamCount(r: { kind: string; difficulty?: unknown; difficultyProvisional?: string | null; payload?: Json }): number {
  if (r.kind !== "mc") return 0; const n = Array.isArray(r.payload?.items) ? (r.payload!.items as unknown[]).length : 1;
  if (Array.isArray(r.difficulty)) return (r.difficulty as ({ label?: string } | null)[]).filter((d) => d?.label === "exam_prep").length;
  return r.difficultyProvisional === "exam_prep" ? n : 0;
}
export function loadUshPool(opts: { requireScreen?: boolean; files?: string[] } = {}) {
  const scan = new Set((JSON.parse(readFileSync("data/ap/stock/defect-scan.json", "utf-8")) as { key: string }[]).map((r) => r.key));
  const ev = new Set<string>();
  for (const f of readdirSync("data/ap/screen-evidence").filter((x) => /^evidence-.*\.json$/.test(x))) for (const e of (JSON.parse(readFileSync(`data/ap/screen-evidence/${f}`, "utf-8")) as { entries: { candidate_key: string }[] }).entries) ev.add(e.candidate_key);
  const batchOf = new Map<string, string>(); const raws: Raw[] = [];
  for (const f of opts.files ?? STOCK_FILES) { const p = `data/ap/stock/${f}.json`; if (!existsSync(p)) continue; for (const r of JSON.parse(readFileSync(p, "utf-8")) as Raw[]) { if (r.apSubjectCode !== "ap_us_history" || batchOf.has(r.stockKey)) continue; batchOf.set(r.stockKey, f); raws.push(r); } }
  const live = raws.filter((i) => i.validation === "auto_passed" && !scan.has(i.stockKey) && !i.duplicateOf);
  const gated = live.map((i) => ({ i, g: gateCandidate({ stockKey: i.stockKey, candidateKey: i.stockKey, apSubjectCode: i.apSubjectCode, kind: i.kind, payload: i.payload }) })).filter((x) => x.g.status !== "fail");
  const all: UshItem[] = gated.map(({ i, g }) => {
    const set = (i.payload.ush_set ?? {}) as { period?: number; stim_type?: string; theme?: string }; const fq = (i.payload.ush_frq ?? {}) as { period?: number };
    return { key: i.stockKey, kind: i.kind === "mc" ? "mc" : "frq", members: ushMembers(i), fam: i.kind === "mc" ? `theme:${set.theme ?? i.stockKey}` : `frq:${i.stockKey}`, template: i.kind === "frq_bundle" ? String(i.payload.template ?? "") : "", period: Number(set.period ?? fq.period ?? 0), stim: String(set.stim_type ?? ""), theme: String(set.theme ?? ""), screen: ev.has(i.stockKey), batch: batchOf.get(i.stockKey) ?? "", renderType: g.renderType, stimKind: g.stimKind, exam: ushExamCount(i) };
  });
  const pool = opts.requireScreen === false ? all : all.filter((c) => c.screen);
  return { all, pool };
}
