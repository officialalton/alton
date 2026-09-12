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

  it("구글독스에서 붙여넣은 색상/배경 인라인 스타일을 보존한다", () => {
    const html = '<p style="color: #2e74b5; background-color: #eaf1fb; text-align: center;">안내</p>';
    const result = sanitizeDocHtml(html);
    expect(result).toContain("color:#2e74b5");
    expect(result).toContain("background-color:#eaf1fb");
    expect(result).toContain("text-align:center");
  });

  it("표 셀의 테두리/패딩 스타일을 보존한다", () => {
    const html =
      '<table><tbody><tr><td style="border: 1px solid #bfbfbf; padding: 5px;">내용</td></tr></tbody></table>';
    const result = sanitizeDocHtml(html);
    expect(result).toContain("border:1px solid #bfbfbf");
    expect(result).toContain("padding:5px");
  });

  it("h1과 blockquote 태그를 허용한다", () => {
    const html = "<h1>제목</h1><blockquote>인용문</blockquote>";
    expect(sanitizeDocHtml(html)).toBe(html);
  });

  it("style 안에 위험한 값(javascript: URL 등)이 있으면 그 속성만 제거한다", () => {
    const html = '<p style="color: red; background-image: url(javascript:alert(1))">위험</p>';
    const result = sanitizeDocHtml(html);
    expect(result).not.toContain("javascript:");
    expect(result).toContain("color:red");
  });
});

// P2/P3 5단계 — 학습 자료의 그림은 본문의 일부다.
describe("교재 그림", () => {
  it("그림을 보존한다(예전에는 저장 시점에 통째로 사라졌다)", () => {
    const out = sanitizeDocHtml('<p>도표</p><img src="https://cdn.example.com/g.png" alt="그래프">');
    expect(out).toContain("<img");
    expect(out).toContain("https://cdn.example.com/g.png");
    expect(out).toContain('alt="그래프"');
  });

  it("data URL 그림도 보존한다(붙여넣은 이미지)", () => {
    const out = sanitizeDocHtml('<img src="data:image/png;base64,iVBORw0KGgo=">');
    expect(out).toContain("data:image/png;base64");
  });

  it("javascript: 주소는 막는다", () => {
    const out = sanitizeDocHtml('<img src="javascript:alert(1)">');
    expect(out).not.toContain("javascript:");
  });

  it("그림에 이벤트 핸들러를 붙일 수 없다", () => {
    const out = sanitizeDocHtml('<img src="https://a/b.png" onerror="alert(1)">');
    expect(out).not.toContain("onerror");
  });
});
