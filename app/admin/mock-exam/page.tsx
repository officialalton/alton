import { redirect } from "next/navigation";

// 2026-09-19 — 고정형 모의고사 V1을 AdminShell의 "모의고사" 탭으로 통합했다.
// 이 독립 라우트는 기존 북마크·링크 호환을 위한 리다이렉트만 남긴다.
export default function MockExamAdminPageRedirect() {
  redirect("/admin?tab=mock-exam");
}
