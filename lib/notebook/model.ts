import { DOMAIN_BY_CODE, SKILL_BY_CODE, SAT_DOMAINS, SKILL_CODES } from "@/lib/problem-taxonomy";

// 2026-10-08 My Notebook — 순수 로직(화면·테스트 공용). 설계: docs/2026-10-08-my-notebook-design.md

export type NotebookView = "all" | "saved" | "mistakes";
export type NotebookSection = "rw" | "math";
export const SECTION_LABEL: Record<NotebookSection, string> = { rw: "R&W", math: "Math" };

/** 폴더 칩 선택: 전체 / 폴더 없음(Unfiled) / 특정 폴더. */
export type FolderSelection = "all" | "unfiled" | string;

export type NotebookFolder = { id: string; name: string; isDefault: boolean };

export type NotebookEntryLike = {
  workId: string;
  source: "lesson" | "homework" | "mock_exam";
  graded: boolean;
  grade: "correct" | "partial" | "incorrect" | null;
  satDomain: string | null;
  skillCode: string | null;
};

export type NotebookFilters = {
  view: NotebookView;
  folder: FolderSelection;
  source: "all" | "lesson" | "homework" | "mock_exam";
  section: NotebookSection | "";
  domain: string;
  skill: string;
};

export const EMPTY_FILTERS: NotebookFilters = { view: "all", folder: "all", source: "all", section: "", domain: "", skill: "" };

/** 오답(틀림·부분 정답)으로 채점된 문제. */
export function isMistake(e: NotebookEntryLike): boolean {
  return e.graded && (e.grade === "incorrect" || e.grade === "partial");
}

export function sectionOfEntry(e: NotebookEntryLike): NotebookSection | null {
  const domain = e.satDomain ?? (e.skillCode ? SKILL_BY_CODE.get(e.skillCode)?.domain : null);
  if (!domain) return null;
  const d = DOMAIN_BY_CODE.get(domain as never);
  if (!d) return null;
  return d.section === "Math" ? "math" : "rw";
}

function domainOf(e: NotebookEntryLike): string | null {
  return e.satDomain ?? (e.skillCode ? (SKILL_BY_CODE.get(e.skillCode)?.domain ?? null) : null);
}

/** 서브탭: My Notebook = 직접 저장한(오답이 아닌) 문제, Mistake Notebook = 오답, All = 합집합. */
export function inView(e: NotebookEntryLike, view: NotebookView): boolean {
  if (view === "all") return true;
  return view === "mistakes" ? isMistake(e) : !isMistake(e);
}

export function applyNotebookFilters<E extends NotebookEntryLike>(entries: E[], f: NotebookFilters, assignments: Record<string, string>): E[] {
  return entries.filter((e) => {
    if (!inView(e, f.view)) return false;
    const folderId = assignments[e.workId] ?? null;
    if (f.folder === "unfiled" && folderId) return false;
    if (f.folder !== "all" && f.folder !== "unfiled" && folderId !== f.folder) return false;
    if (f.source !== "all" && e.source !== f.source) return false;
    if (f.section && sectionOfEntry(e) !== f.section) return false;
    if (f.domain && domainOf(e) !== f.domain) return false;
    if (f.skill && e.skillCode !== f.skill) return false;
    return true;
  });
}

export type CategoryOptions = {
  sections: { value: NotebookSection; label: string }[];
  domains: { value: string; label: string }[];
  skills: { value: string; label: string }[];
};

/** 학생이 가진 문제에 실제로 있는 분류만 — 상위를 고르면 그 아래만. 서브탭·폴더 범위가 아니라 전체 노트 기준(필터가 서로 비우지 않게). */
export function categoryOptions(entries: NotebookEntryLike[], sel: { section: NotebookSection | ""; domain: string }): CategoryOptions {
  const sections = new Set<NotebookSection>();
  const domains = new Set<string>();
  const skills = new Set<string>();
  for (const e of entries) {
    const s = sectionOfEntry(e);
    if (!s) continue;
    sections.add(s);
    if (sel.section && s !== sel.section) continue;
    const d = domainOf(e);
    if (d) domains.add(d);
    if (sel.domain && d !== sel.domain) continue;
    if (e.skillCode) skills.add(e.skillCode);
  }
  return {
    sections: (["rw", "math"] as const).filter((s) => sections.has(s)).map((s) => ({ value: s, label: SECTION_LABEL[s] })),
    domains: SAT_DOMAINS.filter((d) => domains.has(d.code)).map((d) => ({ value: d.code, label: d.label })),
    skills: SKILL_CODES.filter((k) => skills.has(k.code)).map((k) => ({ value: k.code, label: k.label })),
  };
}

/** 상위 분류를 바꾸면 더 이상 맞지 않는 하위 선택을 비운다. */
export function setSection(f: NotebookFilters, section: NotebookSection | ""): NotebookFilters {
  return { ...f, section, domain: "", skill: "" };
}
export function setDomain(f: NotebookFilters, domain: string): NotebookFilters {
  return { ...f, domain, skill: "" };
}
export function hasCategoryFilter(f: NotebookFilters): boolean {
  return Boolean(f.section || f.domain || f.skill);
}

/** 폴더별 개수. 뷰/분류 필터와 무관하게 폴더 안에 든 전체 문제 수. */
export function folderCounts(entries: NotebookEntryLike[], assignments: Record<string, string>, folders: NotebookFolder[]) {
  const byFolder: Record<string, number> = {};
  for (const fo of folders) byFolder[fo.id] = 0;
  let unfiled = 0;
  for (const e of entries) {
    const fid = assignments[e.workId];
    if (fid && fid in byFolder) byFolder[fid] += 1;
    else unfiled += 1;
  }
  return { all: entries.length, unfiled, byFolder };
}
