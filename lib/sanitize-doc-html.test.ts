import { describe, expect, it } from "vitest";
import { sanitizeDocHtml } from "./sanitize-doc-html";

describe("sanitizeDocHtml", () => {
  it("표 태그를 허용한다", () => {
    const html = "<table><tbody><tr><td>내용</td></tr></tbody></table>";
    expect(sanitizeDocHtml(html)).toBe(html);
  });

  it("여전히 script 태그는 제거한다", () => {
    expect(sanitizeDocHtml("<script>alert(1)</script><p>본문</p>")).toBe("<p>본문</p>");
  });
});
