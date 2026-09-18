import { requireAdmin } from "@/lib/admin-auth";
import UatCleanupPanel from "./UatCleanupPanel";

// 2026-09-18 — 일회성 UAT 정리 페이지. 정리가 끝나면 이 디렉토리 전체를 삭제한다.
export default async function UatCleanupPage() {
  await requireAdmin();
  return <UatCleanupPanel />;
}
