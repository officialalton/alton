// 작은 정수계획 솔버(외부 의존성 없음): 밀집 2단계 단체법 + 깊이 우선 분기한정. 6세트 배정의 "정확한" 최소 부족·가능 여부 판정에 쓴다.
// 최소화 문제. 변수는 모두 하한 0. integer[j]=true 면 정수. 목적식 계수가 모두 정수이고 모든 변수가 정수면 목적값은 정수 → 하한을 올림해 가지치기한다.
// 이진 변수(ub=1)는 호출자가 다른 행으로 상한 1 이 보장될 때만 binary 로 표시한다(행을 따로 넣지 않는다).
export type Cons = { coef: [number, number][]; sense: "<=" | ">=" | "="; rhs: number };
export type Problem = { n: number; obj: number[]; cons: Cons[]; integer: boolean[]; binary?: boolean[] };
export type LpResult = { status: "optimal" | "infeasible" | "unbounded"; obj: number; x: number[] };
const EPS = 1e-9;
let DEADLINE = Infinity; // solveMip 가 정한 시한(ms). 단체법 반복 중에도 확인해 퇴화로 멈추는 것을 막는다.

/** lo/hi 가 정한 경계 아래서 LP 완화를 푼다(고정 변수는 소거, 일반 정수의 상한은 행으로 추가). */
export function solveLp(p: Problem, lo: number[], hi: number[]): LpResult {
  const n = p.n; const free: number[] = []; const colOf = new Int32Array(n).fill(-1);
  for (let j = 0; j < n; j++) { if (hi[j] < lo[j] - EPS) return { status: "infeasible", obj: Infinity, x: [] }; if (hi[j] - lo[j] > EPS) { colOf[j] = free.length; free.push(j); } }
  const rows: { a: Map<number, number>; sense: "<=" | ">=" | "="; b: number }[] = [];
  for (const c of p.cons) {
    const a = new Map<number, number>(); let b = c.rhs;
    for (const [j, v] of c.coef) { if (colOf[j] >= 0) a.set(colOf[j], (a.get(colOf[j]) ?? 0) + v); b -= v * lo[j]; }
    if (a.size === 0) { const ok = c.sense === "<=" ? 0 <= b + EPS : c.sense === ">=" ? 0 >= b - EPS : Math.abs(b) < 1e-7; if (!ok) return { status: "infeasible", obj: Infinity, x: [] }; continue; }
    rows.push({ a, sense: c.sense, b });
  }
  for (const j of free) if (Number.isFinite(hi[j]) && !(p.binary?.[j] && hi[j] >= 1 - EPS && lo[j] <= EPS)) rows.push({ a: new Map([[colOf[j], 1]]), sense: "<=", b: hi[j] - lo[j] });
  let base = 0; for (let j = 0; j < n; j++) base += p.obj[j] * lo[j];
  const nf = free.length; const m = rows.length;
  // 열 배치: [원 변수 nf | 여유/잉여 | 인공]
  let ns = 0, na = 0; const kind: ("s" | "e" | "a")[] = [];
  for (const r of rows) { if (r.b < 0) { r.a = new Map([...r.a].map(([k, v]) => [k, -v])); r.b = -r.b; r.sense = r.sense === "<=" ? ">=" : r.sense === ">=" ? "<=" : "="; } }
  // 퇴화(순환) 방지: ≤ 행의 우변에 결정적인 극소 섭동(1e-9 ~ 1e-8)을 더한다. 등식·≥ 행은 건드리지 않아 정합성에 영향이 없고, 정수 해는 반올림한다.
  rows.forEach((r, i) => { if (r.sense === "<=") r.b += 1e-9 + (((i + 1) * 2654435761) % 1000) / 1000 * 1e-8; });
  for (const r of rows) { if (r.sense === "<=") { ns++; kind.push("s"); } else if (r.sense === ">=") { ns++; na++; kind.push("e"); } else { na++; kind.push("a"); } }
  const N = nf + ns + na; const W = N + 1;
  const T: Float64Array[] = rows.map(() => new Float64Array(W)); const basis = new Int32Array(m);
  let si = nf, ai = nf + ns;
  rows.forEach((r, i) => {
    for (const [k, v] of r.a) T[i][k] = v; T[i][N] = r.b;
    if (kind[i] === "s") { T[i][si] = 1; basis[i] = si++; } else if (kind[i] === "e") { T[i][si++] = -1; T[i][ai] = 1; basis[i] = ai++; } else { T[i][ai] = 1; basis[i] = ai++; }
  });
  const isArt = (j: number) => j >= nf + ns;
  const z = new Float64Array(W);
  const pivot = (r: number, c: number) => {
    const pr = T[r]; const inv = 1 / pr[c]; for (let k = 0; k < W; k++) pr[k] *= inv; pr[c] = 1;
    for (let i = 0; i < m; i++) { if (i === r) continue; const f = T[i][c]; if (Math.abs(f) < 1e-14) continue; const ri = T[i]; for (let k = 0; k < W; k++) ri[k] -= f * pr[k]; ri[c] = 0; }
    const f = z[c]; if (Math.abs(f) > 1e-14) { for (let k = 0; k < W; k++) z[k] -= f * pr[k]; z[c] = 0; }
    basis[r] = c;
  };
  const run = (allowArt: boolean): "optimal" | "unbounded" => {
    let degen = 0; let guard = 0;
    for (;;) {
      if (++guard > 200000 || ((guard & 255) === 0 && Date.now() > DEADLINE)) throw new Error("simplex limit");
      let c = -1; let best = -1e-9;
      if (degen > 40) { for (let j = 0; j < N; j++) if ((allowArt || !isArt(j)) && z[j] < -1e-9) { c = j; break; } } // Bland
      else for (let j = 0; j < N; j++) if ((allowArt || !isArt(j)) && z[j] < best) { best = z[j]; c = j; }
      if (c < 0) return "optimal";
      let r = -1; let ratio = Infinity;
      for (let i = 0; i < m; i++) { const a = T[i][c]; if (a > 1e-9) { const q = T[i][N] / a; if (q < ratio - 1e-12 || (Math.abs(q - ratio) <= 1e-12 && r >= 0 && basis[i] < basis[r])) { ratio = q; r = i; } } }
      if (r < 0) return "unbounded";
      degen = ratio < 1e-11 ? degen + 1 : 0;
      pivot(r, c);
    }
  };
  const setCost = (cost: (j: number) => number) => {
    z.fill(0); for (let j = 0; j < N; j++) z[j] = cost(j);
    for (let i = 0; i < m; i++) { const cb = cost(basis[i]); if (cb !== 0) for (let k = 0; k < W; k++) z[k] -= cb * T[i][k]; }
  };
  if (na > 0) {
    setCost((j) => (isArt(j) ? 1 : 0));
    run(true);
    if (-z[N] > 1e-7) return { status: "infeasible", obj: Infinity, x: [] };
    for (let i = 0; i < m; i++) if (isArt(basis[i])) { let c = -1; for (let j = 0; j < nf + ns; j++) if (Math.abs(T[i][j]) > 1e-9) { c = j; break; } if (c >= 0) pivot(i, c); }
  }
  setCost((j) => (j < nf ? p.obj[free[j]] : 0));
  if (run(false) === "unbounded") return { status: "unbounded", obj: -Infinity, x: [] };
  const x = new Array<number>(n); for (let j = 0; j < n; j++) x[j] = lo[j];
  for (let i = 0; i < m; i++) if (basis[i] < nf) x[free[basis[i]]] = lo[free[basis[i]]] + T[i][N];
  let obj = base; for (let j = 0; j < n; j++) obj += p.obj[j] * (x[j] - lo[j]);
  return { status: "optimal", obj, x };
}

export type MipResult = { status: "optimal" | "infeasible" | "limit"; obj: number; x: number[]; nodes: number; rootBound: number; bestBound: number };
/** 깊이 우선 분기한정. cutoff: 이 값 이상의 해는 찾지 않는다(상한). maxNodes 초과 시 status=limit(현재 최선 + 증명된 하한 bestBound). */
export function solveMip(p: Problem, opts: { cutoff?: number; maxNodes?: number; timeMs?: number; log?: (s: string) => void } = {}): MipResult {
  const n = p.n; const intObj = p.obj.every((c, j) => !p.integer[j] || Number.isInteger(c)) && p.obj.every((c, j) => p.integer[j] || c === 0);
  let best: { obj: number; x: number[] } | null = null; let cutoff = opts.cutoff ?? Infinity; let nodes = 0; let rootBound = -Infinity;
  const t0 = Date.now(); let minOpen = Infinity; let limited = false; DEADLINE = opts.timeMs ? t0 + opts.timeMs : Infinity;
  const stack: { lo: number[]; hi: number[]; bound: number }[] = [{ lo: new Array(n).fill(0), hi: new Array(n).fill(Infinity), bound: -Infinity }];
  for (let j = 0; j < n; j++) if (p.binary?.[j]) stack[0].hi[j] = 1;
  while (stack.length) {
    if ((opts.maxNodes && nodes >= opts.maxNodes) || (opts.timeMs && Date.now() - t0 > opts.timeMs)) { limited = true; for (const s of stack) minOpen = Math.min(minOpen, s.bound); break; }
    const nd = stack.pop()!; nodes++;
    const prune = (v: number) => (intObj ? Math.ceil(v - 1e-6) >= cutoff : v >= cutoff - 1e-9);
    if (prune(nd.bound)) continue;
    let lp: LpResult; try { lp = solveLp(p, nd.lo, nd.hi); } catch { limited = true; minOpen = Math.min(minOpen, nd.bound); for (const s2 of stack) minOpen = Math.min(minOpen, s2.bound); break; }
    if (nodes === 1) rootBound = lp.status === "optimal" ? (intObj ? Math.round(lp.obj * 1e6) / 1e6 : lp.obj) : Infinity;
    if (lp.status !== "optimal") continue;
    const bound = intObj ? Math.ceil(lp.obj - 1e-6) : lp.obj; if (bound >= cutoff - (intObj ? 0 : 1e-9)) continue;
    let bj = -1, bf = 0.5 + 1; // 분수 변수: 값이 1 에 가까운(0.5 이상 중 가장 큰) 것 우선, 없으면 가장 분수적인 것
    for (let j = 0; j < n; j++) if (p.integer[j]) { const f = lp.x[j] - Math.floor(lp.x[j] + 1e-7); if (f > 1e-6 && f < 1 - 1e-6) { const score = f >= 0.5 ? 2 - f : 1 + f; if (bj < 0 || score < bf) { bj = j; bf = score; } } }
    if (bj < 0) { const lo2 = intObj ? Math.round(lp.obj) : lp.obj; if (lo2 < cutoff - 1e-9) { best = { obj: lo2, x: lp.x.map((v, j) => (p.integer[j] ? Math.round(v) : v)) }; cutoff = lo2; opts.log?.(`incumbent ${lo2} @node ${nodes}`); } continue; }
    const fl = Math.floor(lp.x[bj] + 1e-7);
    const down = { lo: nd.lo.slice(), hi: nd.hi.slice(), bound }; down.hi[bj] = fl;
    const up = { lo: nd.lo.slice(), hi: nd.hi.slice(), bound }; up.lo[bj] = fl + 1;
    // 위쪽(값 올림) 가지를 먼저 탐색(스택 후입선출)
    stack.push(down); stack.push(up);
  }
  const bestBound = limited ? Math.min(minOpen, best ? best.obj : Infinity) : best ? best.obj : Infinity;
  if (best) return { status: limited ? "limit" : "optimal", obj: best.obj, x: best.x, nodes, rootBound, bestBound };
  return { status: limited ? "limit" : "infeasible", obj: Infinity, x: [], nodes, rootBound, bestBound };
}
