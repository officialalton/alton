// AP 모의고사 세트 조립 계획(순수 함수). **모의고사 용도(purpose=mock_exam)로 변환된 문항만** 후보가 된다 —
// 수업용(lesson) 문항은 입력에 있어도 버린다(DB 트리거가 한 번 더 막는다). 한 문항은 한 세트에만 쓴다(오너 정책: 세트 간 중복 없음).
import { sectionsForLabel, type ApSetLabel, type ApSection } from "./layouts";

export type AssembleCandidate = {
  candidateKey: string; problemId: string; versionId: string; kind: "mc" | "frq_bundle"; purpose: "mock_exam" | "lesson" | null;
  releaseTier: string; calculator: string; keywordCode: string; itemFamilyId: string | null; difficulty: "easy" | "medium" | "hard"; itemIndex: number;
};
/** 세트 유형별 겹침 허용(이전 세트에서 가져올 수 있는 문항 수). 전체 길이 모의고사 기본 0(오너 정책 2026-10-09: 영구 "한 문항 한 세트" 규칙 아님 — 단원 연습·오답 복습은 재사용 가능, 전체 모의고사는 기본 중복 없음). */
export const OVERLAP_DEFAULTS: Record<ApSetLabel, number> = { full_practice: 0, mc_practice: 0, frq_practice: 0 };
export type AssembleOptions = {
  /** 이전 세트에서 재사용할 수 있는 최대 문항 수(세트 합계). 기본 OVERLAP_DEFAULTS[label]. */
  maxOverlap?: number;
  /** 문항군당 세트 내 최대 문항 수: MC 기본 2, FRQ 기본 1(수치만 다른 변형으로 FRQ 를 채우지 않는다). */
  maxPerFamily?: Partial<Record<"mc" | "frq_bundle", number>>;
  /** 세트 내 서로 다른 문항군 최소 수. 기본: MC ceil(문항 수/2), FRQ 문항 수(전부 다른 문항군). */
  minDistinctFamilies?: Partial<Record<"mc" | "frq_bundle", number>>;
  /** 공식 단원 비중(MC 문항 수 최소·최대, 세트 합계 기준). 있으면 구성 검증과 선택에 쓴다. */
  unitBounds?: Record<string, { min: number; max: number }>;
  /** 부분 연습 세트: 이 섹션 키만 조립(예: ["ap_mc_a"] = 계산기 불가 MC 29). 기본은 라벨이 요구하는 모든 섹션. */
  onlySections?: string[];
};
export type AssemblePlan = {
  compositionIssues: string[]; diversityIssues: string[]; reused: number;
  ok: boolean;
  items: { sectionKey: string; position: number; c: AssembleCandidate }[];
  shortfall: { sectionKey: string; need: number; have: number }[];
};

const unitOf = (k: string) => k.split(".")[0];
const calcOk = (sec: ApSection, cand: string) =>
  sec.calculator === "required" ? cand === "required" : sec.calculator === "not_allowed" ? cand === "not_allowed" : sec.calculator === "allowed" ? cand !== "not_allowed" : true;

/** MC 는 단원(unit)을 돌아가며, 같은 문항군(family)은 최대 2개. 사용한 문항은 같은 세트에서 다시 쓰지 않는다. */
export function planApSet(subject: string, label: ApSetLabel, pool: AssembleCandidate[], usedProblemIds: Set<string> = new Set(), opts: AssembleOptions = {}): AssemblePlan {
  const maxOverlap = opts.maxOverlap ?? OVERLAP_DEFAULTS[label]; let reused = 0;
  const eligible = pool.filter((c) => c.purpose === "mock_exam" && (c.releaseTier === "review_env" || c.releaseTier === "launch"));
  const unitCount = new Map<string, number>(); const capOf = (k: "mc" | "frq_bundle") => opts.maxPerFamily?.[k] ?? (k === "mc" ? 2 : 1);
  const taken = new Set<string>();
  const famCount = new Map<string, number>();
  const items: AssemblePlan["items"] = [];
  const shortfall: AssemblePlan["shortfall"] = [];
  for (const sec of sectionsForLabel(subject, label).filter((x) => !opts.onlySections || opts.onlySections.includes(x.key))) {
    const kind = sec.kind === "mc" ? "mc" : "frq_bundle";
    const cands = eligible.filter((c) => c.kind === kind && !taken.has(c.problemId) && calcOk(sec, c.calculator));
    const famCap = capOf(kind);
    const byUnit = new Map<string, AssembleCandidate[]>();
    for (const c of cands.sort((a, b) => a.candidateKey.localeCompare(b.candidateKey))) { const u = unitOf(c.keywordCode); byUnit.set(u, [...(byUnit.get(u) ?? []), c]); }
    const picked: AssembleCandidate[] = [];
    const units = [...byUnit.keys()].sort();
    let progress = true;
    while (picked.length < sec.count && progress) {
      progress = false;
      for (const u of units) {
        if (picked.length >= sec.count) break;
        const list = byUnit.get(u)!;
        while (list.length) {
          const c = list.shift()!;
          const fam = c.itemFamilyId ?? c.candidateKey; const isReuse = usedProblemIds.has(c.problemId);
          if ((famCount.get(fam) ?? 0) >= famCap) continue;
          if (isReuse && reused >= maxOverlap) continue; // 겹침 상한(전체 모의고사 기본 0)
          const ub = opts.unitBounds?.[u]; if (kind === "mc" && ub && (unitCount.get(u) ?? 0) >= ub.max) continue; // 단원 비중 상한
          if (isReuse) reused += 1; unitCount.set(u, (unitCount.get(u) ?? 0) + (kind === "mc" ? 1 : 0));
          famCount.set(fam, (famCount.get(fam) ?? 0) + 1); picked.push(c); taken.add(c.problemId); progress = true; break;
        }
      }
    }
    picked.forEach((c, i) => items.push({ sectionKey: sec.key, position: i + 1, c }));
    if (picked.length < sec.count) shortfall.push({ sectionKey: sec.key, need: sec.count, have: picked.length });
  }
  const compositionIssues: string[] = []; const diversityIssues: string[] = [];
  if (opts.unitBounds) { const mcItems = items.filter((i) => i.c.kind === "mc"); if (mcItems.length) for (const [u, b] of Object.entries(opts.unitBounds)) { const n = mcItems.filter((i) => unitOf(i.c.keywordCode) === u).length; if (n < b.min) compositionIssues.push(`unit_${u}_below_min_${n}/${b.min}`); if (n > b.max) compositionIssues.push(`unit_${u}_above_max_${n}/${b.max}`); } }
  for (const k of ["mc", "frq_bundle"] as const) { const its = items.filter((i) => i.c.kind === k); if (!its.length) continue; const floor = opts.minDistinctFamilies?.[k] ?? (k === "mc" ? Math.ceil(its.length / 2) : its.length); const d = new Set(its.map((i) => i.c.itemFamilyId ?? i.c.candidateKey)).size; if (d < floor) diversityIssues.push(`${k}_distinct_families_${d}/${floor}`); }
  return { ok: shortfall.length === 0 && compositionIssues.length === 0 && diversityIssues.length === 0, items, shortfall, compositionIssues, diversityIssues, reused };
}
