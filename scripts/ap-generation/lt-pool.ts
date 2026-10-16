// AP English Literature 풀 모의고사 배정용 재고 로더(읽기 전용, DB 없음). el-pool.ts 와 같은 재고 정의(자동 통과·결함 0·완전 중복 제외·렌더 게이트 통과·화면 증거 보유)를 문학에 적용한다.
// 후보 모델: MC = 지문 묶음 1개 = 후보 1개(문항 8–13: payload.items 의 skill·topic 이 문항별, 장르 묶음 = payload.lt_passage.group), FRQ = 프롬프트 1개 = 후보 1개(유형 = payload.template: q1 시 / q2 산문 / q3 논증).
import { existsSync, readdirSync, readFileSync } from "../../lib/ap-generation/data-fs";
import { gateCandidate } from "../../lib/ap-figures/gate";
import { clusterLookAlikes } from "../../lib/ap-exam/look-alike";
import { englitCategoryOf, type EnglitGroup } from "../../lib/ap-exam/englit-rules";
import { STOCK_FILES } from "./keys-file";

type Json = Record<string, unknown>;
type Raw = { stockKey: string; apSubjectCode: string; kind: "mc" | "frq_bundle"; validation: string; keywordCode: string; skillPrimary?: string; itemFamilyId: string; payload: Json; duplicateOf?: string | null; archetype?: string; structure?: string; difficultyProvisional?: string | null; difficulty?: unknown };
export type LtMember = { skill: string; cat: string; topic: string };
export type LtItem = { key: string; kind: "mc" | "frq"; group: EnglitGroup | null; members: LtMember[]; fam: string; frqType: string; archetype: string; screen: boolean; batch: string; renderType: string; stimKind: string; /** 문항별 키 신뢰도 평균(0–1), FRQ 는 1. */ conf: number; exam?: number };

export function ltMembers(r: Pick<Raw, "kind" | "payload">): LtMember[] {
  const items = Array.isArray(r.payload.items) ? (r.payload.items as Json[]) : []; if (r.kind !== "mc") return [];
  return items.map((it) => ({ skill: String(it.skill), cat: englitCategoryOf(String(it.skill)) ?? "?", topic: String(it.topic) }));
}
const confOf = (r: Raw): number => { const items = Array.isArray(r.payload.items) ? (r.payload.items as { key_confidence?: { score?: number } }[]) : []; const s = items.map((i) => i.key_confidence?.score).filter((x): x is number => typeof x === "number"); return s.length ? s.reduce((a, b) => a + b, 0) / s.length : 1; };
export function ltExamCount(r: { kind: string; difficulty?: unknown; difficultyProvisional?: string | null; payload?: Json }): number {
  if (r.kind !== "mc") return 0; const n = Array.isArray(r.payload?.items) ? (r.payload!.items as unknown[]).length : 1;
  if (Array.isArray(r.difficulty)) return (r.difficulty as ({ label?: string } | null)[]).filter((d) => d?.label === "exam_prep").length; return r.difficultyProvisional === "exam_prep" ? n : 0;
}
export const ltGroupOf = (r: Pick<Raw, "payload">): EnglitGroup | null => { const g = (r.payload.lt_passage as { group?: string } | undefined)?.group; return g === "short" || g === "poetry" || g === "longer" ? g : null; };

export function loadLtPool(opts: { requireScreen?: boolean; files?: string[] } = {}) {
  const scan = new Set((JSON.parse(readFileSync("data/ap/stock/defect-scan.json", "utf-8")) as { key: string }[]).map((r) => r.key));
  const ev = new Set<string>(); for (const f of readdirSync("data/ap/screen-evidence").filter((x) => /^evidence-.*\.json$/.test(x))) for (const e of (JSON.parse(readFileSync(`data/ap/screen-evidence/${f}`, "utf-8")) as { entries: { candidate_key: string }[] }).entries) ev.add(e.candidate_key);
  const batchOf = new Map<string, string>(); const raws: Raw[] = [];
  for (const f of opts.files ?? STOCK_FILES) { const p = `data/ap/stock/${f}.json`; if (!existsSync(p)) continue; for (const r of JSON.parse(readFileSync(p, "utf-8")) as Raw[]) { if (r.apSubjectCode !== "ap_english_literature" || batchOf.has(r.stockKey)) continue; batchOf.set(r.stockKey, f); raws.push(r); } }
  const live = raws.filter((i) => i.validation === "auto_passed" && !scan.has(i.stockKey) && !i.duplicateOf);
  const gated = live.map((i) => ({ i, g: gateCandidate({ stockKey: i.stockKey, candidateKey: i.stockKey, apSubjectCode: i.apSubjectCode, kind: i.kind, payload: i.payload }) })).filter((x) => x.g.status !== "fail");
  const first = (r: Raw) => (Array.isArray(r.payload.items) ? (r.payload.items as Json[])[0] : r.payload) as { stem?: string };
  const mc = gated.filter((x) => x.i.kind === "mc");
  const cl = clusterLookAlikes(mc.map(({ i }) => ({ key: i.stockKey, family: i.itemFamilyId, archetype: String(i.payload.archetype ?? i.archetype ?? ""), topic: i.keywordCode, stimKind: (i.payload.stimulus as { kind?: string } | undefined)?.kind ?? "none", stem: String(first(i).stem ?? ""), thinking: undefined })));
  const all: LtItem[] = gated.map(({ i, g }) => ({ key: i.stockKey, kind: i.kind === "mc" ? "mc" : "frq", group: i.kind === "mc" ? ltGroupOf(i) : null, members: ltMembers(i), fam: i.kind === "mc" ? (cl.effectiveFamily.get(i.stockKey) ?? i.itemFamilyId) : i.itemFamilyId, frqType: i.kind === "frq_bundle" ? String(i.payload.template ?? "") : "",
    archetype: String(i.payload.archetype ?? i.archetype ?? ""), screen: ev.has(i.stockKey), batch: batchOf.get(i.stockKey) ?? "", renderType: g.renderType, stimKind: g.stimKind, conf: i.kind === "mc" ? confOf(i) : 1, exam: ltExamCount(i) }));
  const pool = opts.requireScreen === false ? all : all.filter((c) => c.screen); return { all, pool };
}
