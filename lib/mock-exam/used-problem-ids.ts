import type { SupabaseClient } from "@supabase/supabase-js";

/** 다른(공개된) 세트가 이미 쓴 문항 id — 가능하면 겹치지 않게 피한다(사양 5절 "이상적으로 세트 간에도"). */
export async function fetchAlreadyUsedProblemIds(db: SupabaseClient, tier: string): Promise<Set<string>> {
  const { data: publishedSets, error } = await db
    .from("mock_exam_sets")
    .select("id")
    .eq("difficulty_tier", tier)
    .eq("status", "published");
  if (error) throw new Error(error.message);
  const setIds = (publishedSets ?? []).map((s) => s.id);
  if (setIds.length === 0) return new Set();
  const ids = new Set<string>();
  // exam_set_id IN (...) 을 GET 쿼리로 보내므로 세트가 많으면 URI 가 너무 길어진다(공개 세트 수백 개에서 실제로 터졌다) — 50개씩 나눠 조회한다.
  const SET_CHUNK = 50;
  for (let c = 0; c < setIds.length; c += SET_CHUNK) {
    const chunk = setIds.slice(c, c + SET_CHUNK);
    for (let from = 0; ; from += 1000) {
      const { data: page, error: pageErr } = await db
        .from("mock_exam_set_items")
        .select("problem_id")
        .in("exam_set_id", chunk)
        .order("id", { ascending: true })
        .range(from, from + 999);
      if (pageErr) throw new Error(pageErr.message);
      for (const i of page ?? []) ids.add(i.problem_id);
      if (!page || page.length < 1000) break;
    }
  }
  return ids;
}

