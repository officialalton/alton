// AP 회차(lesson-level) 템플릿 생성기(2026-10-08). 순수 함수 — IO 없음. 설계: docs/ap/curriculum-keyword-design.md 14절.
// 입력: 키워드 트리(단원>토픽>세부). 출력: 순서 있는 회차 목록. 회차 1개 = 50분 개인 수업 1회.
//  - content    : 새 내용을 가르치는 회차. 세부 키워드(없으면 토픽)가 정확히 한 회차의 primary 가 된다.
//  - unit_review: 단원 복습·혼합 MCQ/FRQ 연습(키워드는 role='review' 로만 연결, primary 아님)
//  - exam_prep  : 시험 직전 누적 단계(누적 복습 2, 모의고사 해설 2, FRQ 클리닉, 최종 약점 보강)
import type { ApCurriculumFile, ApSubKeyword, ApTopic } from "./types";

export const LESSON_TARGET_LOAD = 1.0; // 1회 = 50분
export const LESSON_MAX_LOAD = 1.25; // 한 회차 상한(초과 금지)
export const LESSON_MIN_LOAD = 0.5; // 이보다 작은 꼬리 회차는 이웃에 합친다(상한 안일 때)
export const LESSON_MAX_ATOMS = 6; // 한 회차에 담는 세부 키워드 수 상한
export const REVIEW_SPLIT_OVER = 8; // 단원 내용 회차가 이보다 많으면 복습 2회
export const LESSON_MINUTES = 50;

export type LessonKind = "content" | "unit_review" | "exam_prep";
export type LinkRole = "primary" | "continued" | "review";
export type LessonTrack = "core" | "full";
export type PlannedLesson = {
  code: string; // 안정 코드: L<단원>.<nn> / R<단원>.<n> / X.<n>
  position: number; // 과목 내 전체 순서(1부터)
  kind: LessonKind;
  track: LessonTrack; // core = 속성(빠른 과정에도 유지), full = 전체 과정에서만
  unitCode: string | null;
  title: string;
  note: string;
  estLoad: number;
  estMinutes: number;
  links: { contentCode: string; role: LinkRole }[];
};

type Atom = { code: string; topicCode: string; load: number; requires: string[]; kind: string };

const r2 = (n: number) => Math.round(n * 100) / 100;
const pad = (n: number) => String(n).padStart(2, "0");

function atomsOf(t: ApTopic): Atom[] {
  if (!t.subKeywords.length) return [{ code: t.code, topicCode: t.code, load: t.estLessons, requires: t.requires, kind: "concept" }];
  return t.subKeywords.map((k: ApSubKeyword) => ({ code: k.code, topicCode: t.code, load: k.estLessons, requires: k.requires, kind: k.kind }));
}

/** 단원 안의 atom 을 순서대로 회차에 채운다(순서 보존). */
function packAtoms(atoms: Atom[]): Atom[][] {
  const lessons: Atom[][] = [];
  let cur: Atom[] = [];
  let load = 0;
  for (const a of atoms) {
    if (cur.length && (load + a.load > LESSON_TARGET_LOAD + 1e-9 || cur.length >= LESSON_MAX_ATOMS)) {
      lessons.push(cur);
      cur = [];
      load = 0;
    }
    cur.push(a);
    load += a.load;
  }
  if (cur.length) lessons.push(cur);
  // 꼬리 회차가 너무 가벼우면 앞 회차에 합친다(상한·개수 상한 안일 때만)
  const sum = (l: Atom[]) => l.reduce((s, a) => s + a.load, 0);
  const n = lessons.length;
  if (n > 1 && sum(lessons[n - 1]) < LESSON_MIN_LOAD - 1e-9 && sum(lessons[n - 2]) + sum(lessons[n - 1]) <= LESSON_MAX_LOAD + 1e-9 && lessons[n - 2].length + lessons[n - 1].length <= LESSON_MAX_ATOMS) {
    lessons[n - 2] = [...lessons[n - 2], ...lessons[n - 1]];
    lessons.pop();
  }
  return lessons;
}

function topicTitle(f: ApCurriculumFile, codes: string[]): string {
  const byCode = new Map(f.units.flatMap((u) => u.topics.map((t) => [t.code, t.title] as const)));
  const titles = codes.map((c) => byCode.get(c) ?? c);
  if (titles.length <= 2) return titles.join(" / ");
  return `${titles[0]} / ${titles[1]} (+${titles.length - 2})`;
}

export const EXAM_PREP_SESSIONS = [
  { title: "Cumulative Review A: first half of the course", half: 1 },
  { title: "Cumulative Review B: second half of the course", half: 2 },
  { title: "Practice Exam 1: debrief and error log", half: 0 },
  { title: "FRQ Clinic: scoring rubrics and common point losses", half: 0 },
  { title: "Practice Exam 2: debrief and pacing", half: 0 },
  { title: "Final weak-area review and exam-day strategy", half: 0 },
] as const;

export function buildLessonPlan(f: ApCurriculumFile): PlannedLesson[] {
  const out: PlannedLesson[] = [];
  const push = (l: Omit<PlannedLesson, "position" | "estMinutes">) => out.push({ ...l, position: out.length + 1, estMinutes: Math.round(l.estLoad * LESSON_MINUTES) });
  for (const u of f.units) {
    const atoms = u.topics.flatMap(atomsOf);
    const packs = packAtoms(atoms);
    const topicFirstLesson = new Map<string, number>();
    const contentStart = out.length;
    packs.forEach((pack, i) => {
      const links: PlannedLesson["links"] = [];
      const seenTopics: string[] = [];
      for (const a of pack) {
        links.push({ contentCode: a.code, role: "primary" });
        if (!seenTopics.includes(a.topicCode)) seenTopics.push(a.topicCode);
      }
      // 토픽 링크: 처음 나오는 회차에서 primary, 이어지는 회차에서 continued
      const topicLinks: PlannedLesson["links"] = seenTopics.map((tc) => {
        const first = !topicFirstLesson.has(tc);
        if (first) topicFirstLesson.set(tc, i);
        return { contentCode: tc, role: first ? ("primary" as const) : ("continued" as const) };
      });
      push({
        code: `L${u.code}.${pad(i + 1)}`,
        kind: "content",
        track: "core",
        unitCode: u.code,
        title: `Unit ${u.code} · Lesson ${i + 1}: ${topicTitle(f, seenTopics)}`,
        note: `Topics ${seenTopics.join(", ")} · ${pack.length} sub-keywords · ~${LESSON_MINUTES} min`,
        estLoad: r2(pack.reduce((s, a) => s + a.load, 0)),
        links: [...topicLinks, ...links],
      });
    });
    // 단원 복습·혼합 연습
    const nContent = packs.length;
    const nReview = nContent > REVIEW_SPLIT_OVER ? 2 : 1;
    for (let r = 1; r <= nReview; r++) {
      const from = Math.floor(((r - 1) * nContent) / nReview);
      const to = Math.floor((r * nContent) / nReview);
      const reviewTopics = [...new Set(packs.slice(from, to).flatMap((p) => p.map((a) => a.topicCode)))];
      push({
        code: `R${u.code}.${r}`,
        kind: "unit_review",
        track: r === 1 ? "core" : "full",
        unitCode: u.code,
        title: nReview === 1 ? `Unit ${u.code} Review: mixed MCQ + FRQ practice` : `Unit ${u.code} Review ${r}/${nReview}: mixed MCQ + FRQ practice`,
        note: `Review of topics ${reviewTopics[0]}–${reviewTopics[reviewTopics.length - 1]}; timed MCQ set, one FRQ, error analysis · ~${LESSON_MINUTES} min`,
        estLoad: 1,
        links: reviewTopics.map((contentCode) => ({ contentCode, role: "review" as const })),
      });
    }
    void contentStart;
  }
  // 누적 시험 준비 단계
  const unitCodes = f.units.map((u) => u.code);
  const mid = Math.ceil(unitCodes.length / 2);
  EXAM_PREP_SESSIONS.forEach((s, i) => {
    const units = s.half === 1 ? unitCodes.slice(0, mid) : s.half === 2 ? unitCodes.slice(mid) : [];
    const topics = f.units.filter((u) => units.includes(u.code)).flatMap((u) => u.topics.map((t) => t.code));
    push({
      code: `X.${i + 1}`,
      kind: "exam_prep",
      track: "core",
      unitCode: null,
      title: `Exam Prep ${i + 1}: ${s.title}`,
      note: units.length ? `Cumulative: Units ${units[0]}–${units[units.length - 1]} · ~${LESSON_MINUTES} min` : `Cumulative exam preparation · ~${LESSON_MINUTES} min`,
      estLoad: 1,
      links: topics.map((contentCode) => ({ contentCode, role: "review" as const })),
    });
  });
  return out;
}

export type LessonTotals = { content: number; unitReview: number; examPrep: number; total: number; fastTrack: number };
export function lessonTotals(plan: PlannedLesson[]): LessonTotals {
  const c = (k: LessonKind) => plan.filter((l) => l.kind === k).length;
  return { content: c("content"), unitReview: c("unit_review"), examPrep: c("exam_prep"), total: plan.length, fastTrack: plan.filter((l) => l.track === "core").length };
}

/** 커버리지·순서·부하 검사. 오류 문자열 배열(빈 배열 = 통과). */
export function checkLessonPlan(f: ApCurriculumFile, plan: PlannedLesson[]): string[] {
  const errs: string[] = [];
  const allCodes: string[] = [];
  const reqs = new Map<string, string[]>();
  const topicSubs = new Map<string, string[]>();
  for (const u of f.units) for (const t of u.topics) {
    allCodes.push(t.code, ...t.subKeywords.map((k) => k.code));
    reqs.set(t.code, t.requires);
    topicSubs.set(t.code, t.subKeywords.map((k) => k.code));
    t.subKeywords.forEach((k) => reqs.set(k.code, k.requires));
  }
  const primaryAt = new Map<string, number[]>();
  for (const l of plan) for (const k of l.links) if (k.role === "primary") primaryAt.set(k.contentCode, [...(primaryAt.get(k.contentCode) ?? []), l.position]);
  for (const c of allCodes) {
    const p = primaryAt.get(c) ?? [];
    if (p.length === 0) errs.push(`키워드 ${c}: primary 회차 없음`);
    if (p.length > 1) errs.push(`키워드 ${c}: primary 회차 ${p.length}개(중복)`);
  }
  for (const c of primaryAt.keys()) if (!allCodes.includes(c)) errs.push(`알 수 없는 키워드 ${c}`);
  const first = (c: string) => Math.min(...(primaryAt.get(c) ?? [Infinity]));
  const lastOf = (c: string) => { const subs = topicSubs.get(c); return subs?.length ? Math.max(...subs.map(first)) : first(c); };
  for (const [c, rq] of reqs) for (const r of rq) {
    if (!reqs.has(r)) continue; // requires 의 유효성은 validateCurriculum 이 검사
    if (lastOf(r) > first(c)) errs.push(`선수 순서 위반: ${c} 가 ${r} 보다 먼저 가르쳐짐`);
  }
  for (const l of plan) {
    if (l.kind === "content") {
      if (l.estLoad > LESSON_MAX_LOAD + 1e-9) errs.push(`${l.code}: 부하 ${l.estLoad} > ${LESSON_MAX_LOAD}`);
      const prim = l.links.filter((k) => k.role === "primary" && k.contentCode.includes("#")).length;
      if (prim > LESSON_MAX_ATOMS) errs.push(`${l.code}: 세부 키워드 ${prim} > ${LESSON_MAX_ATOMS}`);
    }
    if (l.kind !== "content" && l.links.some((k) => k.role === "primary")) errs.push(`${l.code}: 복습·시험 회차에 primary 연결`);
  }
  const codes = plan.map((l) => l.code);
  if (new Set(codes).size !== codes.length) errs.push("회차 코드 중복");
  return errs;
}
