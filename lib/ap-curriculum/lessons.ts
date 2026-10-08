// AP 회차(lesson-level) 템플릿 생성기(2026-10-08). 순수 함수 — IO 없음. 설계: docs/ap/curriculum-keyword-design.md 14절.
// 입력: 키워드 트리(단원>토픽>세부). 출력: 순서 있는 회차 목록. 회차 1개 = 50분 개인 수업 1회.
//  - content    : 새 내용을 가르치는 회차. 세부 키워드(없으면 토픽)가 정확히 한 회차의 primary 가 된다.
//  - unit_review: 단원 복습·혼합 MCQ/FRQ 연습(키워드는 role='review' 로만 연결, primary 아님)
//  - exam_prep  : 시험 직전 누적 단계(누적 복습 2, 모의고사 해설 2, FRQ 클리닉, 최종 약점 보강)
import type { ApCurriculumFile, ApSubKeyword, ApTopic } from "./types";

export const BASE_MINUTES = 50; // 부하 1.0 = 50분
export const LESSON_MINUTES = 50; // (호환) 전체 과정 회차 길이
export type LessonTrackSet = "compact" | "full";
export type LessonOptions = {
  track: LessonTrackSet;
  minutes: number; // 회차 길이(분)
  lightFactor: number; // light 깊이 키워드의 부하 배율(1 = 전부 충분히 가르침)
  examPrepSessions: 3 | 6;
  foldReview: boolean; // true: 단원 복습을 다음 회차 워밍업·단원 마지막 회차 마무리로 접는다
};
export const TRACK_DEFAULTS: Record<LessonTrackSet, LessonOptions> = {
  compact: { track: "compact", minutes: 100, lightFactor: 0.5, examPrepSessions: 3, foldReview: true },
  full: { track: "full", minutes: 50, lightFactor: 1, examPrepSessions: 6, foldReview: false },
};
export const LESSON_MAX_FACTOR = 1.25; // 한 회차 상한 = 용량 × 1.25
export const LESSON_MIN_FACTOR = 0.5; // 용량의 절반 미만 꼬리는 이웃에 합친다
export const ATOMS_PER_BASE = 6; // 50분당 세부 키워드 상한
export const REVIEW_SPLIT_OVER = 8; // (full) 단원 내용 회차가 이보다 많으면 복습 2회
// 깊이 구분: light = 오개념·표현 키워드(개요·예제 수준으로 다루고, 연습 회차 드릴로 보강). 나머지는 core(전부 가르침).
export type Depth = "core" | "light";
export const depthOf = (kind: string): Depth => (kind === "misconception" || kind === "representation" ? "light" : "core");
export const capacityOf = (o: LessonOptions) => o.minutes / BASE_MINUTES;
export const maxLoadOf = (o: LessonOptions) => capacityOf(o) * LESSON_MAX_FACTOR;
export const maxAtomsOf = (o: LessonOptions) => Math.round(ATOMS_PER_BASE * capacityOf(o));
export const resolveOptions = (track: LessonTrackSet, over: Partial<LessonOptions> = {}): LessonOptions => ({ ...TRACK_DEFAULTS[track], ...over, track });

export type LessonKind = "content" | "unit_review" | "exam_prep";
export type LinkRole = "primary" | "continued" | "review";
export type LessonTrack = "core" | "full";
export type PlannedLesson = {
  code: string; // 안정 코드: full = L<단원>.<nn>/R<단원>.<n>/X.<n>, compact = C<단원>.<nn>/CX.<n>
  position: number;
  kind: LessonKind;
  track: LessonTrack;
  unitCode: string | null;
  title: string;
  note: string;
  estLoad: number; // 유효 부하(50분=1.0, light 배율 반영)
  estMinutes: number; // 회차 길이(분)
  links: { contentCode: string; role: LinkRole; depth: Depth }[];
};

type Atom = { code: string; topicCode: string; load: number; requires: string[]; kind: string; depth: Depth };

const r2 = (n: number) => Math.round(n * 100) / 100;
const pad = (n: number) => String(n).padStart(2, "0");

function atomsOf(t: ApTopic, o: LessonOptions): Atom[] {
  const mk = (code: string, load: number, requires: string[], kind: string): Atom => {
    const depth = depthOf(kind);
    return { code, topicCode: t.code, load: depth === "light" ? load * o.lightFactor : load, requires, kind, depth };
  };
  if (!t.subKeywords.length) return [mk(t.code, t.estLessons, t.requires, "concept")];
  return t.subKeywords.map((k: ApSubKeyword) => mk(k.code, k.estLessons, k.requires, k.kind));
}

/** 단원 안의 atom 을 순서대로 회차에 채운다(순서 보존). */
function packAtoms(atoms: Atom[], o: LessonOptions): Atom[][] {
  const cap = capacityOf(o), maxLoad = maxLoadOf(o), maxAtoms = maxAtomsOf(o);
  const sum = (l: Atom[]) => l.reduce((s, a) => s + a.load, 0);
  const lessons: Atom[][] = [];
  let cur: Atom[] = [];
  let load = 0;
  for (const a of atoms) {
    if (cur.length && (load + a.load > cap + 1e-9 || cur.length >= maxAtoms)) {
      lessons.push(cur);
      cur = [];
      load = 0;
    }
    cur.push(a);
    load += a.load;
  }
  if (cur.length) lessons.push(cur);
  const n = lessons.length;
  if (n > 1 && sum(lessons[n - 1]) < LESSON_MIN_FACTOR * cap - 1e-9 && sum(lessons[n - 2]) + sum(lessons[n - 1]) <= maxLoad + 1e-9 && lessons[n - 2].length + lessons[n - 1].length <= maxAtoms) {
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

const EXAM_PREP_FULL = [
  { title: "Cumulative Review A: first half of the course", half: 1 },
  { title: "Cumulative Review B: second half of the course", half: 2 },
  { title: "Practice Exam 1: debrief and error log", half: 0 },
  { title: "FRQ Clinic: scoring rubrics and common point losses", half: 0 },
  { title: "Practice Exam 2: debrief and pacing", half: 0 },
  { title: "Final weak-area review and exam-day strategy", half: 0 },
] as const;
const EXAM_PREP_COMPACT = [
  { title: "Cumulative review (first half) + Practice Exam 1 debrief", half: 1 },
  { title: "Cumulative review (second half) + FRQ clinic and Practice Exam 2 debrief", half: 2 },
  { title: "Final weak-area review and exam-day strategy", half: 0 },
] as const;
export const EXAM_PREP_SESSIONS = EXAM_PREP_FULL;

export function buildLessonPlan(f: ApCurriculumFile, over?: Partial<LessonOptions> & { track?: LessonTrackSet }): PlannedLesson[] {
  const o = resolveOptions(over?.track ?? "compact", over);
  const compact = o.foldReview;
  const out: PlannedLesson[] = [];
  const push = (l: Omit<PlannedLesson, "position" | "estMinutes">) => out.push({ ...l, position: out.length + 1, estMinutes: o.minutes });
  const prefix = compact ? "C" : "L";
  let prevLastTopics: string[] = [];
  let prevUnit = "";
  for (const u of f.units) {
    const packs = packAtoms(u.topics.flatMap((t) => atomsOf(t, o)), o);
    const topicFirstLesson = new Set<string>();
    packs.forEach((pack, i) => {
      const seenTopics = [...new Set(pack.map((a) => a.topicCode))];
      const topicLinks: PlannedLesson["links"] = seenTopics.map((tc) => {
        const first = !topicFirstLesson.has(tc);
        topicFirstLesson.add(tc);
        return { contentCode: tc, role: first ? ("primary" as const) : ("continued" as const), depth: "core" as const };
      });
      const light = pack.filter((a) => a.depth === "light").length;
      const warm = compact && i === 0 && prevLastTopics.length ? prevLastTopics.map((contentCode) => ({ contentCode, role: "review" as const, depth: "core" as const })) : [];
      const notes = [`Topics ${seenTopics.join(", ")}`, `${pack.length} sub-keywords (${pack.length - light} core, ${light} light)`, `~${o.minutes} min`];
      if (compact && warm.length) notes.push(`warm-up: Unit ${prevUnit} mixed MCQ+FRQ retrieval`);
      if (compact && i === packs.length - 1) notes.push("close with a short mixed MCQ+FRQ set for this unit");
      if (light) notes.push("light items: overview + worked example; drills in practice sets");
      push({
        code: `${prefix}${u.code}.${pad(i + 1)}`,
        kind: "content",
        track: "core",
        unitCode: u.code,
        title: `Unit ${u.code} · Lesson ${i + 1}: ${topicTitle(f, seenTopics)}`,
        note: notes.join(" · "),
        estLoad: r2(pack.reduce((s, a) => s + a.load, 0)),
        links: [...warm, ...topicLinks, ...pack.map((a) => ({ contentCode: a.code, role: "primary" as const, depth: a.depth }))],
      });
    });
    prevLastTopics = [...new Set(packs[packs.length - 1].map((a) => a.topicCode))];
    prevUnit = u.code;
    if (!compact) {
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
          note: `Review of topics ${reviewTopics[0]}–${reviewTopics[reviewTopics.length - 1]}; timed MCQ set, one FRQ, error analysis · ~${o.minutes} min`,
          estLoad: 1,
          links: reviewTopics.map((contentCode) => ({ contentCode, role: "review" as const, depth: "core" as const })),
        });
      }
    }
  }
  const unitCodes = f.units.map((u) => u.code);
  const mid = Math.ceil(unitCodes.length / 2);
  (compact ? EXAM_PREP_COMPACT : EXAM_PREP_FULL).forEach((s, i) => {
    const units = s.half === 1 ? unitCodes.slice(0, mid) : s.half === 2 ? unitCodes.slice(mid) : [];
    const topics = f.units.filter((u) => units.includes(u.code)).flatMap((u) => u.topics.map((t) => t.code));
    push({
      code: `${compact ? "CX" : "X"}.${i + 1}`,
      kind: "exam_prep",
      track: "core",
      unitCode: null,
      title: `Exam Prep ${i + 1}: ${s.title}`,
      note: (units.length ? `Cumulative: Units ${units[0]}–${units[units.length - 1]}` : "Cumulative exam preparation") + ` · ~${o.minutes} min`,
      estLoad: compact ? capacityOf(o) : 1,
      links: topics.map((contentCode) => ({ contentCode, role: "review" as const, depth: "core" as const })),
    });
  });
  return out;
}

export type LessonTotals = { content: number; unitReview: number; examPrep: number; total: number; fastTrack: number; minutes: number; totalMinutes: number; coreKeywords: number; lightKeywords: number };
export function lessonTotals(plan: PlannedLesson[]): LessonTotals {
  const c = (k: LessonKind) => plan.filter((l) => l.kind === k).length;
  const prim = plan.flatMap((l) => l.links.filter((k) => k.role === "primary" && k.contentCode.includes("#")));
  return {
    content: c("content"), unitReview: c("unit_review"), examPrep: c("exam_prep"), total: plan.length,
    fastTrack: plan.filter((l) => l.track === "core").length, minutes: plan[0]?.estMinutes ?? 0,
    totalMinutes: plan.reduce((s, l) => s + l.estMinutes, 0),
    coreKeywords: prim.filter((k) => k.depth === "core").length, lightKeywords: prim.filter((k) => k.depth === "light").length,
  };
}

/** 커버리지·순서·부하 검사. 오류 문자열 배열(빈 배열 = 통과). */
export function checkLessonPlan(f: ApCurriculumFile, plan: PlannedLesson[], over?: Partial<LessonOptions> & { track?: LessonTrackSet }): string[] {
  const o = resolveOptions(over?.track ?? "compact", over);
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
    if (!reqs.has(r)) continue;
    if (lastOf(r) > first(c)) errs.push(`선수 순서 위반: ${c} 가 ${r} 보다 먼저 가르쳐짐`);
  }
  for (const l of plan) {
    if (l.kind === "content") {
      if (l.estLoad > maxLoadOf(o) + 1e-9) errs.push(`${l.code}: 부하 ${l.estLoad} > ${maxLoadOf(o)}`);
      const prim = l.links.filter((k) => k.role === "primary" && k.contentCode.includes("#")).length;
      if (prim > maxAtomsOf(o)) errs.push(`${l.code}: 세부 키워드 ${prim} > ${maxAtomsOf(o)}`);
    }
    if (l.kind !== "content" && l.links.some((k) => k.role === "primary")) errs.push(`${l.code}: 복습·시험 회차에 primary 연결`);
  }
  const codes = plan.map((l) => l.code);
  if (new Set(codes).size !== codes.length) errs.push("회차 코드 중복");
  return errs;
}
