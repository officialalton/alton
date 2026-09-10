import { describe, expect, it, vi } from "vitest";
import { loadLibraryDoc, loadMaterialsLibrary } from "./materials-data";

function makeSupabaseMock(attempts: { problem_id: string; correct: boolean | null; response: unknown }[]) {
  const tables: Record<string, unknown> = {
    curriculum_docs: [{ id: "doc1", title: "이차방정식", status: "published" }],
    curriculum_doc_sections: [
      { id: "sec1", position: 1, title: "개념", body: "<p>본문</p>" },
    ],
    problems: [
      {
        id: "prob1",
        format: "mc",
        passage: "판별식이 0이면?",
        options: ["A", "B"],
        correct_index: 1,
        explanation: "해설",
        difficulty: "easy",
        skill_type: null,
        section_id: "sec1",
      },
    ],
  };

  return {
    from: (table: string) => {
      if (table === "session_problem_attempts") {
        const builder = {
          select: () => builder,
          is: () => builder,
          eq: () => builder,
          in: () => builder,
          order: () => builder,
          then: (resolve: (v: { data: typeof attempts }) => unknown) =>
            resolve({ data: attempts }),
        };
        return builder;
      }
      const rows = (tables[table] as unknown[]) ?? [];
      const builder = {
        select: () => builder,
        eq: () => builder,
        in: () => builder,
        order: () => builder,
        maybeSingle: () => Promise.resolve({ data: rows[0] ?? null }),
        then: (resolve: (v: { data: typeof rows }) => unknown) =>
          resolve({ data: rows }),
      };
      return builder;
    },
  } as never;
}

describe("loadLibraryDoc", () => {
  it("studentId가 있으면 이전 시도 기록으로 done/correct 상태를 재구성한다", async () => {
    const supabase = makeSupabaseMock([
      { problem_id: "prob1", correct: true, response: 1 },
    ]);
    const doc = await loadLibraryDoc(supabase, "doc1", "student1");
    const problem = doc!.sections[0].problems[0];
    expect(problem.done).toBe(true);
    expect(problem.correct).toBe(true);
  });

  it("studentId가 없으면(교사/학부모 등) 시도 상태를 조회하지 않고 done=false로 반환한다", async () => {
    const supabase = makeSupabaseMock([]);
    const doc = await loadLibraryDoc(supabase, "doc1", null);
    const problem = doc!.sections[0].problems[0];
    expect(problem.done).toBe(false);
    expect(problem.correct).toBe(null);
  });
});

// 2026-09-09(UAT 지적, 제품 오너 승인) 회귀 테스트: loadMaterialsLibrary()가
// 레거시 enrollments만 조회해 v3 subject_enrollments로만 수강 중인 학생은
// 공개된 교재가 있어도 라이브러리가 항상 비어 보이던 문제.
function makeMaterialsLibrarySupabase(params: {
  enrollments: Array<{ subject_id: string; subject: { name: string } }>;
  subjectEnrollments: Array<{ subject_id: string; subject: { name: string } }>;
  docs: Array<{ id: string; title: string; subject_id: string; unit_id: string | null }>;
}) {
  return {
    from: (table: string) => {
      if (table === "enrollments") {
        return { select: () => ({ eq: () => ({ eq: () => Promise.resolve({ data: params.enrollments }) }) }) };
      }
      if (table === "subject_enrollments") {
        return { select: () => ({ eq: () => ({ eq: () => Promise.resolve({ data: params.subjectEnrollments }) }) }) };
      }
      if (table === "curriculum_docs") {
        return {
          select: () => ({
            in: () => ({
              eq: () => ({ order: () => Promise.resolve({ data: params.docs }) }),
            }),
          }),
        };
      }
      if (table === "subject_template_units") {
        return { select: () => ({ in: () => Promise.resolve({ data: [] }) }) };
      }
      throw new Error(`unexpected table ${table}`);
    },
  } as never;
}

describe("loadMaterialsLibrary", () => {
  it("v3 subject_enrollments로만 수강 중이어도(레거시 enrollments 없음) 공개된 교재가 보인다", async () => {
    const supabase = makeMaterialsLibrarySupabase({
      enrollments: [],
      subjectEnrollments: [{ subject_id: "sub1", subject: { name: "AP Calculus AB" } }],
      docs: [{ id: "doc1", title: "이차방정식 개념", subject_id: "sub1", unit_id: null }],
    });
    const result = await loadMaterialsLibrary(supabase, "student1");
    expect(result).toEqual([
      { subjectId: "sub1", subjectName: "AP Calculus AB", docs: [{ id: "doc1", title: "이차방정식 개념", unitTitle: null }] },
    ]);
  });

  it("레거시와 v3 양쪽에 서로 다른 과목이 있으면 둘 다 보여준다", async () => {
    const supabase = makeMaterialsLibrarySupabase({
      enrollments: [{ subject_id: "sub1", subject: { name: "SAT Math" } }],
      subjectEnrollments: [{ subject_id: "sub2", subject: { name: "AP Calculus AB" } }],
      docs: [
        { id: "doc1", title: "SAT 교재", subject_id: "sub1", unit_id: null },
        { id: "doc2", title: "AP 교재", subject_id: "sub2", unit_id: null },
      ],
    });
    const result = await loadMaterialsLibrary(supabase, "student1");
    expect(result.map((s) => s.subjectId).sort()).toEqual(["sub1", "sub2"]);
  });
});
