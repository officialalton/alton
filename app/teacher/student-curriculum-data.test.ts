import { describe, expect, it } from "vitest";
import { loadStudentCurriculum, loadEligibleLibrary } from "./student-curriculum-data";

function makeSupabaseMock(tables: Record<string, unknown[]>, single?: unknown) {
  const callCounts: Record<string, number> = {};
  return {
    callCounts,
    from: (table: string) => {
      callCounts[table] = (callCounts[table] ?? 0) + 1;
      const rows = tables[table] ?? [];
      const builder: {
        select: () => typeof builder;
        eq: () => typeof builder;
        order: () => typeof builder;
        in: () => typeof builder;
        limit: () => typeof builder;
        maybeSingle: () => Promise<{ data: unknown }>;
        then: (resolve: (value: { data: unknown[] }) => unknown) => Promise<unknown>;
      } = {
        select: () => builder,
        eq: () => builder,
        order: () => builder,
        in: () => builder,
        limit: () => builder,
        maybeSingle: () => Promise.resolve({ data: single ?? rows[0] ?? null }),
        then: (resolve) => Promise.resolve({ data: rows }).then(resolve),
      };
      return builder;
    },
  };
}

describe("loadStudentCurriculum", () => {
  it("활성 오버레이가 없으면 빈 커리큘럼을 반환한다", async () => {
    const mock = makeSupabaseMock({}, null);
    const result = await loadStudentCurriculum(mock as never, "enr1");
    expect(result).toEqual({ overlayId: null, units: [] });
  });

  it("오버레이 단원과 키워드/자료 관계를 배치로 조합한다(N+1 방지)", async () => {
    const mock = makeSupabaseMock(
      {
        curriculum_overlay_units: [
          {
            id: "u1",
            source_unit_id: "base1",
            position: 1,
            unit_title: "단원1",
            note: null,
            status: "not_started",
            status_changed_at: null,
          },
          {
            id: "u2",
            source_unit_id: null,
            position: 2,
            unit_title: "보강단원",
            note: null,
            status: "in_progress",
            status_changed_at: "2026-09-07T00:00:00Z",
          },
        ],
        curriculum_overlay_unit_keywords: [{ overlay_unit_id: "u1", keyword_id: "kw1" }],
        curriculum_overlay_unit_materials: [{ overlay_unit_id: "u2", curriculum_doc_id: "doc1" }],
      },
      { id: "overlay1" }
    );
    const result = await loadStudentCurriculum(mock as never, "enr1");
    expect(result.overlayId).toBe("overlay1");
    expect(result.units).toHaveLength(2);
    expect(result.units[0].keywordIds).toEqual(["kw1"]);
    expect(result.units[1].materialDocIds).toEqual(["doc1"]);
    expect(mock.callCounts.curriculum_overlay_unit_keywords).toBe(1);
    expect(mock.callCounts.curriculum_overlay_unit_materials).toBe(1);
  });
});

describe("loadEligibleLibrary", () => {
  it("공개(published)된 교재만 담고, 단원은 전부 담는다", async () => {
    const mock = makeSupabaseMock({
      subject_template_units: [{ id: "u1", position: 1, unit_title: "단원1" }],
      curriculum_docs: [{ id: "doc1", title: "공개교재" }],
    });
    const result = await loadEligibleLibrary(mock as never, "sub1");
    expect(result.units).toEqual([{ id: "u1", position: 1, unitTitle: "단원1" }]);
    expect(result.publishedDocs).toEqual([{ id: "doc1", title: "공개교재" }]);
    expect(result.keywords).toEqual([]);
  });

  it("2026-09-09(UAT 지적, 제품 오너 승인): 과목 공용 키워드 사전(subject_keywords)을 함께 담는다", async () => {
    const mock = makeSupabaseMock({
      subject_template_units: [],
      curriculum_docs: [],
      subject_keywords: [{ id: "kw1", label: "이차방정식" }],
    });
    const result = await loadEligibleLibrary(mock as never, "sub1");
    expect(result.keywords).toEqual([{ id: "kw1", label: "이차방정식" }]);
  });
});
