import { requireUser } from "@/lib/auth";
import { loadMyAssignedStudents } from "./consultant-data";
import { loadMyAssignedConsultations } from "./intake-data";
import ConsultantShell from "./ConsultantShell";

// 컨설턴트 포지션(2026-09-22 사용자 지시) — 관리자와 완전히 별도인 role·포털.
// 담당 학생을 배정받아 로드맵(상담·에세이 진행 상황 포함)을 직접 작업한다.
// 가볍게 시작: 로드맵은 학생/보호자/관리자가 이미 쓰는 화면·서버 액션을
// 그대로 재사용한다(RLS만 확장). 상담·에세이 전용 화면은 다음 라운드.
//
// Phase 1(2026-09-22 스펙) — "New assignments"(연락 필요한 배정 요청)를
// Home에 함께 보여준다. Schedule/자동 이메일은 Phase 2.
export default async function ConsultantHomePage() {
  const { user, profile, supabase } = await requireUser();
  const [students, assignedConsultations] = await Promise.all([
    loadMyAssignedStudents(supabase, user.id),
    loadMyAssignedConsultations(supabase, user.id),
  ]);

  return (
    <ConsultantShell
      consultantName={profile?.name ?? "컨설턴트"}
      students={students}
      assignedConsultations={assignedConsultations}
    />
  );
}
