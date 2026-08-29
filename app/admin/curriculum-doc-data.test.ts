import { describe, expect, it, vi } from "vitest";
import { loadAllCurriculumDocs } from "./curriculum-doc-data";

function makeSupabaseMock() {
  const tables: Record<string, unknown[]> = {
    curriculum_docs: [
      {
        id: "doc1",
        title: "이차방정식",
        status: "draft",
        subject_id: "sub1",
        unit_id: null,
        subject: { name: "SAT Math" },
        unit: null,
      },
    ],
    curriculum_doc_sections: [
      {
        id: "sec1",
        curriculum_doc_id: "doc1",
        position: 1,
        title: "개념",
        body: "<p>본문</p>",
        teaching_tip: null,
        section_type: "problem",
      },
    ],
    problems: [],
  };

  return {
    from: (table: string) => {
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
  } as never;
}

describe("loadAllCurriculumDocs", () => {
  it("section_type을 sectionType으로 매핑한다", async () => {
    const docs = await loadAllCurriculumDocs(makeSupabaseMock());
    expect(docs[0].sections[0].sectionType).toBe("problem");
  });
});
