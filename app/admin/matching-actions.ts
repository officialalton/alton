"use server";

// 2026-09-10(매칭 공통화) — 이 파일의 confirmMatch()는 더 이상 legacy
// `enrollments` 테이블에 쓰지 않는다. 조사 결과 그 경로는 실제 v3 학생
// 커리큘럼·예약 흐름과 완전히 분리돼 있어("매칭 성공"처럼 보여도 수업
// 운영으로 이어지지 않음), matching-common-actions.ts의 공통 v3 배정
// 경로(confirmStudentTeacherSubjectMatch — subject_enrollments +
// teacher_assignments를 하나의 트랜잭션으로 확정하고 커리큘럼까지 시딩)로
// 완전히 옮겼다. 매칭 탭·신규 통합 보드·상담 체험 신청이 전부 이 하나의
// 공통 경로만 호출한다. 총 회차 수 파라미터는 이 경로에 존재하지 않는다.

import { confirmStudentTeacherSubjectMatch, type ConfirmStudentTeacherSubjectMatchResult } from "./matching-common-actions";

export type ConfirmMatchResult = ConfirmStudentTeacherSubjectMatchResult;

export async function confirmMatch(
  studentId: string,
  teacherId: string,
  subjectId: string
): Promise<ConfirmMatchResult> {
  return confirmStudentTeacherSubjectMatch({ childId: studentId, teacherId, subjectId });
}
