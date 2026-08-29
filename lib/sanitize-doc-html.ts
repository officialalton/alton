import sanitizeHtml from "sanitize-html";

// 052(교재 편집기)의 리치 텍스트 툴바가 만들어내는 태그 + 구글독스 등 외부에서
// 붙여넣은 서식(색상/배경/표 테두리)을 허용한다. contenteditable(execCommand)로
// 만들어진 HTML이나 붙여넣기로 들어온 HTML을 그대로 저장하지 않고, 서버
// 액션에서 저장 직전 한 번 거른다 — 렌더링 쪽(dangerouslySetInnerHTML)은 여러
// 곳(학생 세션뷰, 교재 라이브러리)에 흩어져 있어 매번 거르기보다 쓰기 경계
// 한 곳에서 막는 게 안전하다.
//
// allowedAttributes는 여전히 태그 공통 {}(즉 style 외 다른 속성은 전부 제거)를
// 기본으로 하되, style만 관련 태그에 한해 허용한다. style 값 자체는
// allowedStyles가 속성별로 화이트리스트 정규식 검증하므로, onclick 같은 다른
// 속성 주입이나 style 안의 위험한 값(javascript: URL 등)은 여전히 막힌다.
const STYLED_TAGS = [
  "p",
  "div",
  "span",
  "h1",
  "h2",
  "h3",
  "h4",
  "ul",
  "ol",
  "li",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
  "blockquote",
];

const COLOR_PATTERN = /^(#[0-9a-f]+|rgb\([\d\s,]+\)|[a-z]+)$/i;
const LENGTH_PATTERN = /^\d+(\.\d+)?(px|em|rem|%)$/;

export function sanitizeDocHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: [
      "p",
      "b",
      "strong",
      "i",
      "em",
      "u",
      "h1",
      "h2",
      "h3",
      "h4",
      "ul",
      "ol",
      "li",
      "br",
      "hr",
      "div",
      "span",
      "table",
      "thead",
      "tbody",
      "tr",
      "th",
      "td",
      "blockquote",
    ],
    allowedAttributes: Object.fromEntries(STYLED_TAGS.map((tag) => [tag, ["style"]])),
    allowedStyles: {
      "*": {
        color: [COLOR_PATTERN],
        "background-color": [COLOR_PATTERN],
        "font-weight": [/^(normal|bold|[1-9]00)$/],
        "font-style": [/^(normal|italic)$/],
        "text-decoration": [/^(none|underline|line-through)$/],
        "text-align": [/^(left|center|right|justify)$/],
        border: [/^[\d.]+(px|em) (solid|dashed|dotted) #[0-9a-f]+$/i],
        "border-color": [COLOR_PATTERN],
        "border-width": [LENGTH_PATTERN],
        "border-style": [/^(solid|dashed|dotted|none)$/],
        padding: [LENGTH_PATTERN],
        margin: [LENGTH_PATTERN],
        width: [LENGTH_PATTERN],
        "border-radius": [LENGTH_PATTERN],
      },
    },
  });
}
