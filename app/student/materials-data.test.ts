import { describe, expect, it, vi } from "vitest";
import { loadLibraryDoc, loadMaterialsLibrary } from "./materials-data";

// 정답·해설은 컬럼 권한이 회수돼 서버 admin 으로만 읽는다 — 로더 단위 테스트에서는 그 조회만 대체한다.
vi.mock("@/lib/legacy-problem-answers", () => ({
  loadLegacyProblemAnswers: async (ids: string[]) => new Map(ids.map((id) => [id, { correctIndex: 1, explanation: "해설" }])),
}));

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
type FreeDocRow = { id: string; title: string; subject_id: string; unit_id: string | null; subject: { name: string }; kind?: string; primary_keyword_id?: string | null; access_tier?: string };
function makeMaterialsLibrarySupabase(params: {
  enrollments: Array<{ subject_id: string; subject: { name: string } }>;
  subjectEnrollments: Array<{ subject_id: string; subject: { name: string } }>;
  docs: Array<{ id: string; title: string; subject_id: string; unit_id: string | null; access_tier?: string; kind?: string; primary_keyword_id?: string | null }>;
  /** 2026-10-05 S3 — access_tier='free' 질의(loadFreePublishedDocs)에 돌려줄 행. */
  freeDocs?: FreeDocRow[];
  calls?: string[];
}) {
  // 호출 순서·필터를 기록하는 체인 빌더. curriculum_docs 는 .eq("access_tier","free") 가 걸리면 무료 공개 질의,
  // .in("subject_id", …) 가 걸리면 수강 과목 질의로 구분한다.
  const make = (table: string) => {
    const filters: Record<string, unknown> = {};
    const resolveRows = () => {
      if (table === "enrollments") return params.enrollments;
      if (table === "subject_enrollments") return params.subjectEnrollments;
      if (table === "curriculum_docs") {
        if (filters.access_tier === "free") return params.freeDocs ?? [];
        const ids = filters.subject_id as string[];
        return params.docs.filter((d) => ids.includes(d.subject_id));
      }
      if (table === "subjects") return (filters.id as string[]).map((id) => ({ id, name: `name-${id}` }));
      return [];
    };
    const builder = {
      select: () => builder,
      eq: (col: string, v: unknown) => ((filters[col] = v), builder),
      in: (col: string, v: unknown) => ((filters[col] = v), builder),
      is: () => builder,
      order: () => builder,
      then: (resolve: (v: { data: unknown[] }) => unknown) => {
        params.calls?.push(`${table}${filters.access_tier === "free" ? ":free" : ""}`);
        return resolve({ data: resolveRows() });
      },
    };
    return builder;
  };
  return { from: make } as never;
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

  // 2026-10-05 무료 회원 S3 — 수강 과목 ∪ 무료 공개 자료.
  it("무료 공개 자료는 수강 과목이 없어도 보이고, 수강 과목 안의 무료 자료는 중복되지 않는다", async () => {
    const supabase = makeMaterialsLibrarySupabase({
      enrollments: [{ subject_id: "sub1", subject: { name: "SAT Math" } }],
      subjectEnrollments: [],
      docs: [
        { id: "doc1", title: "SAT 교재", subject_id: "sub1", unit_id: null },
        { id: "docFreeInSub1", title: "SAT 무료", subject_id: "sub1", unit_id: null, access_tier: "free" },
      ],
      freeDocs: [
        { id: "docFreeInSub1", title: "SAT 무료", subject_id: "sub1", unit_id: null, subject: { name: "SAT Math" } },
        { id: "docFree2", title: "영어 무료", subject_id: "sub2", unit_id: null, subject: { name: "SAT R&W" } },
      ],
    });
    const result = await loadMaterialsLibrary(supabase, "student1");
    expect(result).toEqual([
      { subjectId: "sub1", subjectName: "SAT Math", docs: [
        { id: "doc1", title: "SAT 교재", unitTitle: null },
        { id: "docFreeInSub1", title: "SAT 무료", unitTitle: null },
      ] },
      { subjectId: "sub2", subjectName: "SAT R&W", docs: [{ id: "docFree2", title: "영어 무료", unitTitle: null }] },
    ]);
  });

  it("includeEnrolled=false(무료 회원)는 수강 과목을 조회하지 않고 무료 공개 자료만 돌려준다", async () => {
    const calls: string[] = [];
    const supabase = makeMaterialsLibrarySupabase({
      enrollments: [{ subject_id: "sub1", subject: { name: "SAT Math" } }],
      subjectEnrollments: [],
      docs: [{ id: "doc1", title: "SAT 교재", subject_id: "sub1", unit_id: null }],
      freeDocs: [{ id: "docFree2", title: "영어 무료", subject_id: "sub2", unit_id: null, subject: { name: "SAT R&W" } }],
      calls,
    });
    const result = await loadMaterialsLibrary(supabase, "student1", { includeEnrolled: false });
    expect(result).toEqual([{ subjectId: "sub2", subjectName: "SAT R&W", docs: [{ id: "docFree2", title: "영어 무료", unitTitle: null }] }]);
    expect(calls).toEqual(["curriculum_docs:free"]);
  });

  it("무료 공개 자료가 없고 수강도 없으면 빈 목록", async () => {
    const supabase = makeMaterialsLibrarySupabase({ enrollments: [], subjectEnrollments: [], docs: [], freeDocs: [] });
    expect(await loadMaterialsLibrary(supabase, "student1", { includeEnrolled: false })).toEqual([]);
  });
});

describe("buildSubjectMaterialTree — 무료 공개만으로 들어온 과목", () => {
  it("freeOnlySubjectIds 과목에서는 access_tier='free' 자료만 남긴다(RLS와 두 겹)", async () => {
    const { buildSubjectMaterialTree } = await import("@/lib/subject-material-library");
    const rows = (table: string, filters: Record<string, unknown>) => {
      if (table === "subjects") return [{ id: "sub2", name: "SAT R&W" }];
      if (table === "curriculum_docs") return [
        { id: "free", title: "무료", kind: "html", subject_id: "sub2", primary_keyword_id: null, access_tier: "free" },
        { id: "paid", title: "유료", kind: "html", subject_id: "sub2", primary_keyword_id: null, access_tier: "tutoring" },
      ];
      void filters;
      return [];
    };
    const supabase = {
      from: (table: string) => {
        const filters: Record<string, unknown> = {};
        const b = {
          select: () => b, eq: () => b, in: () => b, is: () => b, order: () => b,
          then: (resolve: (v: { data: unknown[] }) => unknown) => resolve({ data: rows(table, filters) }),
        };
        return b;
      },
    } as never;
    const tree = await buildSubjectMaterialTree(supabase, ["sub2"], { freeOnlySubjectIds: new Set(["sub2"]) });
    expect(tree[0].flatDocIds).toEqual(["free"]);
    const plain = await buildSubjectMaterialTree(supabase, ["sub2"]);
    expect(plain[0].flatDocIds).toEqual(["free", "paid"]);
  });
});
