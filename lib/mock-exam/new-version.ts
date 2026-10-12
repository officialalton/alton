// 모의고사 새 버전(version_no+1) 적용 — 순수 로직(DB 없음). 기준: docs/ap/set-new-version-design.md.
// 관리자 액션이 RPC(mock_exam_create_new_version)를 부르기 전에 조립 규칙(문항군 상한·단원 비중·계산기·중복·겹침)을 한 번 더 점검하고,
// 학생·보호자 화면의 'Updated version' 문구를 만든다. DB 가 최종 방어선(RPC 검증 + 공개 게이트)이다.
import { FULL_EXAM_FAMILY_CAP } from "@/lib/ap-exam/ab-select";
import { policyFor, OVERLAP_DEFAULT } from "@/lib/ap-exam/assemble";

export type SlotItem = {
  section: string; position: number; problemId: string;
  /** AP 후보 메타(SAT 세트는 모두 null). */
  candidateKey: string | null; kind: "mc" | "frq" | null; unit: string | null; family: string | null; calculator: string | null;
};
export type SwapRequest = { section: string; position: number; problemId: string };
export type NewVersionContext = {
  apLabel: "full_practice" | "mc_practice" | "frq_practice" | null;
  /** 섹션 키 → 공식 계산기 규칙(section_layout). */
  sectionCalculator: Record<string, string>;
  /** 단원 코드 → 허용 문항 수 범위(MC 만 센다). 없으면 단원 비중은 점검하지 않는다. */
  unitBounds?: Record<string, { min: number; max: number }>;
  /** 다른 시험 계열(set_group_id)의 초안·공개 세트에 이미 쓰인 문항 id — 풀 모의고사는 공유 0. */
  usedByOtherExams: Set<string>;
  /** 교체 후보의 메타(problemId → SlotItem 메타). */
  replacements: Map<string, Omit<SlotItem, "section" | "position">>;
};

/** 교체를 적용한 최종 문항 목록과 조립 규칙 위반 목록. 위반이 없으면 issues 는 빈 배열. */
export function checkNewVersionComposition(source: SlotItem[], swaps: SwapRequest[], ctx: NewVersionContext): { items: SlotItem[]; issues: string[] } {
  const issues: string[] = [];
  const bySlot = new Map(source.map((i) => [`${i.section}:${i.position}`, i]));
  const next = new Map(bySlot);
  for (const s of swaps) {
    const key = `${s.section}:${s.position}`;
    const old = bySlot.get(key);
    if (!old) { issues.push(`slot_missing_${key}`); continue; }
    if (!next.has(key) || next.get(key) !== old) { issues.push(`slot_swapped_twice_${key}`); continue; }
    const rep = ctx.replacements.get(s.problemId);
    if (!rep) { issues.push(`replacement_unknown_${s.problemId}`); continue; }
    next.set(key, { ...rep, section: s.section, position: s.position, problemId: s.problemId });
    if (old.kind && rep.kind && old.kind !== rep.kind) issues.push(`slot_type_${key}_${old.kind}_vs_${rep.kind}`);
    const calc = ctx.sectionCalculator[s.section];
    if (rep.calculator && calc && calc !== "na" && !(calc === "required" ? rep.calculator === "required" : calc === "not_allowed" ? rep.calculator === "not_allowed" : rep.calculator !== "not_allowed")) {
      issues.push(`calculator_${key}_${calc}_vs_${rep.calculator}`);
    }
    if (ctx.apLabel === "full_practice" && ctx.usedByOtherExams.has(s.problemId)) issues.push(`overlap_${s.problemId}`);
  }
  const items = [...next.values()];
  const ids = items.map((i) => i.problemId);
  if (new Set(ids).size !== ids.length) issues.push("duplicate_problem");

  // 문항군 상한 — 풀 모의고사는 같은 문항군 1(FULL_EXAM_FAMILY_CAP), 그 외 MC 2 / FRQ 1(policyFor).
  for (const kind of ["mc", "frq"] as const) {
    const its = items.filter((i) => i.kind === kind);
    if (!its.length) continue;
    const cap = kind === "mc" && ctx.apLabel === "full_practice" ? FULL_EXAM_FAMILY_CAP : policyFor(kind, its.length).maxPerFamily;
    const fam = new Map<string, number>();
    for (const i of its) { const f = i.family ?? i.candidateKey ?? i.problemId; fam.set(f, (fam.get(f) ?? 0) + 1); }
    for (const [f, n] of fam) if (n > cap) issues.push(`family_cap_${kind}_${f}_${n}/${cap}`);
  }
  // 단원 비중(MC).
  if (ctx.unitBounds) {
    const mc = items.filter((i) => i.kind === "mc");
    for (const [u, b] of Object.entries(ctx.unitBounds)) {
      const n = mc.filter((i) => i.unit === u).length;
      if (n < b.min) issues.push(`unit_${u}_below_min_${n}/${b.min}`);
      if (n > b.max) issues.push(`unit_${u}_above_max_${n}/${b.max}`);
    }
  }
  return { items, issues };
}

export const FULL_EXAM_OVERLAP_MAX = OVERLAP_DEFAULT.full;

// ── 학생·보호자 화면 문구 ───────────────────────────────────────────────
export type UpdatedVersionInfo = { versionNo: number; itemTotal: number; sharedAnswered: number; priorVersionNo?: number | null };

export const UPDATED_VERSION_BADGE = "Updated version";

/** "You already answered N of these questions" — N 이 0 이면 빈 문자열(겹침 없음은 굳이 알리지 않는다). 1 문항은 단수. */
export function updatedVersionAnsweredText(info: Pick<UpdatedVersionInfo, "itemTotal" | "sharedAnswered">): string {
  const n = Math.max(0, Math.min(info.sharedAnswered, info.itemTotal));
  if (n === 0) return "";
  return `You already answered ${n} of these questions.`;
}

/** 새 버전은 독립된 새 시험이 아니라 재응시로 센다 — 목록 안내 한 줄. */
export const UPDATED_VERSION_RETAKE_NOTE = "This updated version counts as a retake, not a new practice test.";
