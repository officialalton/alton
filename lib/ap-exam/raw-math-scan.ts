// 화면 DOM 의 "보이는 글자"에서 렌더되지 않은 원문 수식(TeX·평문 수식)을 찾는 토큰 단위 점검(자동 화면 점검·테스트 공용).
// 단순 문자열 검색이 아니라 — KaTeX 가 그린 수식(.katex·MathML), 코드(<code>·<pre>·<kbd>·<samp>), 이스케이프된 달러(\$), 통화 표기($45)는 제외하고
// 텍스트 노드만 본다. 코드 예제의 x^2·<= 는 정당하고, 산문 속 e^{-0.25t}·0 <= t <= 12·\frac 는 진짜 문제다.
// 브라우저(page.evaluate)에서도 쓰도록 이 함수는 외부 심볼을 참조하지 않는 자기완결 함수다(toString 으로 주입).
export type RawMathHit = { kind: string; token: string; context: string };

export function scanRawMath(root: Element, allow?: string[]): RawMathHit[] {
  const SKIP = ".katex, .katex-mathml, .katex-html, code, pre, kbd, samp, script, style, textarea, [data-raw-math-ok]";
  const detectors: { kind: string; re: RegExp }[] = [
    { kind: "tex-command", re: /\\(?:frac|dfrac|tfrac|sqrt|pi|theta|alpha|beta|gamma|Delta|delta|lambda|mu|sigma|omega|int|sum|prod|lim|infty|cdot|times|div|pm|left|right|le|ge|leq|geq|neq|approx|displaystyle|ln|log|sin|cos|tan|text|mathrm|mathbf|overline|vec|bar|hat|begin|end)\b/ },
    { kind: "tex-script", re: /[\^_]\{/ },
    { kind: "plain-exponent", re: /(?:^|[^A-Za-z0-9_])[A-Za-z0-9)\]][ ]?\^[ ]?[({A-Za-z0-9\u2212-]/ },
    { kind: "ascii-inequality", re: /\S[ ]?(?:<=|>=)[ ]?\S/ },
    { kind: "unicode-escape", re: /\\u[0-9a-fA-F]{4}/ },
    { kind: "unrendered-dollar-math", re: /(?:^|[^\\])\$[^$\n]{1,120}[^\\ $]\$/ },
  ];
  const hits: RawMathHit[] = [];
  const walker = root.ownerDocument.createTreeWalker(root, 4 /* NodeFilter.SHOW_TEXT */);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const el = n.parentElement;
    if (!el || el.closest(SKIP)) continue;
    const text = (n.nodeValue || "").replace(/\\\$/g, "\u0000"); // 이스케이프된 달러는 통화 글자
    if (!text.trim()) continue;
    for (const d of detectors) {
      const m = d.re.exec(text);
      if (!m) continue;
      const token = m[0].trim();
      if (allow && allow.some((a) => token.includes(a))) continue;
      hits.push({ kind: d.kind, token, context: text.slice(Math.max(0, m.index - 25), m.index + token.length + 25).replace(/\s+/g, " ") });
    }
  }
  return hits;
}
