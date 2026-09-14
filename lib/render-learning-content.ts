import katex from "katex";

// P2/P3 5단계 — 교재·문제 본문의 수식을 읽을 수 있게 렌더링한다.
//
// 지문에 섞여 들어오는 수식은 LaTeX 표기($...$ 인라인, $$...$$ 블록)를 쓴다.
// 지금까지는 그냥 문자열로 노출돼 "$\\frac{1}{2}$"가 그대로 보였다.
//
// KaTeX는 네트워크 없이 동작하고 서버에서도 문자열로 렌더링할 수 있어, 학생이
// 수업 중 오프라인에 가까운 상태여도 수식이 깨지지 않는다.

export type ContentPart =
  | { kind: "text"; value: string }
  | { kind: "math"; html: string; display: boolean }
  | { kind: "math-error"; source: string };

const TOKEN = /\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g;

/**
 * 본문을 "글"과 "수식" 조각으로 나눈다. 수식이 하나도 없으면 글 한 조각만
 * 돌려주므로, 수식을 쓰지 않는 교재는 지금과 똑같이 렌더링된다.
 *
 * 깨진 수식은 조용히 버리지 않고 원문을 그대로 보여준다 — 학생 화면에서 내용이
 * 사라지는 것이 가장 나쁘고, 교사가 오타를 발견할 수 있어야 한다.
 */
export function splitLearningContent(source: string): ContentPart[] {
  const parts: ContentPart[] = [];
  let lastIndex = 0;
  TOKEN.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = TOKEN.exec(source)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ kind: "text", value: source.slice(lastIndex, match.index) });
    }
    const display = match[1] !== undefined;
    const expression = (match[1] ?? match[2] ?? "").trim();
    try {
      parts.push({
        kind: "math",
        display,
        html: katex.renderToString(expression, {
          displayMode: display,
          throwOnError: true,
          output: "html",
        }),
      });
    } catch {
      parts.push({ kind: "math-error", source: match[0] });
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < source.length) {
    parts.push({ kind: "text", value: source.slice(lastIndex) });
  }
  if (parts.length === 0) parts.push({ kind: "text", value: source });
  return parts;
}

/** 본문에 수식이 섞여 있는지 — 스타일시트를 붙일지 판단할 때 쓴다. */
export function hasMath(source: string): boolean {
  TOKEN.lastIndex = 0;
  return TOKEN.test(source);
}
