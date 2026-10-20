import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase-admin";
import { AP_LAYOUTS, AP_SUBJECT_NAME, CALCULATOR_TEXT, isApPublicSubject, type ApSection } from "@/lib/ap-exam/layouts";
import { SUBJECT_UNITS, type SubjectUnit } from "./subject-units.generated";

// 공개 과목 소개 페이지의 데이터 원본. 정적 메타(시험 구성·단원)는 저장소에서, 공개 세트 이름은 서버에서 읽기 전용으로.
// 문항 본문·정답·해설은 어떤 경로로도 읽지 않는다(세트 이름·종류만 선택).

export const SAT_SLUG = "sat";
export type SubjectRow = { label: string; minutes: number; count: number; note: string };
export type SubjectMeta = {
  slug: string;
  code: string;
  name: string;
  kind: "ap" | "sat";
  rows: SubjectRow[];
  units: SubjectUnit[];
  unitsTitle: string;
  totalMinutes: number;
  totalQuestions: number;
  description: string;
  faq: { q: string; a: string }[];
};

export const apSlug = (code: string) => code.replace(/^ap_/, "ap-").replace(/_/g, "-");
export function subjectCodeFromSlug(slug: string): string | null {
  if (slug === SAT_SLUG) return SAT_SLUG;
  if (!/^ap-[a-z0-9-]+$/.test(slug)) return null;
  const code = slug.replace(/-/g, "_");
  return Object.prototype.hasOwnProperty.call(AP_LAYOUTS, code) && isApPublicSubject(code) ? code : null; // 세트 공개 전 신규 과목은 404
}

const SAT_ROWS: SubjectRow[] = [
  { label: "Reading & Writing, Module 1", minutes: 32, count: 27, note: "Multiple choice" },
  { label: "Reading & Writing, Module 2", minutes: 32, count: 27, note: "Multiple choice, adaptive" },
  { label: "Math, Module 1", minutes: 35, count: 22, note: "Multiple choice and student-produced response" },
  { label: "Math, Module 2", minutes: 35, count: 22, note: "Multiple choice and student-produced response, adaptive" },
];

function apRow(s: ApSection): SubjectRow {
  const calc = CALCULATOR_TEXT[s.calculator];
  const kind = s.kind === "mc" ? "Multiple choice" : s.count === 1 ? "Free response" : "Free response";
  return { label: s.label, minutes: s.minutes, count: s.count, note: [kind, calc].filter(Boolean).join(" · ") };
}

export function getSubjectMeta(slug: string): SubjectMeta | null {
  const code = subjectCodeFromSlug(slug);
  if (!code) return null;
  if (code === SAT_SLUG) {
    return {
      slug, code, name: "SAT", kind: "sat", rows: SAT_ROWS, units: [], unitsTitle: "Sections",
      totalMinutes: SAT_ROWS.reduce((a, r) => a + r.minutes, 0), totalQuestions: SAT_ROWS.reduce((a, r) => a + r.count, 0),
      description: "Free digital SAT practice tests with two adaptive modules per section, detailed results and explanations after grading.",
      faq: [
        { q: "How is the digital SAT structured?", a: "Reading & Writing and Math each have two modules. Your performance on the first module of a section shapes the difficulty of the second." },
        { q: "Are the SAT practice tests on ALTON free?", a: "Yes. A free ALTON account includes the published SAT practice tests with detailed results and explanations." },
      ],
    };
  }
  const name = AP_SUBJECT_NAME[code];
  const layout = AP_LAYOUTS[code];
  const rows = layout.map(apRow);
  const totalMinutes = layout.reduce((a, s) => a + s.minutes, 0);
  const hasMc = layout.some((s) => s.kind === "mc");
  const hasFrq = layout.some((s) => s.kind === "frq");
  const faq = [
    { q: `How is the ${name} exam structured?`, a: `The exam has ${layout.length} part${layout.length > 1 ? "s" : ""} and takes about ${totalMinutes} minutes in total. The table above lists the sections, time limits and question counts used in ALTON practice tests.` },
    { q: `Are the ${name} practice tests free?`, a: `Published ${name} practice tests are available with a free ALTON account, with detailed results and explanations after grading.` },
  ];
  if (hasMc && hasFrq) faq.push({ q: "Does ALTON cover both multiple-choice and free-response sections?", a: "Practice sets are labeled by what they contain: full practice exams, multiple-choice practice, or free-response practice." });
  return {
    slug, code, name, kind: "ap", rows, units: SUBJECT_UNITS[code] ?? [], unitsTitle: "Units and topics",
    totalMinutes, totalQuestions: layout.reduce((a, s) => a + s.count, 0),
    description: `Free ${name} practice tests: exam format, units and topics, and published practice sets with detailed results and explanations.`,
    faq,
  };
}

export function allSubjectSlugs(): string[] {
  return [...Object.keys(AP_SUBJECT_NAME).filter(isApPublicSubject).map(apSlug), SAT_SLUG];
}

export type PublicSet = { name: string };
type SetRow = { name: string | null; exam_program: string | null; ap_subject: string | null };

/** 순수 함수: 공개 세트 행 → 과목 코드별 세트 이름(이름만). */
export function groupPublicSets(rows: SetRow[]): Record<string, PublicSet[]> {
  const out: Record<string, PublicSet[]> = {};
  for (const r of rows) {
    if (!r.name) continue;
    const key = r.exam_program === "ap" ? r.ap_subject : r.exam_program === null || r.exam_program === "sat" ? SAT_SLUG : null;
    if (!key) continue;
    (out[key] ??= []).push({ name: r.name });
  }
  for (const k of Object.keys(out)) out[k].sort((a, b) => a.name.localeCompare(b.name, "en", { numeric: true }));
  return out;
}

export const getPublicSetsBySubject = unstable_cache(async (): Promise<Record<string, PublicSet[]>> => {
  try {
    const db = createAdminClient();
    const { data, error } = await db
      .from("mock_exam_sets")
      .select("name, exam_program, ap_subject")
      .eq("status", "published").eq("access_tier", "free").is("archived_at", null)
      .limit(2000);
    if (error || !data) return {};
    return groupPublicSets(data as SetRow[]);
  } catch {
    return {};
  }
}, ["public-sets-by-subject-v1"], { revalidate: 3600 });
