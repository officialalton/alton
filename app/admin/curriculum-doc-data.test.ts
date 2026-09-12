import { describe, expect, it, vi } from "vitest";
import { loadAllCurriculumDocs } from "./curriculum-doc-data";

function makeSupabaseMock(opts?: { docCount?: number; sectionsPerDoc?: number; problemsPerSection?: number }) {
  const docCount = opts?.docCount ?? 1;
  const sectionsPerDoc = opts?.sectionsPerDoc ?? 1;
  const problemsPerSection = opts?.problemsPerSection ?? 0;

  const docs = Array.from({ length: docCount }, (_, i) => ({
    id: `doc${i}`,
    title: `문서${i}`,
    status: "draft",
    subject_id: "sub1",
    unit_id: null,
    subject: { name: "SAT Math" },
    unit: null,
  }));
  const sections = docs.flatMap((d, di) =>
    Array.from({ length: sectionsPerDoc }, (_, si) => ({
      id: `sec${di}-${si}`,
      curriculum_doc_id: d.id,
      position: si + 1,
      title: "개념",
      body: "<p>본문</p>",
      teaching_tip: null,
      section_type: "problem" as const,
    }))
  );
  const problems = sections.flatMap((s) =>
    Array.from({ length: problemsPerSection }, (_, pi) => ({
      id: `${s.id}-p${pi}`,
      section_id: s.id,
      format: "mc" as const,
      passage: "문제",
      options: null,
      correct_index: null,
      explanation: "",
      difficulty: "medium" as const,
    }))
  );

  const tables: Record<string, unknown[]> = {
    curriculum_docs: docs,
    curriculum_doc_sections: sections,
    problems,
    subject_keywords: [],
    curriculum_doc_section_keywords: [],
    problem_keywords: [],
  };

  const callCounts: Record<string, number> = {};

  return {
    callCounts,
    from: (table: string) => {
      callCounts[table] = (callCounts[table] ?? 0) + 1;
      const rows = tables[table] ?? [];
      const builder: {
        select: () => typeof builder;
        order: () => typeof builder;
        in: () => typeof builder;
        then: (
          resolve: (value: { data: unknown[] }) => unknown
        ) => Promise<unknown>;
      } = {
        select: () => builder,
        order: () => builder,
        in: () => builder,
        then: (resolve) => Promise.resolve({ data: rows }).then(resolve),
      };
      return builder;
    },
  };
}

describe("loadAllCurriculumDocs", () => {
  it("section_type을 sectionType으로 매핑한다", async () => {
    const mock = makeSupabaseMock();
    const docs = await loadAllCurriculumDocs(mock as never);
    expect(docs[0].sections[0].sectionType).toBe("problem");
  });

  it("R9(Task 2): 문서/섹션/문제 개수가 늘어도 각 테이블을 정확히 한 번씩만 조회한다(N+1 방지)", async () => {
    const mock = makeSupabaseMock({ docCount: 5, sectionsPerDoc: 3, problemsPerSection: 2 });
    await loadAllCurriculumDocs(mock as never);

    expect(mock.callCounts.curriculum_docs).toBe(1);
    expect(mock.callCounts.curriculum_doc_sections).toBe(1);
    expect(mock.callCounts.problems).toBe(1);
    expect(mock.callCounts.subject_keywords).toBe(1);
    expect(mock.callCounts.curriculum_doc_section_keywords).toBe(1);
    expect(mock.callCounts.problem_keywords).toBe(1);
  });
});
