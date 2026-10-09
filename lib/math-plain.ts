// 목록 제목용 TeX → 읽기 쉬운 한 줄 텍스트(렌더러 없이). 완벽한 조판이 아니라 "$f$", "\ln\left(4x^{2}+4\right)" 같은 원문이 그대로 보이지 않게 한다.
const GREEK: Record<string, string> = {
  alpha: "α", beta: "β", gamma: "γ", delta: "δ", theta: "θ", lambda: "λ", mu: "μ", pi: "π", sigma: "σ", phi: "φ", omega: "ω", Delta: "Δ", Sigma: "Σ", Omega: "Ω",
};
const SYMBOL: Record<string, string> = {
  cdot: "·", times: "×", div: "÷", pm: "±", le: "≤", leq: "≤", ge: "≥", geq: "≥", neq: "≠", ne: "≠", approx: "≈", infty: "∞", to: "→", rightarrow: "→",
  int: "∫", sum: "Σ", prod: "Π", partial: "∂", ldots: "…", dots: "…", in: "∈", circ: "°", degree: "°",
};
const FUNCS = new Set(["ln", "log", "sin", "cos", "tan", "sec", "csc", "cot", "lim", "exp", "max", "min", "arcsin", "arccos", "arctan"]);

function braced(s: string, i: number): [string, number] | null {
  if (s[i] !== "{") return null;
  let d = 0;
  for (let j = i; j < s.length; j++) {
    if (s[j] === "{") d++;
    else if (s[j] === "}" && --d === 0) return [s.slice(i + 1, j), j + 1];
  }
  return null;
}
function convert(s: string): string {
  let out = "";
  for (let i = 0; i < s.length; ) {
    const c = s[i];
    if (c === "\\") {
      const m = /^\\([A-Za-z]+)/.exec(s.slice(i));
      if (!m) { out += s[i + 1] ?? ""; i += 2; continue; }
      const name = m[1];
      i += m[0].length;
      if (name === "left" || name === "right" || name === "displaystyle" || name === "mathrm" || name === "mathbf" || name === "text") { continue; }
      if (name === "frac" || name === "dfrac") {
        const a = braced(s, i); const b = a ? braced(s, a[1]) : null;
        if (a && b) { out += `(${convert(a[0])})/(${convert(b[0])})`; i = b[1]; continue; }
      }
      if (name === "sqrt") {
        const a = braced(s, i);
        if (a) { out += `√(${convert(a[0])})`; i = a[1]; continue; }
      }
      if (GREEK[name]) out += GREEK[name];
      else if (SYMBOL[name]) out += SYMBOL[name];
      else if (FUNCS.has(name)) out += name;
      else out += name;
      continue;
    }
    if (c === "^" || c === "_") {
      const a = braced(s, i + 1);
      if (a) { const inner = convert(a[0]); out += c === "^" ? `^${inner.length > 1 ? `(${inner})` : inner}` : `_${inner}`; i = a[1]; continue; }
    }
    if (c === "{" || c === "}") { i++; continue; }
    out += c; i++;
  }
  return out;
}

/** 본문 전체에서 $...$ / $$...$$ / \( \) 구간만 변환하고 구분자는 지운다. 수식이 없으면 그대로. */
export function mathToPlain(text: string): string {
  if (!text || !/[$\\]/.test(text)) return text;
  const t = text
    .replace(/\$\$([\s\S]+?)\$\$/g, (_, m) => convert(m))
    .replace(/\\\(([\s\S]+?)\\\)/g, (_, m) => convert(m))
    .replace(/\$([^$]+?)\$/g, (_, m) => convert(m));
  return /\\[A-Za-z]/.test(t) ? convert(t) : t;
}
