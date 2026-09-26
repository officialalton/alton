import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getRoleHomePath } from "@/lib/session-view";
import type { UnitPreview } from "@/app/student/curriculum-overlay-actions";
import UnitPreviewView from "./UnitPreviewView";

// 학생·보호자의 회차별 '수업 준비' 진입점.
//
// 2026-09-13 지시 6절과 같은 원칙이다: 실제 session id나 예약이 없어도 회차 기준으로
// 열린다. 이 화면은 아무것도 만들지 않는다 — 읽기만 한다. 답 제출·필기·수업 시작은
// 실제 수업(/session/[id])에서만 일어난다.
//
// 범위 판단과 내용 고르기는 전부 DB 함수(unit_preview_for_viewer)에 있다. 본인 회차가
// 아니면 null 이 돌아오고, 그때는 없는 회차와 구분하지 않는다(존재를 흘리지 않는다).
export const dynamic = "force-dynamic";

export default async function UnitPreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ unitId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { unitId } = await params;
  const { tab } = await searchParams;
  const { user, profile, supabase } = await requireUser();

  const { data, error } = await supabase.rpc("unit_preview_for_viewer", {
    p_overlay_unit_id: unitId,
  });
  if (error) {
    console.error(JSON.stringify({ event: "unit_preview_page_failed", message: error.message }));
  }
  const preview = (data as UnitPreview | null) ?? null;
  if (!preview) notFound();

  // 2026-09-14 제품 오너: 예약된 수업이 있으면 '수업 준비'는 곧 그 수업 화면이다(교재·문제 뷰어가 거기 있다).
  // 이 요약 화면은 아직 수업이 잡히지 않은 회차에만 쓴다.
  if (preview.sessionId) redirect(`/session/${preview.sessionId}`);

  // 과목 이름과 (보호자일 때) 학생 이름. 회차 → 오버레이 → 수강으로 올라간다.
  // 여기서 못 읽어도 화면은 열린다 — 머리말이 비는 것뿐이다.
  const { data: unitRow } = await supabase
    .from("curriculum_overlay_units")
    .select("overlay_id")
    .eq("id", unitId)
    .maybeSingle();
  const { data: overlayRow } = unitRow
    ? await supabase
        .from("student_curriculum_overlays")
        .select("subject_enrollment_id")
        .eq("id", unitRow.overlay_id as string)
        .maybeSingle()
    : { data: null };
  const { data: enrollmentRow } = overlayRow
    ? await supabase
        .from("subject_enrollments")
        .select("subject:subjects(name), child:profiles(name)")
        .eq("id", overlayRow.subject_enrollment_id as string)
        .maybeSingle()
    : { data: null };

  const one = (rel: unknown) => (Array.isArray(rel) ? rel[0] : rel) as { name?: string } | null;
  const subjectName = one(enrollmentRow?.subject)?.name ?? null;
  const studentName =
    profile?.role === "student" && user ? null : one(enrollmentRow?.child)?.name ?? null;

  return (
    <UnitPreviewView
      preview={preview}
      subjectName={subjectName}
      studentName={studentName}
      backHref={getRoleHomePath(profile?.role)}
      initialTab={tab}
    />
  );
}
