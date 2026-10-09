// AP 모의고사 세트 조립 계획(순수 함수). **모의고사 용도(purpose=mock_exam)로 변환된 문항만** 후보가 된다 —
// 수업용(lesson) 문항은 입력에 있어도 버린다(DB 트리거가 한 번 더 막는다). 한 문항은 한 세트에만 쓴다(오너 정책: 세트 간 중복 없음).
import { AP_PARTIALS, partialLabelAllowed, partialSetName, sectionsForLabel, sectionsForPartial, type ApPartialId, type ApSetLabel, type ApSection } from "./layouts";

export type AssembleCandidate = {
  candidateKey: string; problemId: string; versionId: string; kind: "mc" | "frq_bundle"; purpose: "mock_exam" | "lesson" | null;
  releaseTier: string; calculator: string; keywordCode: string; itemFamilyId: string | null; difficulty: "easy" | "medium" | "hard"; itemIndex: number;
  archetype?: string | null; skill?: string | null;
};
export type AssembleOptions = {
  /** 이전 세트에서 재사용할 수 있는 최대 문항 수(세트 합계). 기본 OVERLAP_DEFAULT.full(0). */
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
  const maxOverlap = opts.maxOverlap ?? OVERLAP_DEFAULT.full; let reused = 0; // 겹침 정책은 OVERLAP_DEFAULT 하나(풀·전체 세트 0, 부분 연습은 planPartialSet 이 partialFraction 적용)
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
    const mid = (u: string) => { const b = opts.unitBounds?.[u]; return b ? (b.min + b.max) / 2 : 0; };
    const weighted = kind === "mc" && !!opts.unitBounds; // 공식 비중이 있으면 목표(중간값)에 가장 못 미친 단원부터 뽑는다(단순 순환은 비중을 무시)
    while (picked.length < sec.count && progress) {
      progress = false;
      const order = weighted ? [...units].sort((a, b) => (mid(b) - (unitCount.get(b) ?? 0)) - (mid(a) - (unitCount.get(a) ?? 0)) || a.localeCompare(b)) : units;
      for (const u of order) {
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
        if (progress && weighted) break; // 한 개 뽑을 때마다 부족 단원을 다시 계산
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

// ── 부분 연습 세트 조립(AB·BC: 계산기 불가 MC / 계산기 MC / FRQ) ───────────────────────────
// 원칙: 공식 파트의 문항 수를 못 채우면 채우지 않고(패딩 금지) 무엇이 모자란지 보고한다. 문항군·유형 다양성 하한을 못 맞춰도 같다.
export type SectionPolicy = { maxPerFamily: number; maxPerArchetype: number; minDistinctFamilies: number; minDistinctArchetypes: number };
/** MC: 문항군당 2개까지. FRQ: 문항군당 1개, 유형(archetype)당 2개까지, 6문항이면 서로 다른 유형 4개 이상 — 숫자만 바꾼 변형이 몰리지 않게 한다. */
export function policyFor(kind: "mc" | "frq", count: number): SectionPolicy {
  return kind === "mc"
    ? { maxPerFamily: 2, maxPerArchetype: 99, minDistinctFamilies: Math.ceil(count / 2), minDistinctArchetypes: 0 }
    : { maxPerFamily: 1, maxPerArchetype: 2, minDistinctFamilies: count, minDistinctArchetypes: Math.ceil((count * 2) / 3) };
}
/** 겹침(재노출) 정책의 코드 상수 — 기준 문서: docs/ap/publication-flow.md "문항 겹침(재노출) 정책". 문서와 값이 같아야 한다(테스트가 확인).
 *  - 풀 모의고사: 다른 세트와 문항 공유 0(원칙). 한 세트 안 중복은 어느 경우에도 없다.
 *  - 부분 연습 세트: 세트당 문항 수의 20%(내림)까지 다른 세트와 겹칠 수 있다. 새 문항을 먼저 쓰고 부족할 때만 겹침 문항을 쓴다.
 *  - 복습(오답 복습·재응시)의 재사용은 허용 — 조립 규칙이 아니라 노출 구분(최초 노출 vs 재노출)으로 다룬다. */
export const OVERLAP_DEFAULT = { full: 0, partialFraction: 0.2 } as const;
export type ExposureKind = "first" | "re_exposure";
/** 학생이 같은 문항을 이전에 본 횟수(응시 기록)로 노출 종류를 가른다. 약점·난이도 통계는 최초 노출만 새 근거로 센다. */
export const exposureKindOf = (priorExposures: number): ExposureKind => (priorExposures > 0 ? "re_exposure" : "first");
export const partialOverlapMax = (totalCount: number): number => Math.floor(totalCount * OVERLAP_DEFAULT.partialFraction);
export type PartialShortage = { sectionKey: string; need: number; have: number; reasons: string[] };
export type PartialPlan = {
  ok: boolean; partial: ApPartialId; subject: string; name: string; label: ApSetLabel; labelAllowed: boolean;
  items: AssemblePlan["items"]; shortage: PartialShortage[];
  composition: Record<string, { count: number; minutes: number; units: Record<string, number>; skills: Record<string, number>; families: number; archetypes: number; overlapUsed: number }>;
  /** 단원 비중 대비 모자란 칸(차단하지 않는 보고): 가중치 최소 비율×문항 수 미달인 단원 */
  coverageGaps: string[];
};
export type UnitWeight = { code: string; min: number; max: number };

export function planPartialSet(subject: string, partial: ApPartialId, pool: AssembleCandidate[], opts: { used?: Set<string>; overlapMax?: number; unitWeights?: UnitWeight[] } = {}): PartialPlan {
  const used = opts.used ?? new Set<string>();
  const sections = sectionsForPartial(subject, partial);
  const totalCount = sections.reduce((a, x) => a + x.count, 0);
  const overlapMax = opts.overlapMax ?? partialOverlapMax(totalCount);
  const eligible = pool.filter((c) => c.purpose === "mock_exam" && (c.releaseTier === "review_env" || c.releaseTier === "launch"));
  const taken = new Set<string>(); const fam = new Map<string, number>(); const arch = new Map<string, number>();
  let overlapUsed = 0;
  const items: AssemblePlan["items"] = []; const shortage: PartialShortage[] = []; const composition: PartialPlan["composition"] = {};
  const policyBySection = new Map(sections.map((sec) => [sec.key, policyFor(sec.kind, sec.count)]));
  for (const sec of sections) {
    const pol = policyBySection.get(sec.key)!;
    const kind = sec.kind === "mc" ? "mc" : "frq_bundle";
    const cands = eligible.filter((c) => c.kind === kind && !taken.has(c.problemId) && calcOk(sec, c.calculator));
    // 다른 세트에 쓰이지 않은 문항을 먼저, 겹침 문항은 허용 한도까지만 뒤에서 쓴다.
    const fresh = cands.filter((c) => !used.has(c.problemId)).sort((a, b) => a.candidateKey.localeCompare(b.candidateKey));
    const reuse = cands.filter((c) => used.has(c.problemId)).sort((a, b) => a.candidateKey.localeCompare(b.candidateKey));
    const picked: AssembleCandidate[] = []; let secOverlap = 0;
    const tryPick = (list: AssembleCandidate[], isReuse: boolean) => {
      const byUnit = new Map<string, AssembleCandidate[]>();
      for (const c of list) { const u = unitOf(c.keywordCode); byUnit.set(u, [...(byUnit.get(u) ?? []), c]); }
      const units = [...byUnit.keys()].sort(); let progress = true;
      while (picked.length < sec.count && progress) {
        progress = false;
        for (const u of units) {
          if (picked.length >= sec.count) break;
          const l = byUnit.get(u)!;
          while (l.length) {
            const c = l.shift()!; const f = c.itemFamilyId ?? c.candidateKey; const a = c.archetype ?? f;
            if ((fam.get(f) ?? 0) >= pol.maxPerFamily || (arch.get(a) ?? 0) >= pol.maxPerArchetype) continue;
            if (isReuse && overlapUsed >= overlapMax) return;
            fam.set(f, (fam.get(f) ?? 0) + 1); arch.set(a, (arch.get(a) ?? 0) + 1); picked.push(c); taken.add(c.problemId); progress = true;
            if (isReuse) { overlapUsed++; secOverlap++; }
            break;
          }
        }
      }
    };
    tryPick(fresh, false); if (picked.length < sec.count) tryPick(reuse, true);
    picked.forEach((c, i) => items.push({ sectionKey: sec.key, position: i + 1, c }));
    const units: Record<string, number> = {}; const skills: Record<string, number> = {};
    for (const c of picked) { units[unitOf(c.keywordCode)] = (units[unitOf(c.keywordCode)] ?? 0) + 1; if (c.skill) skills[c.skill] = (skills[c.skill] ?? 0) + 1; }
    const nFam = new Set(picked.map((c) => c.itemFamilyId ?? c.candidateKey)).size, nArch = new Set(picked.map((c) => c.archetype ?? c.itemFamilyId ?? c.candidateKey)).size;
    composition[sec.key] = { count: picked.length, minutes: sec.minutes, units, skills, families: nFam, archetypes: nArch, overlapUsed: secOverlap };
    const reasons: string[] = [];
    if (picked.length < sec.count) reasons.push(`문항 부족: 후보 ${cands.length}건(계산기 구분·문항군/유형 상한 적용 전), 채운 ${picked.length}/${sec.count}`);
    if (kind === "frq_bundle" || picked.length === sec.count) {
      if (nFam < pol.minDistinctFamilies) reasons.push(`문항군 다양성 하한 미달: ${nFam}/${pol.minDistinctFamilies}`);
      if (nArch < pol.minDistinctArchetypes) reasons.push(`유형(archetype) 다양성 하한 미달: ${nArch}/${pol.minDistinctArchetypes}`);
    }
    if (reasons.length) shortage.push({ sectionKey: sec.key, need: sec.count, have: picked.length, reasons });
  }
  // FRQ 는 두 섹션을 합쳐 다양성 하한을 본다(문항군·유형 상한은 이미 전체 공유).
  if (sections.every((x) => x.kind === "frq")) {
    const all = items.map((i) => i.c); const pol = policyFor("frq", totalCount);
    const nFam = new Set(all.map((c) => c.itemFamilyId ?? c.candidateKey)).size, nArch = new Set(all.map((c) => c.archetype ?? c.itemFamilyId ?? c.candidateKey)).size;
    for (const s2 of shortage) s2.reasons = s2.reasons.filter((r) => !/다양성 하한/.test(r));
    const cleaned = shortage.filter((x) => x.reasons.length);
    shortage.length = 0; shortage.push(...cleaned);
    const dr: string[] = [];
    if (nFam < pol.minDistinctFamilies) dr.push(`문항군 다양성 하한 미달(세트 전체): ${nFam}/${pol.minDistinctFamilies}`);
    if (nArch < pol.minDistinctArchetypes) dr.push(`유형(archetype) 다양성 하한 미달(세트 전체): ${nArch}/${pol.minDistinctArchetypes}`);
    if (dr.length) shortage.push({ sectionKey: sections.map((x) => x.key).join("+"), need: totalCount, have: all.length, reasons: dr });
  }
  const coverageGaps: string[] = [];
  const mcCount = sections.filter((x) => x.kind === "mc").reduce((a, x) => a + x.count, 0);
  if (opts.unitWeights && mcCount) {
    const unitTotals: Record<string, number> = {};
    for (const sec of sections.filter((x) => x.kind === "mc")) for (const [u, n] of Object.entries(composition[sec.key].units)) unitTotals[u] = (unitTotals[u] ?? 0) + n;
    for (const w of opts.unitWeights) { const need = Math.ceil((w.min / 100) * mcCount); const have = unitTotals[w.code] ?? 0; if (have < need) coverageGaps.push(`Unit ${w.code}: ${have}/${need}(공식 비중 ${w.min}-${w.max}%)`); }
  }
  const filled = Object.fromEntries(sections.map((x) => [x.key, composition[x.key]?.count ?? 0]));
  const ok = shortage.length === 0;
  return { ok, partial, subject, name: partialSetName(subject, partial), label: AP_PARTIALS[partial].label, labelAllowed: ok && partialLabelAllowed(subject, partial, filled), items, shortage, composition, coverageGaps };
}
