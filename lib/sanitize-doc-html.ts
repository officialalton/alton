import sanitizeHtml from "sanitize-html";

// 052(교재 편집기)의 리치 텍스트 툴바가 만들어내는 태그만 허용한다.
// contenteditable(execCommand)로 만들어진 HTML을 그대로 저장하지 않고,
// 서버 액션에서 저장 직전 한 번 거른다 — 렌더링 쪽(dangerouslySetInnerHTML)은
// 여러 곳(학생 세션뷰, 교재 라이브러리)에 흩어져 있어 매번 거르기보다
// 쓰기 경계 한 곳에서 막는 게 안전하다.
export function sanitizeDocHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: [
      "p",
      "b",
      "strong",
      "i",
      "em",
      "u",
      "h2",
      "h3",
      "ul",
      "ol",
      "li",
      "br",
      "div",
      "span",
      "table",
      "thead",
      "tbody",
      "tr",
      "th",
      "td",
    ],
    allowedAttributes: {},
  });
}
