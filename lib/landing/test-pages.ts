import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase-admin";
import { SAT_SLUG, subjectCodeFromSlug } from "./subjects";
import { SUBJECT_UNITS } from "./subject-units.generated";

// 공개 시험(세트) 개별 소개 페이지의 데이터. 문항 본문·정답·해설은 읽지 않는다 —
// 세트 이름과 구성 집계(섹션·영역/단원·난이도별 문항 수)만 읽기 전용으로 가져온다.

export const testSlug = (name: string) =>
  name.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

const SAT_DOMAIN_LABEL: Record<string, string> = {
  algebra: "Algebra",
  advanced_math: "Advanced Math",
  problem_solving_data: "Problem-Solving and Data Analysis",
  geometry_trig: "Geometry and Trigonometry",
  rw_information_ideas: "Information and Ideas",
  rw_craft_structure: "Craft and Structure",
  rw_expression_ideas: "Expression of Ideas",
  rw_standard_english: "Standard English Conventions",
};
const SECTION_LABEL: Record<string, string> = { rw: "Reading & Writing", math: "Math", mc: "Multiple choice", frq: "Free response" };
const DIFFICULTY_LABEL: Record<string, string> = { easy: "Easier", medium: "Medium", hard: "Harder" };

export type ItemRow = { section: string; sat_domain: string | null; difficulty: string | null };
export type Tally = { label: string; count: number };
export type TestComposition = { total: number; sections: Tally[]; topics: Tally[]; topicsTitle: string; difficulty: Tally[] };

function bump(m: Map<string, number>, k: string) {
  m.set(k, (m.get(k) ?? 0) + 1);
}

/** 순수 함수: 세트 문항 행 → 공개용 구성 집계. */
export function summarizeComposition(rows: ItemRow[], subjectCode: string): TestComposition {
  const sec = new Map<string, number>();
  const topic = new Map<string, number>();
  const diff = new Map<string, number>();
  const units = new Map((SUBJECT_UNITS[subjectCode] ?? []).map((u) => [u.code, u.title]));
  for (const r of rows) {
    bump(sec, r.section);
    if (r.difficulty) bump(diff, r.difficulty);
    if (!r.sat_domain) continue;
    const ap = /^ap:(\d+)\./.exec(r.sat_domain);
    if (ap) bump(topic, `Unit ${ap[1]}: ${units.get(ap[1]) ?? "Topics"}`);
    else if (SAT_DOMAIN_LABEL[r.sat_domain]) bump(topic, SAT_DOMAIN_LABEL[r.sat_domain]);
  }
  const toList = (m: Map<string, number>, label: (k: string) => string): Tally[] => [...m.entries()].map(([k, count]) => ({ label: label(k), count }));
  const sections = toList(sec, (k) => SECTION_LABEL[k] ?? k.toUpperCase());
  const difficulty = (["easy", "medium", "hard"] as const).filter((d) => diff.has(d)).map((d) => ({ label: DIFFICULTY_LABEL[d], count: diff.get(d)! }));
  const topics = toList(topic, (k) => k).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "en", { numeric: true }));
  return { total: rows.length, sections, topics, topicsTitle: subjectCode === SAT_SLUG ? "Skills domains covered" : "Units covered", difficulty };
}

export type PublicTest = { id: string; name: string; slug: string };
type SetRow = { id: string; name: string | null; exam_program: string | null; ap_subject: string | null };

/** 순수 함수: 과목 코드 → 공개 세트(번호 자연 정렬, slug 중복 제거). */
export function setsForSubject(rows: SetRow[], subjectCode: string): PublicTest[] {
  const out: PublicTest[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    if (!r.name) continue;
    const key = r.exam_program === "ap" ? r.ap_subject : r.exam_program === null || r.exam_program === "sat" ? SAT_SLUG : null;
    if (key !== subjectCode) continue;
    const slug = testSlug(r.name);
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    out.push({ id: r.id, name: r.name, slug });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name, "en", { numeric: true }));
}

const loadAllPublicSets = unstable_cache(async (): Promise<SetRow[]> => {
  try {
    const { data, error } = await createAdminClient()
      .from("mock_exam_sets")
      .select("id, name, exam_program, ap_subject")
      .eq("status", "published").eq("access_tier", "free").is("archived_at", null)
      .limit(2000);
    return error || !data ? [] : (data as SetRow[]);
  } catch {
    return [];
  }
}, ["public-test-sets-v1"], { revalidate: 3600 });

export async function getPublicTests(subjectCode: string): Promise<PublicTest[]> {
  return setsForSubject(await loadAllPublicSets(), subjectCode);
}

/** sitemap용: 모든 과목의 {subject, test} 쌍(DB 1회 조회). */
export async function getAllPublicTestPaths(subjectSlugs: string[]): Promise<{ subject: string; test: PublicTest }[]> {
  const rows = await loadAllPublicSets();
  const out: { subject: string; test: PublicTest }[] = [];
  for (const s of subjectSlugs) {
    const code = subjectCodeFromSlug(s);
    if (!code) continue;
    for (const test of setsForSubject(rows, code)) out.push({ subject: s, test });
  }
  return out;
}

export const getTestComposition = unstable_cache(async (setId: string, subjectCode: string): Promise<TestComposition | null> => {
  try {
    const { data, error } = await createAdminClient().from("mock_exam_set_items").select("section, sat_domain, difficulty").eq("exam_set_id", setId).limit(1000);
    if (error || !data || data.length === 0) return null;
    return summarizeComposition(data as ItemRow[], subjectCode);
  } catch {
    return null;
  }
}, ["public-test-composition-v1"], { revalidate: 3600 });
