import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase-admin";

// 2026-10-08 — 랜딩 숫자는 고정 상수가 아니라 게시된 무료 모의고사 수를 읽는다(오너 확정). 숫자만 노출한다.
async function readCount(): Promise<number> {
  const { count, error } = await createAdminClient()
    .from("mock_exam_sets")
    .select("set_group_id", { count: "exact", head: true })
    .eq("status", "published")
    .eq("access_tier", "free")
    .is("archived_at", null);
  if (error || count === null) return 0;
  return count;
}

/** 게시된 무료 모의고사 수. 조회 실패는 0(= 숫자 없는 문구로 대체). 10분 캐시. */
export const getPublishedPracticeTestCount = unstable_cache(async () => {
  try {
    return await readCount();
  } catch {
    return 0;
  }
}, ["landing-practice-test-count"], { revalidate: 600 });
