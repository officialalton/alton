// AP English Language 풀 모의고사 배정용 재고 로더(읽기 전용, DB 없음). cs-pool.ts 와 같은 재고 정의(자동 통과·결함 0·완전 중복 제외·렌더 게이트 통과·화면 증거 보유)를 영어에 적용한다.
// 후보 모델: MC = 지문 묶음 1개 = 후보 1개(문항 3–6: payload.items 의 skill 이 문항별, 읽기/글쓰기는 스킬 첫 숫자로 결정), FRQ = 프롬프트 세트 1개 = 후보 1개(유형 = payload.template: q1 종합 / q2 수사 분석 / q3 논증).
// 문항군(fam)은 buildStock 의 itemFamilyId(원형 id 가 묶음마다 달라 묶음 = 문항군)에 구조 look-alike 군집을 합친 값이다 — 한 시험에 같은 군을 두 번 넣지 않는다.
import { existsSync, readdirSync, readFileSync } from "../../lib/ap-generation/data-fs";
import { gateCandidate } from "../../lib/ap-figures/gate";
import { clusterLookAlikes } from "../../lib/ap-exam/look-alike";
import { elangCategoryOf, elangSectionOf } from "../../lib/ap-exam/elang-rules";
import { STOCK_FILES } from "./keys-file";

type Json = Record<string, unknown>;
type Raw = { stockKey: string; apSubjectCode: string; kind: "mc" | "frq_bundle"; validation: string; keywordCode: string; skillPrimary?: string; itemFamilyId: string; payload: Json; duplicateOf?: string | null; archetype?: string; structure?: string; difficultyProvisional?: string | null; difficulty?: unknown };
/** skill: "3.B", cat: "CE-R", topic: "U6.1". */
export type ElMember = { skill: string; cat: string; topic: string };
export type ElItem = { key: string; kind: "mc" | "frq"; section: "reading" | "writing" | null; members: ElMember[]; fam: string; frqType: string; archetype: string; screen: boolean; batch: string; renderType: string; stimKind: string; /** 문항별 키 신뢰도 평균(0–1), FRQ 는 1. */ conf: number; exam?: number };

export function elMembers(r: Pick<Raw, "kind" | "payload">): ElMember[] {
  const items = Array.isArray(r.payload.items) ? (r.payload.items as Json[]) : [];
  if (r.kind !== "mc") return [];
  return items.map((it) => ({ skill: String(it.skill), cat: elangCategoryOf(String(it.skill)) ?? "?", topic: String(it.topic) }));
}
const confOf = (r: Raw): number => { const items = Array.isArray(r.payload.items) ? (r.payload.items as { key_confidence?: { score?: number } }[]) : []; const s = items.map((i) => i.key_confidence?.score).filter((x): x is number => typeof x === "number"); return s.length ? s.reduce((a, b) => a + b, 0) / s.length : 1; };
export function elExamCount(r: { kind: string; difficulty?: unknown; difficultyProvisional?: string | null; payload?: Json }): number {
  if (r.kind !== "mc") return 0;
  const n = Array.isArray(r.payload?.items) ? (r.payload!.items as unknown[]).length : 1;
  if (Array.isArray(r.difficulty)) return (r.difficulty as ({ label?: string } | null)[]).filter((d) => d?.label === "exam_prep").length;
  return r.difficultyProvisional === "exam_prep" ? n : 0;
}

export function loadElPool(opts: { requireScreen?: boolean; files?: string[] } = {}) {
  const scan = new Set((JSON.parse(readFileSync("data/ap/stock/defect-scan.json", "utf-8")) as { key: string }[]).map((r) => r.key));
  const ev = new Set<string>();
  for (const f of readdirSync("data/ap/screen-evidence").filter((x) => /^evidence-.*\.json$/.test(x))) for (const e of (JSON.parse(readFileSync(`data/ap/screen-evidence/${f}`, "utf-8")) as { entries: { candidate_key: string }[] }).entries) ev.add(e.candidate_key);
  const batchOf = new Map<string, string>(); const raws: Raw[] = [];
  for (const f of opts.files ?? STOCK_FILES) { const p = `data/ap/stock/${f}.json`; if (!existsSync(p)) continue; for (const r of JSON.parse(readFileSync(p, "utf-8")) as Raw[]) { if (r.apSubjectCode !== "ap_english_language" || batchOf.has(r.stockKey)) continue; batchOf.set(r.stockKey, f); raws.push(r); } }
  const live = raws.filter((i) => i.validation === "auto_passed" && !scan.has(i.stockKey) && !i.duplicateOf);
  const gated = live.map((i) => ({ i, g: gateCandidate({ stockKey: i.stockKey, candidateKey: i.stockKey, apSubjectCode: i.apSubjectCode, kind: i.kind, payload: i.payload }) })).filter((x) => x.g.status !== "fail");
  const first = (r: Raw) => (Array.isArray(r.payload.items) ? (r.payload.items as Json[])[0] : r.payload) as { stem?: string; blueprint?: { student_thinking?: string[] } };
  const mc = gated.filter((x) => x.i.kind === "mc");
  const cl = clusterLookAlikes(mc.map(({ i }) => ({ key: i.stockKey, family: i.itemFamilyId, archetype: String(i.payload.archetype ?? i.archetype ?? ""), topic: i.keywordCode, stimKind: (i.payload.stimulus as { kind?: string } | undefined)?.kind ?? "none", stem: String(first(i).stem ?? ""), thinking: first(i).blueprint?.student_thinking })));
  const all: ElItem[] = gated.map(({ i, g }) => {
    const members = elMembers(i); const section = i.kind === "mc" ? (new Set(members.map((m) => elangSectionOf(m.skill))).size === 1 ? elangSectionOf(members[0]?.skill) : null) : null;
    return { key: i.stockKey, kind: i.kind === "mc" ? "mc" : "frq", section, members, fam: i.kind === "mc" ? (cl.effectiveFamily.get(i.stockKey) ?? i.itemFamilyId) : i.itemFamilyId, frqType: i.kind === "frq_bundle" ? String(i.payload.template ?? "") : "",
      archetype: String(i.payload.archetype ?? i.archetype ?? ""), screen: ev.has(i.stockKey), batch: batchOf.get(i.stockKey) ?? "", renderType: g.renderType, stimKind: g.stimKind, conf: i.kind === "mc" ? confOf(i) : 1, exam: elExamCount(i) };
  });
  const pool = opts.requireScreen === false ? all : all.filter((c) => c.screen);
  return { all, pool };
}
