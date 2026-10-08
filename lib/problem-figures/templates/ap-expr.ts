// AP 그림 — 안전한 수식 해석기. eval 을 쓰지 않고 재귀 하강 파서로 "2*sqrt(x)", "4 - 0.25*x^2", "P = 100 - 2Q" 같은
// 후보 데이터의 식을 계산한다. 변수는 한 글자(x, t, Q ...) 또는 이름(Q, P). 지원: + - * / ^ ( ) 암묵 곱(2Q, 0.5x, 2(x+1)),
// 함수 sin cos tan exp ln log sqrt abs, 상수 pi e.

type Tok = { t: "num"; v: number } | { t: "id"; v: string } | { t: "op"; v: string };

function lex(src: string): Tok[] | null {
  const s = src.replace(/−/g, "-").replace(/×|·/g, "*").replace(/π/g, "pi").replace(/√/g, "sqrt").replace(/\s+/g, " ").trim();
  const out: Tok[] = [];
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (ch === " ") { i++; continue; }
    if (/[0-9.]/.test(ch)) {
      let j = i;
      while (j < s.length && /[0-9.]/.test(s[j])) j++;
      const v = Number(s.slice(i, j));
      if (!Number.isFinite(v)) return null;
      out.push({ t: "num", v }); i = j; continue;
    }
    if (/[A-Za-z_]/.test(ch)) {
      let j = i;
      while (j < s.length && /[A-Za-z_0-9']/.test(s[j])) j++;
      out.push({ t: "id", v: s.slice(i, j) }); i = j; continue;
    }
    if ("+-*/^(),".includes(ch)) { out.push({ t: "op", v: ch }); i++; continue; }
    return null;
  }
  return out;
}

const FUNCS: Record<string, (x: number) => number> = {
  sin: Math.sin, cos: Math.cos, tan: Math.tan, exp: Math.exp, ln: Math.log, log: Math.log10, sqrt: Math.sqrt, abs: Math.abs,
};
const CONSTS: Record<string, number> = { pi: Math.PI, e: Math.E };

type Node =
  | { k: "num"; v: number } | { k: "var"; n: string }
  | { k: "bin"; o: string; a: Node; b: Node } | { k: "neg"; a: Node } | { k: "fn"; f: string; a: Node };

class P {
  i = 0;
  constructor(private toks: Tok[], private vars: Set<string>) {}
  private peek() { return this.toks[this.i]; }
  private isOp(v: string) { const t = this.peek(); return t?.t === "op" && t.v === v; }
  parse(): Node | null {
    const n = this.expr();
    return n && this.i === this.toks.length ? n : null;
  }
  private expr(): Node | null {
    let a = this.term(); if (!a) return null;
    while (this.isOp("+") || this.isOp("-")) {
      const o = (this.peek() as { v: string }).v; this.i++;
      const b = this.term(); if (!b) return null;
      a = { k: "bin", o, a, b };
    }
    return a;
  }
  private startsFactor() {
    const t = this.peek();
    return !!t && (t.t === "num" || t.t === "id" || (t.t === "op" && t.v === "("));
  }
  private term(): Node | null {
    let a = this.unary(); if (!a) return null;
    for (;;) {
      if (this.isOp("*") || this.isOp("/")) {
        const o = (this.peek() as { v: string }).v; this.i++;
        const b = this.unary(); if (!b) return null;
        a = { k: "bin", o, a, b };
      } else if (this.startsFactor()) { // 암묵 곱
        const b = this.power(); if (!b) return null;
        a = { k: "bin", o: "*", a, b };
      } else return a;
    }
  }
  private unary(): Node | null {
    if (this.isOp("-")) { this.i++; const a = this.unary(); return a ? { k: "neg", a } : null; }
    if (this.isOp("+")) { this.i++; return this.unary(); }
    return this.power();
  }
  private power(): Node | null {
    const a = this.atom(); if (!a) return null;
    if (this.isOp("^")) {
      this.i++;
      const b = this.isOp("-") ? this.unary() : this.power();
      return b ? { k: "bin", o: "^", a, b } : null;
    }
    return a;
  }
  private atom(): Node | null {
    const t = this.peek(); if (!t) return null;
    if (t.t === "num") { this.i++; return { k: "num", v: t.v }; }
    if (t.t === "id") {
      this.i++;
      if (FUNCS[t.v] && this.isOp("(")) {
        this.i++; const a = this.expr();
        if (!a || !this.isOp(")")) return null;
        this.i++; return { k: "fn", f: t.v, a };
      }
      if (FUNCS[t.v]) { const a = this.power(); return a ? { k: "fn", f: t.v, a } : null; }
      if (t.v in CONSTS && !this.vars.has(t.v)) return { k: "num", v: CONSTS[t.v] };
      // 변수 이름이 여러 글자(예: "Qx")이면 한 글자씩 곱으로 풀지 않는다 — 알려진 변수만 허용.
      if (!this.vars.has(t.v)) return null;
      return { k: "var", n: t.v };
    }
    if (t.v === "(") {
      this.i++; const a = this.expr();
      if (!a || !this.isOp(")")) return null;
      this.i++; return a;
    }
    return null;
  }
}

export type Compiled = { fn: (env: Record<string, number>) => number; vars: string[] };

/** 식 문자열 → 계산 함수. 변수 집합은 허용 목록(allowed)으로 제한한다(모르는 이름이면 null). */
export function compileExpr(src: string, allowed: string[]): Compiled | null {
  const toks = lex(src);
  if (!toks || toks.length === 0) return null;
  const vars = new Set(allowed);
  const ast = new P(toks, vars).parse();
  if (!ast) return null;
  const used = new Set<string>();
  const ev = (n: Node, env: Record<string, number>): number => {
    switch (n.k) {
      case "num": return n.v;
      case "var": used.add(n.n); return env[n.n];
      case "neg": return -ev(n.a, env);
      case "fn": return FUNCS[n.f](ev(n.a, env));
      case "bin": {
        const a = ev(n.a, env), b = ev(n.b, env);
        return n.o === "+" ? a + b : n.o === "-" ? a - b : n.o === "*" ? a * b : n.o === "/" ? a / b : Math.pow(a, b);
      }
    }
  };
  // 사용 변수 파악을 위해 한 번 훑는다.
  const probe: Record<string, number> = {};
  for (const v of allowed) probe[v] = 1.3;
  try { ev(ast, probe); } catch { return null; }
  return { fn: (env) => ev(ast, env), vars: [...used] };
}

/** "P = 100 - 2Q" / "MR = 100 - 4Q" / "f(x)=6-0.1*x^2" / "y = 2*sqrt(x)" / "2*sqrt(x)" 를 (좌변, 우변 식)으로 가른다. */
export function splitEquation(src: string): { lhs: string | null; rhs: string } {
  const s = src.trim();
  const m = s.match(/^([^=]+?)\s*=\s*(.+)$/);
  if (!m) return { lhs: null, rhs: s };
  // 곡선 이름 "f(x) = ..." → lhs = f
  const lhs = m[1].trim().replace(/\(.*\)$/, "").trim();
  return { lhs, rhs: m[2].trim() };
}

/** 식 안의 자유 변수 후보(식별자) 목록 — 함수명·상수 제외. */
export function freeIdentifiers(src: string): string[] {
  const s = src.replace(/−/g, "-");
  const ids = new Set<string>();
  for (const m of s.matchAll(/[A-Za-z_][A-Za-z_0-9]*/g)) {
    const id = m[0];
    if (FUNCS[id] || id in CONSTS) continue;
    // "2Q", "0.5x" 에서 숫자 뒤 식별자는 lex 에서 분리되므로 여기서도 그대로 잡힌다.
    ids.add(id);
  }
  return [...ids];
}
