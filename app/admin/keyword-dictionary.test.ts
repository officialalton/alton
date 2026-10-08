import { describe, expect, it } from "vitest";
import { buildKeywordSections, moveItem } from "./keyword-dictionary";
import type { KeywordFolder, SubjectKeyword } from "./subject-data";

const kw = (id: string, label: string, folderId: string | null, sortOrder = 0): SubjectKeyword => ({ id, label, status: "active", folderId, sortOrder });
const folders: KeywordFolder[] = [
  { id: "f2", name: "Craft", position: 1 },
  { id: "f1", name: "Info", position: 0 },
  { id: "f3", name: "비어 있음", position: 2 },
];
const keywords = [kw("a", "Words in Context", "f2"), kw("b", "Inferences", "f1", 2), kw("c", "Central Ideas", "f1", 1), kw("d", "Legacy", null), kw("e", "Orphan", "gone")];

describe("buildKeywordSections", () => {
  it("폴더 position 순, 폴더 안은 sortOrder 순, 폴더 없음/삭제된 폴더는 마지막 기타", () => {
    const s = buildKeywordSections(folders, keywords);
    expect(s.map((x) => x.name)).toEqual(["Info", "Craft", "비어 있음", "기타"]);
    expect(s[0].keywords.map((k) => k.id)).toEqual(["c", "b"]);
    expect(s[3].keywords.map((k) => k.id).sort()).toEqual(["d", "e"]);
    expect(s[2]).toMatchObject({ total: 0, keywords: [] });
  });
  it("기타가 비어 있으면 섹션을 만들지 않는다", () => {
    expect(buildKeywordSections(folders, [kw("a", "x", "f1")]).map((x) => x.name)).not.toContain("기타");
  });
  it("검색은 이름만 거르고 일치 없는 섹션은 숨기며 total은 유지", () => {
    const s = buildKeywordSections(folders, keywords, " infer ");
    expect(s).toHaveLength(1);
    expect(s[0]).toMatchObject({ name: "Info", total: 2 });
    expect(s[0].keywords.map((k) => k.id)).toEqual(["b"]);
  });
});

describe("moveItem", () => {
  it("한 칸 이동, 경계는 그대로", () => {
    expect(moveItem([1, 2, 3], 1, -1)).toEqual([2, 1, 3]);
    expect(moveItem([1, 2, 3], 0, -1)).toEqual([1, 2, 3]);
    expect(moveItem([1, 2, 3], 2, 1)).toEqual([1, 2, 3]);
  });
});
