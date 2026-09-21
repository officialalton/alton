"use server";

import { requireUser } from "@/lib/auth";
import { loadTeacherMockExamStudents, type TeacherMockExamStudent } from "./mock-exam-assign-data";
import {
  loadPublishedMockExamSetsForAssignment,
  loadTeacherMockExamAttemptsForStudent,
  loadMockExamAttemptDetail,
  type MockExamAttemptSummary,
  type MockExamAttemptDetail,
} from "@/lib/mock-exam/attempt-data";
import { loadMockExamSetContentForStaff, type MockExamSetContentItem } from "@/lib/mock-exam/set-content";

export type TeacherMockExamTabData = {
  students: TeacherMockExamStudent[];
  examSets: { id: string; name: string; difficultyTier: string }[];
  attemptsByStudent: Record<string, MockExamAttemptSummary[]>;
};

/** 교사 포털 "Mock Exams" 탭 — 담당 학생·공개 세트·학생별 배정 현황(탭 전환/변경 후 클라이언트에서 호출). */
export async function loadTeacherMockExamTabDataAction(): Promise<TeacherMockExamTabData> {
  const { user, supabase } = await requireUser();
  const [students, examSets] = await Promise.all([
    loadTeacherMockExamStudents(supabase, user.id),
    loadPublishedMockExamSetsForAssignment(supabase),
  ]);
  const attemptLists = await Promise.all(students.map((s) => loadTeacherMockExamAttemptsForStudent(supabase, s.studentId)));
  const attemptsByStudent: Record<string, MockExamAttemptSummary[]> = {};
  students.forEach((s, i) => {
    attemptsByStudent[s.studentId] = attemptLists[i];
  });
  return { students, examSets: examSets.map((s) => ({ id: s.id, name: s.name, difficultyTier: s.difficultyTier })), attemptsByStudent };
}

// 2026-09-21(UAT 지적) — 교사 모의고사 화면을 배정/현황/열람/내역 4개 서브탭으로 재구성한다.

/** "열람" 서브탭 — 공개된 세트의 실제 문항 내용을 읽기 전용으로 본다(학생에게 내는 문제를
 * 미리 확인). mock_exam_set_content_for_staff RPC가 role='teacher'를 이미 허용한다. */
export async function getMockExamSetContentForTeacherAction(examSetId: string): Promise<MockExamSetContentItem[]> {
  const { supabase } = await requireUser();
  return loadMockExamSetContentForStaff(supabase, examSetId);
}

/** "현황" 서브탭 드릴다운 — 담당 학생이 실제로 어떻게 풀었는지 읽기 전용으로 본다.
 * mock_exam_attempt_detail RPC는 teaches_student(student_id)면 채점 확정 전에도
 * 정답·해설·정오를 그대로 내려준다(마스킹은 학생·학부모에게만 적용). */
export async function getMockExamAttemptDetailForTeacherAction(attemptId: string): Promise<MockExamAttemptDetail | null> {
  const { supabase } = await requireUser();
  return loadMockExamAttemptDetail(supabase, attemptId);
}

export type TeacherAssignedMockExamRow = {
  attemptId: string;
  studentId: string;
  studentName: string | null;
  examSetName: string;
  status: string;
  dueAt: string | null;
  totalCount: number;
  correctCount: number | null;
};

/** "내역" 서브탭 — 담당 학생들에게 나간 모의고사 배정·응시 내역을 모아서 본다.
 * mock_exam_attempt_summaries RPC(teaches_student() 게이트)가 assigned_by를 내려주지
 * 않아 엄밀한 "내가 직접 배정한 것만"은 아니다 — 학생 한 명에 담당 교사가 보통 하나뿐이라
 * 실질적으로는 같은 의미이지만, 다른 교사가 같은 학생에게 배정한 것도 섞일 수 있다는 점은
 * 알아두어야 한다(향후 assigned_by 노출이 필요하면 RPC 확장 필요). */
export async function listMyAssignedMockExamAttemptsAction(): Promise<TeacherAssignedMockExamRow[]> {
  const { user, supabase } = await requireUser();
  const students = await loadTeacherMockExamStudents(supabase, user.id);
  const attemptLists = await Promise.all(students.map((s) => loadTeacherMockExamAttemptsForStudent(supabase, s.studentId)));
  const rows: TeacherAssignedMockExamRow[] = [];
  students.forEach((s, i) => {
    for (const a of attemptLists[i]) {
      rows.push({
        attemptId: a.id,
        studentId: s.studentId,
        studentName: s.studentName,
        examSetName: a.examSetName,
        status: a.status,
        dueAt: a.dueAt,
        totalCount: a.totalCount,
        correctCount: a.correctCount,
      });
    }
  });
  return rows;
}
