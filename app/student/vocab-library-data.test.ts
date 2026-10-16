import { describe, expect, it } from "vitest";
import { normalizeVocabQuizSource } from "./vocab-library-data";

describe("normalizeVocabQuizSource", () => {
  it("빈 객체·null 도 세 필드를 채운다(시험 목록 '시험' 탭 크래시 방지)", () => {
    const empty = { customWords: false, bookIds: [], folderIds: [] };
    expect(normalizeVocabQuizSource({})).toEqual(empty);
    expect(normalizeVocabQuizSource(null)).toEqual(empty);
  });
  it("있는 값은 유지하고 빠진 키만 채운다", () => {
    expect(normalizeVocabQuizSource({ customWords: true, bookIds: ["b1"] })).toEqual({ customWords: true, bookIds: ["b1"], folderIds: [] });
  });
});
