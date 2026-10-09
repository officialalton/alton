// AP 해설(explanation_en)은 생성기가 수식을 `$...$` 없이 평문·TeX 로 섞어 쓴 경우가 많다("\frac{500 \pi}{3}", "e^{-0.25t}", "3pi/4", 글자 그대로의 "√").
// 응시 결과 화면이 본문과 같은 방식(KaTeX)으로 그리도록 렌더 직전에 보수적으로 `$...$` 를 입힌다. 이미 `$...$` 인 부분은 건드리지 않는다.
// 이 정규화는 표시용이며 저장된 해설은 바뀌지 않는다(생성 프롬프트는 `$...$` 를 요구한다 — scripts/ap-generation/prompts.ts).

const MATH_SEG = /(\\\$|\$\$[\s\S]+?\$\$|\$[^$\n]+?\$)/;
function mapOutside(text: string, fn: (plain: string) => string): string {
  return text.split(MATH_SEG).map((seg, i) => (i % 2 === 1 ? seg : fn(seg))).join("");
}
const decodeUnicodeEscapes = (t: string) => t.replace(/\\u([0-9a-fA-F]{4})/g, (_, h: string) => String.fromCharCode(parseInt(h, 16)));

// 백슬래시 명령으로 시작하는 수식 덩어리: 앞의 숫자, \cmd, {…} 묶음, 첨자, 이어지는 \cmd·숫자·한 글자 변수·연산자.
const ATOM = String.raw`(?:\{(?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*\}|[_^](?:\{(?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*\}|\d+(?:\.\d+)?|[A-Za-z]|\\[A-Za-z]+)|[ \t]*\d[\d.]*|[ \t]*d[a-z](?![A-Za-z])|[ \t]*\\[A-Za-z]+|[ \t]*\\[,;! ]|[ \t]*[A-HJ-Zb-z](?![A-Za-z])|[ \t]*[+\-=*/^()\[\]][ \t]*(?=[\d\\(\[A-Za-z{^_)\]]))`;
const CMD_RUN = new RegExp(String.raw`(?:\d+(?:\.\d+)?[ \t]*|[A-Za-z0-9]+\^)?\\[A-Za-z]+${ATOM}*`, "g");
const POWER = /(?:\|[^|\n]{1,20}\||\[[^\[\]\\^]*\]|\((?:[^()]|\([^()]*\))*\)|[A-Za-z0-9]+)\^(?:\{(?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*\}|\((?:[^()]|\([^()]*\))*\)|\\[A-Za-z]+|-?[A-Za-z0-9.]+)/g;
// 부등호 사슬(<=, >= 가 하나 이상): "0 <= t <= 6", "x<=2", "p <= 1"
const INEQ = /(?:[-+]?[A-Za-z0-9.]+(?:\([^()]*\))?(?:\^[A-Za-z0-9]+)?)(?:[ ]?(?:<=|>=|<|>)[ ]?[-+]?[A-Za-z0-9.]+(?:\([^()]*\))?(?:\^[A-Za-z0-9]+)?)+/g;

export function autoMathExplanation(text: string): string {
  if (!text) return text;
  let t = decodeUnicodeEscapes(text);
  t = t.replace(/\^pi\b/g, "^\\pi"); // e^pi
  t = mapOutside(t, (s) => s.replace(/\^\(((?:[^()]|\([^()]*\))*)\)/g, "^{$1}")); // 괄호 지수 → 중괄호(지수 전체가 올라가게)
  // TeX 명령이 든 지수(`e^{- \frac{1}{10} t}`)는 한 덩어리로 먼저 감싼다(그다음 단계가 안쪽 명령만 따로 감싸지 않게).
  t = mapOutside(t, (s) => s.replace(POWER, (m) => (/\^\{[\s\S]*\\/.test(m) && !/^\(|^\[/.test(m) ? `$${m}$` : m)));
  t = mapOutside(t, (s) => s.replace(INEQ, (m) => { if (!/<=|>=/.test(m)) return m; const core = m.replace(/[.,]+$/, ""); return `$${core.replace(/<=/g, "\\le ").replace(/>=/g, "\\ge ").replace(/\s{2,}/g, " ")}$${m.slice(core.length)}`; }));
  t = mapOutside(t, (s) => s.replace(CMD_RUN, (m) => { const core = m.replace(/[\s.,]+$/, ""); return `$${core}$${m.slice(core.length)}`; }));
  t = mapOutside(t, (s) => s.replace(POWER, (m) => `$${m}$`)); // 평문 거듭제곱
  t = mapOutside(t, (s) => s.replace(/\b(\d+(?:\.\d+)?)[ \t]?pi\b|(?<![\\A-Za-z])pi\b/g, (_m, n?: string) => (n ? `$${n}\\pi$` : "$\\pi$")));
  return t;
}

/** 화면에 보이는 원문 TeX 흔적(자동 화면 점검용). `$...$` 로 그려진 수식은 KaTeX HTML 이라 여기 걸리지 않는다. */
export const RAW_TEX_TOKENS = /\\(?:frac|dfrac|pi|int|displaystyle|sqrt|cdot|left|right|le|ge|infty|sum|lim|theta|ln)\b|\^\{|\\u[0-9a-fA-F]{4}/;
