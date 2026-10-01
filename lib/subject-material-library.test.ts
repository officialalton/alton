import { describe, expect, it } from "vitest";
import { buildSubjectMaterialTree, findAdjacentDocs } from "./subject-material-library";

function makeSupabaseMock(tables: Record<string, unknown[]>) {
  return {
    from: (table: string) => {
      const rows = tables[table] ?? [];
      const builder = {
        select: () => builder,
        eq: () => builder,
        in: () => builder,
        is: () => builder,
        order: () => builder,
        then: (resolve: (v: { data: unknown[] }) => unknown) => resolve({ data: rows }),
      };
      return builder;
    },
  } as never;
}

const BASE_TABLES = {
  subjects: [{ id: "sub1", name: "SAT Math" }],
  subject_template_units: [
    { id: "u1", subject_id: "sub1", position: 1, unit_title: "1단원" },
    { id: "u2", subject_id: "sub1", position: 2, unit_title: "2단원" },
  ],
  subject_template_unit_keywords: [
    { unit_id: "u1", keyword_id: "k1" },
    { unit_id: "u2", keyword_id: "k2" },
  ],
  subject_keywords: [
    { id: "k1", subject_id: "sub1", label: "Linear functions" },
    { id: "k2", subject_id: "sub1", label: "Circles" },
    { id: "k3", subject_id: "sub1", label: "고아 키워드(단원 없음)" },
  ],
  curriculum_docs: [
    { id: "doc1", title: "1단원 교재", kind: "html", subject_id: "sub1", primary_keyword_id: "k1" },
    { id: "doc2", title: "2단원 교재", kind: "pdf", subject_id: "sub1", primary_keyword_id: "k2" },
    { id: "doc3", title: "키워드 없는 교재", kind: "html", subject_id: "sub1", primary_keyword_id: null },
    { id: "doc4", title: "고아 키워드 교재", kind: "html", subject_id: "sub1", primary_keyword_id: "k3" },
  ],
};

describe("buildSubjectMaterialTree", () => {
  it("과목 → 단원(순서) → 키워드 → 공개 자료 트리를 만든다", async () => {
    const supabase = makeSupabaseMock(BASE_TABLES);
    const trees = await buildSubjectMaterialTree(supabase, ["sub1"]);
    expect(trees).toHaveLength(1);
    const tree = trees[0];
    expect(tree.subjectName).toBe("SAT Math");
    // 단원 순서: u1(1단원) → u2(2단원) → 단원 미지정
    expect(tree.units.map((u) => u.unitTitle)).toEqual(["1단원", "2단원", "단원 미지정"]);
    expect(tree.units[0].keywordGroups[0]).toMatchObject({ label: "Linear functions", docs: [{ id: "doc1" }] });
    expect(tree.units[1].keywordGroups[0]).toMatchObject({ label: "Circles", docs: [{ id: "doc2" }] });
  });

  it("어떤 단원에도 안 붙은 키워드와 대표 키워드 없는 자료는 '단원 미지정'에 모인다", async () => {
    const supabase = makeSupabaseMock(BASE_TABLES);
    const trees = await buildSubjectMaterialTree(supabase, ["sub1"]);
    const unassigned = trees[0].units.find((u) => u.unitId === null)!;
    const labels = unassigned.keywordGroups.map((g) => g.label);
    expect(labels).toContain("고아 키워드(단원 없음)");
    expect(labels).toContain("키워드 미지정");
    const noKeywordGroup = unassigned.keywordGroups.find((g) => g.keywordId === null)!;
    expect(noKeywordGroup.docs.map((d) => d.id)).toEqual(["doc3"]);
  });

  it("과목에 공개된 자료가 하나도 없으면 결과에서 빠진다(빈 상태)", async () => {
    const supabase = makeSupabaseMock({ ...BASE_TABLES, curriculum_docs: [] });
    const trees = await buildSubjectMaterialTree(supabase, ["sub1"]);
    expect(trees).toEqual([]);
  });

  it("subjectIds가 비어 있으면 쿼리 없이 빈 배열을 돌려준다", async () => {
    const trees = await buildSubjectMaterialTree(makeSupabaseMock({}), []);
    expect(trees).toEqual([]);
  });
});

describe("findAdjacentDocs", () => {
  it("같은 과목 평평한 순서에서 이전/다음 자료를 찾는다", async () => {
    const supabase = makeSupabaseMock(BASE_TABLES);
    const trees = await buildSubjectMaterialTree(supabase, ["sub1"]);
    const mid = findAdjacentDocs(trees, "doc2");
    expect(mid.prev?.id).toBe("doc1");
    expect(mid.next?.id).toBe("doc4");
    const first = findAdjacentDocs(trees, "doc1");
    expect(first.prev).toBeNull();
    const last = findAdjacentDocs(trees, "doc3");
    expect(last.next).toBeNull();
  });

  it("트리에 없는 자료면 전부 null", () => {
    const empty = findAdjacentDocs([], "nope");
    expect(empty).toEqual({ prev: null, next: null, subject: null });
  });
});
