import { describe, expect, it } from "vitest";
import { applyNotebookFilters, categoryOptions, EMPTY_FILTERS, folderCounts, isMistake, sectionOfEntry, setDomain, setSection, type NotebookEntryLike } from "./model";

const e = (o: Partial<NotebookEntryLike> & { workId: string }): NotebookEntryLike => ({ source: "mock_exam", graded: false, grade: null, satDomain: null, skillCode: null, ...o });
const entries = [
  e({ workId: "a", graded: true, grade: "incorrect", satDomain: "algebra", skillCode: "linear_functions" }),
  e({ workId: "b", graded: true, grade: "partial", satDomain: "rw_craft_structure", skillCode: "words_in_context", source: "lesson" }),
  e({ workId: "c", graded: true, grade: "correct", satDomain: "geometry_trig", skillCode: "circles" }),
  e({ workId: "d" }),
];

describe("notebook model", () => {
  it("오답은 틀림·부분 정답만, 미채점·정답은 아니다", () => {
    expect(entries.map(isMistake)).toEqual([true, true, false, false]);
  });
  it("영역은 domain, 없으면 skill 로 추정하고 분류 없음은 null", () => {
    expect(entries.map(sectionOfEntry)).toEqual(["math", "rw", "math", null]);
    expect(sectionOfEntry(e({ workId: "x", skillCode: "boundaries" }))).toBe("rw");
  });
  it("서브탭: saved 는 오답이 아닌 것, mistakes 는 오답, all 은 전부", () => {
    const ids = (view: "all" | "saved" | "mistakes") => applyNotebookFilters(entries, { ...EMPTY_FILTERS, view }, {}).map((x) => x.workId);
    expect(ids("all")).toEqual(["a", "b", "c", "d"]);
    expect(ids("saved")).toEqual(["c", "d"]);
    expect(ids("mistakes")).toEqual(["a", "b"]);
  });
  it("폴더·Unfiled 필터", () => {
    const asg = { a: "f1", c: "f1", b: "f2" };
    expect(applyNotebookFilters(entries, { ...EMPTY_FILTERS, folder: "f1" }, asg).map((x) => x.workId)).toEqual(["a", "c"]);
    expect(applyNotebookFilters(entries, { ...EMPTY_FILTERS, folder: "unfiled" }, asg).map((x) => x.workId)).toEqual(["d"]);
  });
  it("카테고리 옵션은 가진 분류만, 상위 선택에 따라 연쇄로 좁혀진다", () => {
    expect(categoryOptions(entries, { section: "", domain: "" })).toMatchObject({
      sections: [{ value: "rw" }, { value: "math" }],
      domains: [{ value: "algebra" }, { value: "geometry_trig" }, { value: "rw_craft_structure" }],
    });
    const math = categoryOptions(entries, { section: "math", domain: "" });
    expect(math.domains.map((d) => d.value)).toEqual(["algebra", "geometry_trig"]);
    expect(math.skills.map((s) => s.value)).toEqual(["linear_functions", "circles"]);
    expect(categoryOptions(entries, { section: "math", domain: "algebra" }).skills.map((s) => s.value)).toEqual(["linear_functions"]);
  });
  it("상위를 바꾸면 하위 선택이 비워진다", () => {
    const f = { ...EMPTY_FILTERS, section: "math" as const, domain: "algebra", skill: "linear_functions" };
    expect(setSection(f, "rw")).toMatchObject({ section: "rw", domain: "", skill: "" });
    expect(setDomain(f, "geometry_trig")).toMatchObject({ section: "math", domain: "geometry_trig", skill: "" });
  });
  it("폴더별 개수와 Unfiled", () => {
    const c = folderCounts(entries, { a: "f1", b: "f1", c: "gone" }, [{ id: "f1", name: "X", isDefault: false }, { id: "f2", name: "Y", isDefault: false }]);
    expect(c).toEqual({ all: 4, unfiled: 2, byFolder: { f1: 2, f2: 0 } });
  });
});
