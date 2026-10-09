import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase-admin";
import { AP_SUBJECT_NAME } from "@/lib/ap-exam/layouts";
import { AP_SUBJECT_BY_CODE } from "@/lib/problem-taxonomy";

// 2026-10-08 — 랜딩 숫자는 고정 상수가 아니라 게시된 무료 모의고사를 읽는다(오너 확정). 하드코딩 숫자 금지.
// 2026-10-09 — SAT 세트 수 + AP 과목별(세트 수·full practice 수). 조회 실패는 빈 값(= 숫자 없는 정적 히어로).
export type ApSubjectAvailability = { subject: string; label: string; sets: number; fullExams: number };
export type LandingAvailability = { sat: number; ap: ApSubjectAvailability[] };
export const EMPTY_AVAILABILITY: LandingAvailability = { sat: 0, ap: [] };

type Row = { exam_program: string | null; ap_subject: string | null; ap_label: string | null };

/** AP 과목 코드의 표시 이름. 알 수 없는 코드는 null(숫자를 틀리게 보이느니 숨긴다). */
export const apSubjectLabel = (code: string): string | null => AP_SUBJECT_BY_CODE.get(code)?.label ?? AP_SUBJECT_NAME[code] ?? null;

/** 게시된 무료 세트 행 → 가용성(순수 함수). */
export function summarizeAvailability(rows: Row[]): LandingAvailability {
  let sat = 0;
  const by = new Map<string, ApSubjectAvailability>();
  for (const r of rows) {
    if (r.exam_program === null || r.exam_program === "sat") { sat += 1; continue; }
    if (r.exam_program !== "ap" || !r.ap_subject) continue;
    const label = apSubjectLabel(r.ap_subject);
    if (!label) continue;
    const cur = by.get(r.ap_subject) ?? { subject: r.ap_subject, label, sets: 0, fullExams: 0 };
    cur.sets += 1;
    if (r.ap_label === "full_practice") cur.fullExams += 1;
    by.set(r.ap_subject, cur);
  }
  return { sat, ap: [...by.values()].sort((a, b) => a.label.localeCompare(b.label)) };
}

async function readAvailability(): Promise<LandingAvailability> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("mock_exam_sets")
    .select("exam_program, ap_subject, ap_label")
    .eq("status", "published").eq("access_tier", "free").is("archived_at", null)
    .limit(2000);
  if (error || !data) return EMPTY_AVAILABILITY;
  return summarizeAvailability(data as Row[]);
}

/** 게시된 무료 모의고사 가용성(SAT / AP 과목별). 조회 실패는 빈 값. 10분 캐시. */
export const getLandingAvailability = unstable_cache(async (): Promise<LandingAvailability> => {
  try {
    return await readAvailability();
  } catch {
    return EMPTY_AVAILABILITY;
  }
}, ["landing-availability-v3"], { revalidate: 600 });
