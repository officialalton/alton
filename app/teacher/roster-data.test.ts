import { describe, expect, it, vi } from "vitest";
import { loadRoster } from "./roster-data";

// 2026-09-09(UAT 지적) 회귀 테스트: loadRoster()가 레거시 enrollments만
// 조회해 R5 매칭 모델(teacher_assignments + subject_enrollments)로 배정된
// v3 담당 학생을 "학생별" 탭에서 놓치던 문제. 두 소스를 합치되, 같은 학생·과목
// 조합이 양쪽에 있어도 중복 표시되지 않아야 한다.

function makeSupabase(params: {
  enrollments: Array<{
    id: string;
    student_id: string;
    subject_id: string;
    subject: { name: string };
  }>;
  assignments: Array<{
    subject_enrollment: { id: string; subject_id: string; child_id: string; subject: { name: string } };
  }>;
  students: Array<{ id: string; grade: string | null; profile: { name: string } }>;
  // C-1(2026-09-10) — 레거시 회차 수는 이제 legacy_sessions 행 수가 아니라
  // app/student/curriculum-data.ts::loadCurricula()와 동일하게
  // teacher_curriculum_template_units 개수·완료 단원 수로 계산한다(목록
  // 카드와 커리큘럼 상세 화면의 회차 표기가 서로 달라 보이던 불일치 수정).
  legacyTemplates?: Array<{ id: string; subject_id: string }>;
  legacyUnits?: Array<{ id: string; template_id: string }>;
  legacySessions?: Array<{ enrollment_id: string; status: string; source_template_unit_id: string | null }>;
  // v3 과목의 진도는 curriculum_overlay_units 기준.
  overlays?: Array<{ id: string; subject_enrollment_id: string }>;
  overlayUnits?: Array<{ overlay_id: string; status: string; source_kind: string }>;
}) {
  return {
    from: vi.fn((table: string) => {
      if (table === "enrollments") {
        return { select: () => ({ eq: () => ({ eq: () => Promise.resolve({ data: params.enrollments }) }) }) };
      }
      if (table === "teacher_assignments") {
        return { select: () => ({ eq: () => ({ eq: () => Promise.resolve({ data: params.assignments }) }) }) };
      }
      if (table === "students") {
        return { select: () => ({ in: () => Promise.resolve({ data: params.students }) }) };
      }
      if (table === "teacher_curriculum_templates") {
        return { select: () => ({ eq: () => ({ in: () => Promise.resolve({ data: params.legacyTemplates ?? [] }) }) }) };
      }
      if (table === "teacher_curriculum_template_units") {
        return { select: () => ({ in: () => Promise.resolve({ data: params.legacyUnits ?? [] }) }) };
      }
      if (table === "legacy_sessions") {
        return { select: () => ({ in: () => Promise.resolve({ data: params.legacySessions ?? [] }) }) };
      }
      if (table === "student_curriculum_overlays") {
        return { select: () => ({ in: () => ({ eq: () => Promise.resolve({ data: params.overlays ?? [] }) }) }) };
      }
      if (table === "curriculum_overlay_units") {
        return { select: () => ({ in: () => Promise.resolve({ data: params.overlayUnits ?? [] }) }) };
      }
      throw new Error(`unexpected table ${table}`);
    }),
  };
}

describe("loadRoster", () => {
  it("두 소스 모두 비어있으면 빈 배열을 반환하고 students 조회는 하지 않는다", async () => {
    const supabase = makeSupabase({ enrollments: [], assignments: [], students: [] });
    const result = await loadRoster(supabase as never, "t1");
    expect(result).toEqual([]);
  });

  it("레거시 enrollments 학생만 있어도 그대로 반환한다(회차 수는 커리큘럼 상세 화면과 동일하게 template 단원 기준으로 계산)", async () => {
    const supabase = makeSupabase({
      enrollments: [
        { id: "e1", student_id: "s1", subject_id: "sub1", subject: { name: "SAT Math" } },
      ],
      assignments: [],
      students: [{ id: "s1", grade: "10학년", profile: { name: "지훈" } }],
      legacyTemplates: [{ id: "tpl1", subject_id: "sub1" }],
      legacyUnits: [
        { id: "u1", template_id: "tpl1" },
        { id: "u2", template_id: "tpl1" },
        { id: "u3", template_id: "tpl1" },
        { id: "u4", template_id: "tpl1" },
      ],
      legacySessions: [
        { enrollment_id: "e1", status: "completed", source_template_unit_id: "u1" },
        { enrollment_id: "e1", status: "completed", source_template_unit_id: "u2" },
        { enrollment_id: "e1", status: "completed", source_template_unit_id: "u3" },
        { enrollment_id: "e1", status: "upcoming", source_template_unit_id: "u4" },
      ],
    });
    const result = await loadRoster(supabase as never, "t1");
    expect(result).toEqual([
      {
        studentId: "s1",
        studentName: "지훈",
        grade: "10학년",
        // 4단원 중 3단원 완료 -> currentSession = min(3+1, max(4,1)) = 4
        subjects: [{ enrollmentId: "e1", subjectId: "sub1", subjectName: "SAT Math", currentSession: 4, totalSessions: 4, source: "legacy", curriculumSourceLabel: null }],
      },
    ]);
  });

  it("2026-09-10(C-1 회귀 방지): 커리큘럼 단원이 아직 없는 레거시 과목은 '0/0회차'가 아니라 목록·상세가 동일한 기준으로 계산된다", async () => {
    const supabase = makeSupabase({
      enrollments: [
        { id: "e1", student_id: "s1", subject_id: "sub1", subject: { name: "테스트1" } },
      ],
      assignments: [],
      students: [{ id: "s1", grade: null, profile: { name: "테스트1444" } }],
      // 아직 어떤 legacy_sessions 실적도 없는 상태 — 예전 로직은 이걸 "0/0회차"로
      // 표시했지만, 상세 화면(loadCurricula)은 template 단원 수(3개)를
      // totalSessions로 쓰고 있어 "1/3회차"로 보였다. 이제 목록도 동일하게
      // 3단원 중 0개 완료 -> "1/3회차"로 일치해야 한다.
      legacyTemplates: [{ id: "tpl1", subject_id: "sub1" }],
      legacyUnits: [
        { id: "u1", template_id: "tpl1" },
        { id: "u2", template_id: "tpl1" },
        { id: "u3", template_id: "tpl1" },
      ],
      legacySessions: [],
    });
    const result = await loadRoster(supabase as never, "t1");
    expect(result[0].subjects[0].totalSessions).toBe(3);
    expect(result[0].subjects[0].currentSession).toBe(1);
  });

  it("teacher1의 실제 활성 v3 배정 시나리오 — legacy enrollments가 비어있어도 v3 배정 학생이 노출된다", async () => {
    const supabase = makeSupabase({
      enrollments: [],
      assignments: [
        {
          subject_enrollment: {
            id: "se1",
            subject_id: "fff052c7-e78f-4100-9dcb-ace4d3bbd2bb",
            child_id: "f2d49de8-dd52-430e-8ae5-eebac0058f02",
            subject: { name: "AP Calculus AB" },
          },
        },
      ],
      students: [{ id: "f2d49de8-dd52-430e-8ae5-eebac0058f02", grade: null, profile: { name: "UAT Kid 113" } }],
    });
    const result = await loadRoster(supabase as never, "2606bc3f-1d16-4f60-8e0e-5a2c2184e1d2");
    expect(result).toEqual([
      {
        studentId: "f2d49de8-dd52-430e-8ae5-eebac0058f02",
        studentName: "UAT Kid 113",
        grade: null,
        subjects: [
          { enrollmentId: "se1", subjectId: "fff052c7-e78f-4100-9dcb-ace4d3bbd2bb", subjectName: "AP Calculus AB", currentSession: 0, totalSessions: 0, source: "v3", curriculumSourceLabel: null },
        ],
      },
    ]);
  });

  it("같은 학생·과목 조합이 legacy와 v3 양쪽에 있어도 중복 표시되지 않는다", async () => {
    const supabase = makeSupabase({
      enrollments: [
        { id: "e1", student_id: "s1", subject_id: "sub1", subject: { name: "SAT Math" } },
      ],
      assignments: [
        { subject_enrollment: { id: "se1", subject_id: "sub1", child_id: "s1", subject: { name: "SAT Math" } } },
      ],
      students: [{ id: "s1", grade: "10학년", profile: { name: "지훈" } }],
    });
    const result = await loadRoster(supabase as never, "t1");
    expect(result).toHaveLength(1);
    expect(result[0].subjects).toHaveLength(1);
    expect(result[0].subjects[0].subjectId).toBe("sub1");
  });

  it("한 학생이 legacy 과목과 v3 과목을 서로 다르게 갖고 있으면 둘 다 보여준다", async () => {
    const supabase = makeSupabase({
      enrollments: [
        { id: "e1", student_id: "s1", subject_id: "sub1", subject: { name: "SAT Math" } },
      ],
      assignments: [
        { subject_enrollment: { id: "se2", subject_id: "sub2", child_id: "s1", subject: { name: "AP Calculus AB" } } },
      ],
      students: [{ id: "s1", grade: "10학년", profile: { name: "지훈" } }],
    });
    const result = await loadRoster(supabase as never, "t1");
    expect(result).toHaveLength(1);
    expect(result[0].subjects.map((s) => s.subjectId).sort()).toEqual(["sub1", "sub2"]);
  });
});
