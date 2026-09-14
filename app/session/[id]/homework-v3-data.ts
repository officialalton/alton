import type { SupabaseClient } from "@supabase/supabase-js";

// 2026-09-14 과제 v3 통일 — 이 수업에 발급된 과제 항목(교사 발급 구역이 쓴다). 학생이 풀이판을 열었으면
// 회수할 수 없다는 사실도 함께 준다.

export type IssuedHomeworkItem = {
  itemId: string;
  problemId: string;
  position: number;
  /** 학생이 이미 풀기 시작했다(풀이판이 있다) — 회수 불가. */
  started: boolean;
};

export async function loadIssuedHomework(supabase: SupabaseClient, sessionId: string): Promise<IssuedHomeworkItem[]> {
  const { data: items } = await supabase
    .from("session_homework_items")
    .select("id, problem_id, position, student_id")
    .eq("session_id", sessionId)
    .order("position", { ascending: true });
  if (!items?.length) return [];
  const { data: work } = await supabase
    .from("session_problem_work")
    .select("problem_id")
    .eq("session_id", sessionId)
    .eq("source", "homework")
    .in("problem_id", items.map((i) => i.problem_id as string));
  const started = new Set((work ?? []).map((w) => w.problem_id as string));
  return items.map((i) => ({
    itemId: i.id as string,
    problemId: i.problem_id as string,
    position: i.position as number,
    started: started.has(i.problem_id as string),
  }));
}

// 2026-09-14 UAT — 발급은 키워드별 개수로. 회차 키워드마다 "문제 은행에서 담을 수 있는 수"를 보여준다.
export type HomeworkKeywordPool = {
  keywordId: string;
  label: string;
  /** 후보 전체(확정·미보관·공개 버전 있음). */
  total: number;
  /** 이 수업에 이미 발급된 것. */
  issued: number;
  /** 수업 고정본에 있는(수업에서 다룬) 것 — 기본으로 제외된다. */
  usedInLesson: number;
  /** 지금 기본 설정(수업에서 다룬 것 제외)으로 더 뽑을 수 있는 수. */
  available: number;
  /** 수업에서 다룬 것까지 포함하면 더 뽑을 수 있는 수. */
  availableWithUsed: number;
};

export async function loadHomeworkKeywordPools(
  supabase: SupabaseClient,
  keywords: { id: string; label: string }[],
  issuedProblemIds: string[],
  usedInLessonIds: string[]
): Promise<HomeworkKeywordPool[]> {
  if (keywords.length === 0) return [];
  const { data: links } = await supabase
    .from("problem_auto_composition_candidates")
    .select("problem_id, keyword_id")
    .in("keyword_id", keywords.map((k) => k.id));
  const issued = new Set(issuedProblemIds);
  const used = new Set(usedInLessonIds);
  const byKeyword = new Map<string, Set<string>>();
  for (const l of links ?? []) {
    const set = byKeyword.get(l.keyword_id as string) ?? new Set<string>();
    set.add(l.problem_id as string);
    byKeyword.set(l.keyword_id as string, set);
  }
  return keywords.map((k) => {
    const ids = Array.from(byKeyword.get(k.id) ?? []);
    const issuedN = ids.filter((id) => issued.has(id)).length;
    const usedN = ids.filter((id) => used.has(id)).length;
    const availableWithUsed = ids.filter((id) => !issued.has(id)).length;
    const available = ids.filter((id) => !issued.has(id) && !used.has(id)).length;
    return { keywordId: k.id, label: k.label, total: ids.length, issued: issuedN, usedInLesson: usedN, available, availableWithUsed };
  });
}
