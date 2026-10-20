// 풀 모의고사 세트 ID 접두 ↔ AP 과목 단일 소스. 새 과목(Precalculus·European History 등)을 관리자 화면에 연결하는 절차:
//   1) 여기 한 줄(접두 → 과목 코드) 추가  2) 전용 조립기(assemble-<과목>-draft.ts)를 만들어 assemble-draft.ts 의 분기에 연결(물리 계열이면 PHYS_SUBJECTS 에만 추가)
//   3) lib/ap-admin/batches.ts 에 재고 배치 등록  4) 공개 세트가 생긴 뒤 AP_PENDING_PUBLIC_SUBJECTS(lib/ap-exam/layouts.ts)에서 과목 제거.
// 접두는 항상 영문 대문자 2자 + 숫자 1자리(SET_ID_RE). 과목 표시 이름은 AP_SUBJECT_NAME 하나만 쓴다.
export const SET_PREFIX_SUBJECT: Readonly<Record<string, string>> = {
  AB: "ap_calculus_ab", BC: "ap_calculus_bc", ST: "ap_statistics", PH: "ap_physics_1", CH: "ap_chemistry", MI: "ap_microeconomics", MA: "ap_macroeconomics", PS: "ap_psychology",
  CS: "ap_computer_science_a", BI: "ap_biology", EL: "ap_english_language", LT: "ap_english_literature", US: "ap_us_history", WH: "ap_world_history",
  PM: "ap_physics_c_mechanics", EM: "ap_physics_c_electricity_and_magnetism",
};
export const SET_ID_RE = new RegExp(`^(${Object.keys(SET_PREFIX_SUBJECT).join("|")})\\d$`);
export const subjectOfSetIdOrNull = (id: string): string | null => SET_PREFIX_SUBJECT[id.slice(0, 2)] ?? null;
export function subjectOfSetId(id: string): string { const s = subjectOfSetIdOrNull(id); if (!s) throw new Error(`알 수 없는 세트 ID 접두: ${id}`); return s; }
/** 한 조립기(assemble-phys-draft.ts)·재고 로더(phys-pool.ts)를 공유하는 물리 과목. */
export const PHYS_SUBJECTS: readonly string[] = ["ap_physics_1", "ap_physics_c_mechanics", "ap_physics_c_electricity_and_magnetism"];
export const isPhysSubject = (subject: string) => PHYS_SUBJECTS.includes(subject);
