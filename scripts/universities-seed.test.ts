import { describe, expect, it } from "vitest";
import { parseCsv, toUniversityRows } from "./universities-seed";

describe("universities-seed CSV 파싱", () => {
  it("따옴표로 감싼 콤마 포함 필드를 올바르게 분리한다", () => {
    const rows = parseCsv('a,b,c\n1,"x, y",z\n');
    expect(rows[0]).toEqual(["a", "b", "c"]);
    expect(rows[1]).toEqual(["1", "x, y", "z"]);
  });

  it("Part 1 레지스트리 CSV에서 200개교를 파싱하고 필수 필드를 채운다", () => {
    const rows = toUniversityRows();
    expect(rows.length).toBe(200);
    for (const r of rows) {
      expect(r.name.length).toBeGreaterThan(0);
      expect(r.country).toBe("United States");
    }
    expect(rows[0].rank_final).toBe(1);
    expect(rows[0].name).toContain("Princeton");
  });

  it("합격확률/가능성 예측 관련 필드를 만들지 않는다", () => {
    const rows = toUniversityRows();
    const keys = Object.keys(rows[0]);
    for (const k of keys) {
      expect(k.toLowerCase()).not.toMatch(/chance|probability|predict/);
    }
  });
});
