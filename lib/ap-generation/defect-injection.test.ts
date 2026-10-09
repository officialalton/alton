import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { runInjection, summarizeInjection } from "./defect-injection";
import type { McPack } from "./gates";

const items = (JSON.parse(readFileSync("data/ap/stock/items.json", "utf-8")) as { stockKey: string; apSubjectCode: string; kind: string; validation: string; payload: McPack }[])
  .filter((i) => i.kind === "mc" && i.validation === "auto_passed" && i.payload.explanation_en && i.payload.archetype)
  .map((i) => ({ key: i.stockKey, subject: i.apSubjectCode, pack: i.payload }));

describe("주입 결함 탐지(무료 계층)", () => {
  const s = summarizeInjection(runInjection(items));
  it("정상 통과 문항은 키/해설 일치 규칙에 오탐되지 않는다", () => { expect(s.falseRejects).toBe(0); });
  it("오답 키 주입은 전부 탐지된다(launch 차단 결함)", () => { expect(s.byDefect.wrong_key.applicable).toBeGreaterThan(0); expect(s.byDefect.wrong_key.missed).toEqual([]); });
  it("복수 정답(같은 텍스트) 주입은 전부 탐지된다", () => { expect(s.byDefect.multiple_correct.missed).toEqual([]); });
});
