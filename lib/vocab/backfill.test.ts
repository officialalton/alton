import { describe, expect, it } from "vitest";
import { buildBackfillPrompt, chunk, parseBackfillArgs, parseBackfillResponse, type BackfillRow } from "./backfill";

const rows: BackfillRow[] = [
  { id: "a", word: "abate", definitionKo: "줄어들다", example: "The storm abated." },
  { id: "b", word: "bolster", definitionKo: "강화하다", example: null },
];

describe("parseBackfillArgs", () => {
  it("기본은 dry-run, 두 테이블, 배치 25", () => {
    expect(parseBackfillArgs([])).toEqual({ execute: false, batchSize: 25, limit: null, tables: ["vocab_library_words", "vocab_words"] });
  });
  it("--execute·--table·--batch·--limit", () => {
    expect(parseBackfillArgs(["--execute", "--table=vocab_words", "--batch=10", "--limit=50"])).toEqual({ execute: true, batchSize: 10, limit: 50, tables: ["vocab_words"] });
  });
  it("잘못된 값은 거절", () => {
    expect(() => parseBackfillArgs(["--batch=0"])).toThrow();
    expect(() => parseBackfillArgs(["--table=users"])).toThrow();
  });
});

describe("parseBackfillResponse", () => {
  it("유효한 항목만 받고 나머지는 rejected", () => {
    const r = parseBackfillResponse(rows, { items: [{ id: "a", definition_en: " to lessen " }, { id: "zzz", definition_en: "x y" }, { id: "b", definition_en: "강화" }] });
    expect([...r.accepted]).toEqual([["a", "to lessen"]]);
    expect(r.rejected).toEqual(["b"]);
  });
  it("중복 id 는 첫 번째만, 이상한 응답은 전부 rejected", () => {
    const dup = parseBackfillResponse(rows, { items: [{ id: "a", definition_en: "first one" }, { id: "a", definition_en: "second one" }] });
    expect(dup.accepted.get("a")).toBe("first one");
    expect(parseBackfillResponse(rows, null).rejected).toEqual(["a", "b"]);
  });
});

describe("helpers", () => {
  it("chunk", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });
  it("프롬프트에 모든 행이 들어간다", () => {
    const p = buildBackfillPrompt(rows);
    expect(p).toContain('"id":"a"');
    expect(p).toContain('"id":"b"');
  });
});
