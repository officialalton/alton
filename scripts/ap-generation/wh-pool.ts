// AP World History 풀 모의고사 배정용 재고 로더(읽기 전용, DB 없음). el-pool.ts 와 같은 재고 정의(자동 통과·결함 0·완전 중복 제외·렌더 게이트 통과·화면 증거 보유).
// 후보 모델: MC = 자료 세트 1개 = 후보 1개(문항 3–4: payload.items 의 skill·topic), FRQ = 문항 1개 = 후보 1개(유형 = payload.template: saq1|saq2|saq3|dbq|leq; 시대 = payload.whap_frq.period).
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { gateCandidate } from "../../lib/ap-figures/gate";
import { whSkillCat, whUnitOfTopic } from "../../lib/ap-exam/wh-rules";
import { STOCK_FILES } from "./keys-file";

type Json = Record<string, unknown>;
type Raw = { stockKey: string; apSubjectCode: string; kind: "mc" | "frq_bundle"; validation: string; keywordCode: string; itemFamilyId: string; payload: Json; duplicateOf?: string | null; archetype?: string; difficultyProvisional?: string | null; difficulty?: unknown };
/** skill: "3.B", cat: "3", topic: "3.5", unit: "3". */
export type WhMember = { skill: string; cat: string; topic: string; unit: string; topicUnit: string };
export type WhItem = { /** 후보 keyword_code 의 단원 — 관리자 새 버전·초안이 DB 에서 읽는 세트 단위(세트 전 문항에 같은 값). members[].unit 은 문항별 토픽 단원. */ keyUnit: string; key: string; kind: "mc" | "frq"; members: WhMember[]; fam: string; template: string; era: number; stim: string; theme: string; screen: boolean; batch: string; renderType: string; stimKind: string; exam: number };

/** member.unit = 후보 keyword_code 단원(= DB 가 읽는 단원, 세트 전 문항 같은 값). 배정기·검증기·관리자 새 버전 검사가 같은 단원 개념을 쓰게 한다(US History 1단계 불일치 교훈). 문항별 토픽 단원은 topicUnit. */
export function whMembers(r: Pick<Raw, "kind" | "payload"> & { keywordCode?: string }): WhMember[] {
  if (r.kind !== "mc") return [];
  const keyUnit = String(r.keywordCode ?? "").split(".")[0];
  return (Array.isArray(r.payload.items) ? (r.payload.items as Json[]) : []).map((it) => ({ skill: String(it.skill), cat: whSkillCat(String(it.skill)), topic: String(it.topic), unit: keyUnit || whUnitOfTopic(String(it.topic)), topicUnit: whUnitOfTopic(String(it.topic)) }));
}
export function whExamCount(r: { kind: string; difficulty?: unknown; difficultyProvisional?: string | null; payload?: Json }): number {
  if (r.kind !== "mc") return 0; const n = Array.isArray(r.payload?.items) ? (r.payload!.items as unknown[]).length : 1;
  if (Array.isArray(r.difficulty)) return (r.difficulty as ({ label?: string } | null)[]).filter((d) => d?.label === "exam_prep").length;
  return r.difficultyProvisional === "exam_prep" ? n : 0;
}
export function loadWhPool(opts: { requireScreen?: boolean; files?: string[] } = {}) {
  const scan = new Set((JSON.parse(readFileSync("data/ap/stock/defect-scan.json", "utf-8")) as { key: string }[]).map((r) => r.key));
  const ev = new Set<string>();
  for (const f of readdirSync("data/ap/screen-evidence").filter((x) => /^evidence-.*\.json$/.test(x))) for (const e of (JSON.parse(readFileSync(`data/ap/screen-evidence/${f}`, "utf-8")) as { entries: { candidate_key: string }[] }).entries) ev.add(e.candidate_key);
  const batchOf = new Map<string, string>(); const raws: Raw[] = [];
  for (const f of opts.files ?? STOCK_FILES) { const p = `data/ap/stock/${f}.json`; if (!existsSync(p)) continue; for (const r of JSON.parse(readFileSync(p, "utf-8")) as Raw[]) { if (r.apSubjectCode !== "ap_world_history" || batchOf.has(r.stockKey)) continue; batchOf.set(r.stockKey, f); raws.push(r); } }
  const live = raws.filter((i) => i.validation === "auto_passed" && !scan.has(i.stockKey) && !i.duplicateOf);
  const gated = live.map((i) => ({ i, g: gateCandidate({ stockKey: i.stockKey, candidateKey: i.stockKey, apSubjectCode: i.apSubjectCode, kind: i.kind, payload: i.payload }) })).filter((x) => x.g.status !== "fail");
  const all: WhItem[] = gated.map(({ i, g }) => {
    const set = (i.payload.wh_set ?? {}) as { stim_type?: string; theme?: string }; const fq = (i.payload.whap_frq ?? {}) as { era?: number };
    return { key: i.stockKey, kind: i.kind === "mc" ? "mc" : "frq", keyUnit: String(i.keywordCode ?? "").split(".")[0], members: whMembers(i), fam: i.kind === "mc" ? `theme:${set.theme ?? i.stockKey}` : `frq:${i.stockKey}`, template: i.kind === "frq_bundle" ? String(i.payload.template ?? "") : "", era: Number(fq.era ?? 0), stim: String(set.stim_type ?? ""), theme: String(set.theme ?? ""), screen: ev.has(i.stockKey), batch: batchOf.get(i.stockKey) ?? "", renderType: g.renderType, stimKind: g.stimKind, exam: whExamCount(i) };
  });
  const pool = opts.requireScreen === false ? all : all.filter((c) => c.screen);
  return { all, pool };
}
