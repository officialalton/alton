import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase-admin";

// 2026-10-08 — 랜딩 숫자는 고정 상수가 아니라 게시된 무료 모의고사 수를 읽는다(오너 확정). 숫자만 노출한다.
export type PublishedCounts = { sat: number; ap: number };

async function readCount(): Promise<PublishedCounts> {
  const db = createAdminClient();
  const base = () => db.from("mock_exam_sets").select("set_group_id", { count: "exact", head: true }).eq("status", "published").eq("access_tier", "free").is("archived_at", null);
  // 프로그램을 나눠 센다(2026-10-09): SAT 제목에 AP 세트가 섞여 17로 나오던 오류. AP 는 별도 집계.
  const [ap, all] = await Promise.all([base().eq("exam_program", "ap"), base()]);
  if (ap.error || all.error || ap.count === null || all.count === null) return { sat: 0, ap: 0 };
  return { sat: Math.max(all.count - ap.count, 0), ap: ap.count };
}

/** 게시된 무료 모의고사 수(SAT / AP 별도). 조회 실패는 0(= 숫자 없는 문구로 대체). 10분 캐시. */
export const getPublishedPracticeTestCount = unstable_cache(async (): Promise<PublishedCounts> => {
  try {
    return await readCount();
  } catch {
    return { sat: 0, ap: 0 };
  }
}, ["landing-practice-test-counts-v2"], { revalidate: 600 });
