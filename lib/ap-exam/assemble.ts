// AP 모의고사 세트 조립 계획(순수 함수). **모의고사 용도(purpose=mock_exam)로 변환된 문항만** 후보가 된다 —
// 수업용(lesson) 문항은 입력에 있어도 버린다(DB 트리거가 한 번 더 막는다). 한 문항은 한 세트에만 쓴다(오너 정책: 세트 간 중복 없음).
import { sectionsForLabel, type ApSetLabel, type ApSection } from "./layouts";

export type AssembleCandidate = {
  candidateKey: string; problemId: string; versionId: string; kind: "mc" | "frq_bundle"; purpose: "mock_exam" | "lesson" | null;
  releaseTier: string; calculator: string; keywordCode: string; itemFamilyId: string | null; difficulty: "easy" | "medium" | "hard"; itemIndex: number;
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
