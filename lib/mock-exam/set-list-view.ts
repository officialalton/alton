// 관리자 모의고사 세트 목록 표시용 순수 함수 — SAT/AP 구분·그룹·정렬·AP 구성 문구.
import { AP_LABEL_TEXT, AP_PARTIALS, AP_SUBJECT_NAME, type ApSetLabel } from "@/lib/ap-exam/layouts";
import type { MockExamSetSummary } from "@/app/admin/mock-exam-actions";

export type SetSort = "latest" | "name" | "status";
export const SORT_LABEL: Record<SetSort, string> = { latest: "최신순", name: "이름순", status: "상태순(공개→초안→보관)" };

const CALC_KO: Record<string, string> = { allowed: "계산기 허용", not_allowed: "계산기 불가", required: "그래핑 계산기 필수", na: "" };

/** "sat" | AP 과목 코드. 필터·그룹 키. */
export function programKey(s: Pick<MockExamSetSummary, "examProgram" | "apSubject">): string {
  return s.examProgram === "ap" && s.apSubject ? s.apSubject : "sat";
}
export function programName(key: string): string {
  return key === "sat" ? "SAT" : AP_SUBJECT_NAME[key] ?? key;
}

/** 세트 이름 접미사가 아니라 구조(섹션 키)로 부분 세트 이름을 정한다: Non-Calculator / Calculator / Free-Response Practice. */
export function apSetLabelText(s: MockExamSetSummary): string {
  const keys = (s.sectionLayout?.sections ?? []).map((x) => x.key);
  for (const p of Object.values(AP_PARTIALS)) {
    if (keys.length === p.sectionKeys.length && p.sectionKeys.every((k) => keys.includes(k))) return p.nameSuffix;
  }
  return s.apLabel ? AP_LABEL_TEXT[s.apLabel as ApSetLabel] ?? s.apLabel : "AP";
}

/** 섹션별 한 줄 요약: "Part A MC 29문항 · 62분 · 계산기 불가". */
export function apSectionLines(s: MockExamSetSummary): string[] {
  return (s.sectionLayout?.sections ?? []).map((x) => {
    const calc = CALC_KO[x.calculator] ?? "";
    const have = s.sectionCounts?.[x.key] ?? 0;
    return `${x.label.split(":")[0]} ${x.kind === "mc" ? "객관식" : "FRQ"} ${have}/${x.count}문항 · ${x.minutes}분${calc ? ` · ${calc}` : ""}`;
  });
}
export function apTargetCount(s: MockExamSetSummary): number {
  return (s.sectionLayout?.sections ?? []).reduce((a, x) => a + x.count, 0);
}

/** 다른 서브탭의 "이름 · R&W n · Math m" 한 줄 요약 — AP 는 구성·문항 수로 바꾼다. */
export function setCountsText(s: MockExamSetSummary): string {
  if (s.examProgram === "ap") return `${apSetLabelText(s)} · 문항 ${s.itemTotal ?? 0}/${apTargetCount(s)}`;
  return `R&W ${s.rwCount} · Math ${s.mathCount}`;
}

const STATUS_RANK: Record<string, number> = { published: 0, draft: 1, archived: 2 };
export function sortSets(sets: MockExamSetSummary[], sort: SetSort): MockExamSetSummary[] {
  const out = [...sets];
  const byLatest = (a: MockExamSetSummary, b: MockExamSetSummary) => b.createdAt.localeCompare(a.createdAt);
  if (sort === "name") out.sort((a, b) => a.name.localeCompare(b.name) || b.versionNo - a.versionNo);
  else if (sort === "status") out.sort((a, b) => (STATUS_RANK[a.status] ?? 9) - (STATUS_RANK[b.status] ?? 9) || byLatest(a, b));
  else out.sort(byLatest);
  return out;
}

/** 같은 계열(setGroupId) 안에서 목록에 있는 최대 버전인가. */
export function latestVersionIds(sets: MockExamSetSummary[]): Set<string> {
  const best = new Map<string, MockExamSetSummary>();
  for (const s of sets) {
    const b = best.get(s.setGroupId);
    if (!b || s.versionNo > b.versionNo) best.set(s.setGroupId, s);
  }
  return new Set([...best.values()].map((s) => s.id));
}

/** SAT 먼저, AP 는 과목 이름순. 그룹 안에서 정렬을 적용한다. */
export function groupSets(sets: MockExamSetSummary[], sort: SetSort): { key: string; name: string; sets: MockExamSetSummary[] }[] {
  const by = new Map<string, MockExamSetSummary[]>();
  for (const s of sets) by.set(programKey(s), [...(by.get(programKey(s)) ?? []), s]);
  return [...by.keys()]
    .sort((a, b) => (a === "sat" ? -1 : b === "sat" ? 1 : programName(a).localeCompare(programName(b))))
    .map((key) => ({ key, name: programName(key), sets: sortSets(by.get(key)!, sort) }));
}
