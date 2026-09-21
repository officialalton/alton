import { redirect } from "next/navigation";

// 2026-09-21 — 모의고사 배정은 TeacherShell "Mock Exams" 탭으로 통합했다(좌측 네비 유지). 기존 링크
// 호환을 위한 리다이렉트만 남긴다.
export default function TeacherMockExamRedirect() {
  redirect("/teacher?tab=mock-exam");
}
