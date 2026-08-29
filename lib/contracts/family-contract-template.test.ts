import { describe, expect, it } from "vitest";
import { renderFamilyContractHtml } from "./family-contract-template";

describe("renderFamilyContractHtml", () => {
  it("학부모/학생 이름을 본문에 채우고 서명 anchor를 포함한다", () => {
    const html = renderFamilyContractHtml({ parentName: "김민지", studentName: "지훈" });

    expect(html).toContain("김민지");
    expect(html).toContain("지훈");
    expect(html).toContain("/sig1/");
    expect(html).toContain("제1조");
    expect(html).toContain("제2조");
    expect(html).toContain("제3조");
  });
});
