import { redirect } from "next/navigation";

// 2026-09-21 — 모의고사 목록은 StudentShell "Mock Exams" 탭으로 통합했다(좌측 네비 유지). 기존 링크
// 호환을 위한 리다이렉트만 남긴다. 응시/결과 화면(/student/mock-exam/[attemptId])은 그대로 독립 라우트.
export default function StudentMockExamListRedirect() {
  redirect("/student?tab=mock-exam");
}
