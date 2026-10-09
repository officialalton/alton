// 2026-09-22(관리자 계정 구조) — 실제 서버 액션들이 requireAdminOrCapability()로
// 이미 검사하고 있는 capability 문자열의 단일 카탈로그(app/admin/*.ts 전수
// 조사로 뽑음). 마스터 계정이 중간 관리자에게 부여할 수 있는 항목 목록이자,
// 문자열이 코드와 어긋나지 않게 하는 단일 진실 소스.
//
// 중요한 한계(2026-09-22 시작 — 완결 아님): 이 capability들은 booking-actions.ts,
// consultation-actions.ts, matching-actions.ts 등 requireAdminOrCapability()를
// 쓰는 액션 파일에만 걸려 있다. requireAdmin()만 쓰는 훨씬 많은 다른 관리자
// 액션(교재·문제은행 등 다수)은 아직 capability 검사가 없어, admin_tier가
// supervisor여도 그 화면들은 여전히 전체 접근이 된다 — 완전한 샌드박싱은
// 아직 아니다.
export const ADMIN_CAPABILITIES = [
  { key: "manage_consultations", label: "상담·체험수업 관리" },
  { key: "매칭권한", label: "매칭(선생님 배정) 관리" },
  { key: "예약관리권한", label: "예약·수업 일정 관리" },
  { key: "manage_payments", label: "결제·수강권 관리" },
  { key: "정산권한", label: "선생님 정산 관리" },
  { key: "학생관리", label: "학생 계정 관리" },
  { key: "manage_invites", label: "초대 관리" },
  { key: "manage_guardian_consent", label: "보호자 동의 관리" },
  { key: "manage_teacher_workspace", label: "선생님 워크스페이스(Google) 관리" },
  { key: "manage_account_merges", label: "계정 병합" },
] as const;

export type AdminCapabilityKey = (typeof ADMIN_CAPABILITIES)[number]["key"];

export function labelForCapability(key: string): string {
  return ADMIN_CAPABILITIES.find((c) => c.key === key)?.label ?? key;
}
