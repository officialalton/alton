import { describe, expect, it } from "vitest";
import { SKILL_CODES, SAT_DOMAINS } from "../problem-taxonomy";
import { SAT_DOMAIN_DESCRIPTIONS, SAT_SKILL_DESCRIPTIONS } from "./skill-descriptions";
import { satDomainDisplayName, satSkillDisplayName } from "./taxonomy";

describe("SAT 스킬·도메인 설명", () => {
  it("30개 스킬과 8개 도메인 모두 영어 설명이 있다", () => {
    expect(SKILL_CODES).toHaveLength(30);
    for (const s of SKILL_CODES) expect(SAT_SKILL_DESCRIPTIONS[s.code], s.code).toMatch(/^[A-Z][\x20-\x7E]+\.$/);
    expect(SAT_DOMAINS).toHaveLength(8);
    for (const d of SAT_DOMAINS) expect(SAT_DOMAIN_DESCRIPTIONS[d.code], d.code).toMatch(/^[A-Z][\x20-\x7E]+\.$/);
  });

  it("표시 이름은 코드가 아니라 사람이 읽는 이름이다", () => {
    expect(satDomainDisplayName("advanced_math")).toBe("Advanced Math");
    expect(satDomainDisplayName("rw_craft_structure")).toBe("Craft and Structure");
    expect(satSkillDisplayName("lines_angles_triangles")).toBe("Lines, angles, and triangles");
    expect(satDomainDisplayName("unknown_thing")).toBe("Unknown thing");
    expect(satSkillDisplayName(null)).toBe("");
  });
});
