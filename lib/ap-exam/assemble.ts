// AP 모의고사 세트 조립 계획(순수 함수). **모의고사 용도(purpose=mock_exam)로 변환된 문항만** 후보가 된다 —
// 수업용(lesson) 문항은 입력에 있어도 버린다(DB 트리거가 한 번 더 막는다). 한 문항은 한 세트에만 쓴다(오너 정책: 세트 간 중복 없음).
import { AP_PARTIALS, partialLabelAllowed, partialSetName, sectionsForLabel, sectionsForPartial, type ApPartialId, type ApSetLabel, type ApSection } from "./layouts";

export type AssembleCandidate = {
  candidateKey: string; problemId: string; versionId: string; kind: "mc" | "frq_bundle"; purpose: "mock_exam" | "lesson" | null;
  releaseTier: string; calculator: string; keywordCode: string; itemFamilyId: string | null; difficulty: "easy" | "medium" | "hard"; itemIndex: number;
  archetype?: string | null; skill?: string | null;
};
export type AssemblePlan = {
  ok: boolean;
  items: { sectionKey: string; position: number; c: AssembleCandidate }[];
  shortfall: { sectionKey: string; need: number; have: number }[];
};

const unitOf = (k: string) => k.split(".")[0];
const calcOk = (sec: ApSection, cand: string) =>
  sec.calculator === "required" ? cand === "required" : sec.calculator === "not_allowed" ? cand === "not_allowed" : sec.calculator === "allowed" ? cand !== "not_allowed" : true;

/** MC 는 단원(unit)을 돌아가며, 같은 문항군(family)은 최대 2개. 사용한 문항은 같은 세트에서 다시 쓰지 않는다. */
export function planApSet(subject: string, label: ApSetLabel, pool: AssembleCandidate[], usedProblemIds: Set<string> = new Set()): AssemblePlan {
  const eligible = pool.filter((c) => c.purpose === "mock_exam" && (c.releaseTier === "review_env" || c.releaseTier === "launch") && !usedProblemIds.has(c.problemId));
  const taken = new Set<string>();
  const famCount = new Map<string, number>();
  const items: AssemblePlan["items"] = [];
  const shortfall: AssemblePlan["shortfall"] = [];
  for (const sec of sectionsForLabel(subject, label)) {
    const kind = sec.kind === "mc" ? "mc" : "frq_bundle";
    const cands = eligible.filter((c) => c.kind === kind && !taken.has(c.problemId) && calcOk(sec, c.calculator));
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
          const fam = c.itemFamilyId ?? c.candidateKey;
          if ((famCount.get(fam) ?? 0) >= 2) continue;
          famCount.set(fam, (famCount.get(fam) ?? 0) + 1); picked.push(c); taken.add(c.problemId); progress = true; break;
        }
      }
    }
    picked.forEach((c, i) => items.push({ sectionKey: sec.key, position: i + 1, c }));
    if (picked.length < sec.count) shortfall.push({ sectionKey: sec.key, need: sec.count, have: picked.length });
  }
  return { ok: shortfall.length === 0, items, shortfall };
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
/** 겹침 허용: 풀 모의고사는 0(다른 세트와 문항 공유 없음), 부분 연습은 제한적 허용(기본 문항 수의 20%). 한 세트 안의 중복은 어느 경우에도 없다. */
export const OVERLAP_DEFAULT = { full: 0, partialFraction: 0.2 } as const;
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
  const overlapMax = opts.overlapMax ?? Math.floor(totalCount * OVERLAP_DEFAULT.partialFraction);
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
