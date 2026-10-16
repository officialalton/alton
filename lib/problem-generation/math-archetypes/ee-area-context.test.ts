// 2026-10-13 외부 감사 S-M04 회귀: ee.polynomial_distribution.compose_kind 의 넓이 문맥형은 안쪽 정사각형 변이 바깥 변보다 길어
// "덮이지 않은 넓이"가 항상 음수가 되는 문항(gid bc9b4038…)을 만들 수 있었다. 이제 v 가 충분히 클 때 바깥 > 안쪽 > 0 이어야 한다.
import { describe, expect, it } from "vitest";
import { EE_ARCHETYPES } from "./skills/equivalent-expressions";
import { generateOne } from "./sweep";
import { verifyInstance } from "./verify";

const ARCH = EE_ARCHETYPES.find((a) => a.id === "ee.polynomial_distribution.compose_kind")!;
const side = (expr: string, v: string, at: number) => new Function(v, `return ${expr.replace(/(\d)([a-z])/g, "$1*$2").replace(/−/g, "-")};`)(at) as number;

describe("compose_kind area context: the inner square is never larger than the outer one", () => {
  it("over 1500 seeds every area-context instance has outer > inner > 0 for large v and a positive area", () => {
    let area = 0;
    for (let seed = 0; seed < 1500; seed++) {
      const g = generateOne(ARCH, seed);
      if (!g.ok) continue;
      const m = g.inst.stimulus.match(/side length \$([^$]+)\$ \w+, and a .* with side length \$([^$]+)\$ \w+ is placed inside it, where (\w) is/);
      if (!m) continue; // abstract variant
      area++;
      const [, outer, inner, v] = m;
      const big = 1000;
      expect(side(inner, v, big), `seed ${seed}: ${inner} vs ${outer}`).toBeGreaterThan(0);
      expect(side(outer, v, big), `seed ${seed}: ${outer} must exceed ${inner}`).toBeGreaterThan(side(inner, v, big));
      expect(verifyInstance(ARCH, g.inst).ok, `seed ${seed}`).toBe(true);
    }
    expect(area).toBeGreaterThan(100);
  });
});
