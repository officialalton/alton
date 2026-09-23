"use server";

// 대학 진학 정보 DB Part 6 — 로그인 사용자(컨설턴트 등)가 직접 쓰는 액션.
// 관리자 전용 CRUD/승인은 lib/universities/actions.ts. 여기는 본인 세션 클라이언트로
// 써서 RLS(20261473000000)가 안전망 역할을 하게 한다(app/parent/inquiry-actions.ts와
// 동일 원칙 — service_role 어드민 클라이언트를 쓰지 않는다).

import { requireUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import type { SourceUrlType } from "./actions";

/** 컨설턴트(또는 관리자) — 출처 URL 제안. 항상 pending으로 들어가며, 관리자 승인 전에는
 * 공개·수집 대상이 아니다(RLS "university_source_urls_select_approved"). */
export async function proposeUniversitySourceUrl(input: {
  universityId: string;
  url: string;
  sourceType: SourceUrlType;
  cycleYear?: number | null;
  isOfficial: boolean;
}): Promise<void> {
  const { user, profile, supabase } = await requireUser();
  if (profile?.role !== "consultant" && profile?.role !== "admin") {
    throw new Error("컨설턴트 또는 관리자만 출처 URL을 제안할 수 있습니다.");
  }
  const { error } = await supabase.from("university_source_urls").insert({
    university_id: input.universityId,
    url: input.url,
    source_type: input.sourceType,
    cycle_year: input.cycleYear ?? null,
    is_official: input.isOfficial,
    status: "pending",
    submitted_by: user.id,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/consultant");
}

/** 로그인한 누구나 — 공개 대학 정보 화면 어디서나 오류 신고. */
export async function reportUniversityDataIssue(input: {
  universityId?: string | null;
  fieldPath?: string | null;
  reportedValue?: string | null;
  message: string;
}): Promise<void> {
  const { user, profile, supabase } = await requireUser();
  if (!input.message.trim()) throw new Error("신고 내용을 입력해 주세요.");
  const { error } = await supabase.from("university_data_reports").insert({
    university_id: input.universityId ?? null,
    field_path: input.fieldPath ?? null,
    reported_value: input.reportedValue ?? null,
    message: input.message.trim(),
    reporter_id: user.id,
    reporter_role: profile?.role ?? null,
  });
  if (error) throw new Error(error.message);
}
