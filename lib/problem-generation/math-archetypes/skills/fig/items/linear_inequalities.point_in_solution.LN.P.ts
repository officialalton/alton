// linear_inequalities.point_in_solution.LN.P — 순수 부등식 그래프(음영, 축 제목 x·y)에서 선택지의 점 중 해(또는 해가 아닌 것)를 고른다. 선택지 점은 그림에 찍지 않는다.
import { GenFail } from "../../../types";
import type { Rng } from "../../../rng";
import { statementInst, MC_ONLY_STATEMENT, defineItem } from "../item-kit";
import { makePureIneq, PI_JS, piIntro, piRead, type PureIneq } from "../pure-fn-kit";

type P = [number, number];
const val = (s: PureIneq, p: P) => p[1] - (s.m * p[0] + s.b); // 경계선 기준 위(+)/아래(-)
const isSol = (s: PureIneq, p: P) => { const d = val(s, p); return s.above ? (s.strict ? d > 0 : d >= 0) : (s.strict ? d < 0 : d <= 0); };
const txt = (p: P) => `(${p[0]}, ${p[1]})`;
const JS = `${PI_JS}const sol=(p)=>{const d=p[1]-(m*p[0]+b); return above ? (strict ? d>1e-9 : d>=-1e-9) : (strict ? d<-1e-9 : d<=1e-9);}; const pts=P.options.map(o=>o.match(/-?\\d+/g).map(Number)); const idx=[]; pts.forEach((p,i)=>{ if (sol(p)===!!P.want) idx.push(i); }); if (idx.length!==1) throw new Error('해 판정이 유일하지 않음'); return idx[0];\n`;
/** 경계선에서 d 만큼 떨어진(수직 거리 기준 y 차) 점 — 그림 범위 안, 눈금 격자점. */
const ptAt = (rng: Rng, s: PureIneq, d: number, xs?: number): P => { for (let t = 0; t < 60; t++) { const x = xs ?? rng.int(-s.R + 1, s.R - 1); const y = s.m * x + s.b + d; if (Math.abs(y) <= s.R) return [x, y]; if (xs !== undefined) break; } throw new GenFail("pt"); };
const uniq = (ps: P[]) => new Set(ps.map(txt)).size === ps.length;
const Q = (rng: Rng, want: boolean) => want ? rng.pick(["Which of the following points is a solution to the inequality graphed?", "Which of the following points satisfies the inequality shown in the graph?", "Which point is in the solution set of the inequality shown?"]) : rng.pick(["Which of the following points is NOT a solution to the inequality graphed?", "Which of the following points does not satisfy the inequality shown in the graph?", "Which point is outside the solution set of the inequality shown?"]);
function build(rng: Rng, want: boolean, o: { fixedX?: boolean; fixedY?: boolean } = {}) {
  const s = makePureIneq(rng); const sg = s.above ? 1 : -1; const inD = [sg * 1, sg * 2, sg * 3, sg * 4]; const outD = [-sg * 1, -sg * 2, -sg * 3, -sg * 4];
  let ps: P[] = []; let good: P; const bnd = (): P => ptAt(rng, s, 0);
  if (o.fixedX) { const x = rng.int(-s.R + 2, s.R - 2); const ds = rng.shuffle([...inD, ...outD, 0]).slice(0, 4); ps = ds.map((d) => ptAt(rng, s, d, x)); }
  else if (o.fixedY) { const y = rng.int(-s.R + 2, s.R - 2); ps = []; for (let k = 0; k < 4; k++) { const x = rng.int(-s.R + 1, s.R - 1); ps.push([x, y]); } }
  else { const pool = rng.shuffle([rng.pick(inD), rng.pick(outD), rng.pick(outD), rng.pick(inD), 0]); ps = pool.slice(0, 4).map((d) => ptAt(rng, s, d)); }
  if (!uniq(ps) || ps.some((p) => Math.abs(p[0]) > s.R || Math.abs(p[1]) > s.R)) throw new GenFail("pts");
  const sols = ps.filter((p) => isSol(s, p)); const non = ps.filter((p) => !isSol(s, p));
  if (want ? sols.length !== 1 : non.length !== 1) throw new GenFail("one");
  good = want ? sols[0] : non[0]; const bad = want ? non : sols; void bnd;
  return { s, good, bad };
}
const mk = (rng: Rng, want: boolean, variant: string, trace: (s: PureIneq, good: P) => [string, string][], o: { fixedX?: boolean; fixedY?: boolean } = {}) => {
  const { s, good, bad } = build(rng, want, o);
  return statementInst(rng, { stimulus: piIntro(rng), question: Q(rng, want), correct: txt(good), wrongs: bad.map((p) => ({ text: txt(p), reason: Math.abs(val(s, p)) < 1e-9 ? "경계선 위의 점을 점선·실선 구분 없이 판정했다." : "음영 방향을 반대로 보았다." })), figure: s.fig, P: { want: want ? 1 : 0 }, body: JS, trace: [...piRead(s), ...trace(s, good)], variant });
};
const T1 = (s: PureIneq, g: P): [string, string][] => [[`각 선택지의 점을 경계선 y = ${s.m}x + (${s.b}) 와 비교한다(음영 쪽인지, 경계 포함인지).`, "Compare each point with the boundary line and the shading."], [`조건에 맞는 점은 ${txt(g)} 이다.`, "Pick the matching point."]];

export const ITEM = defineItem({
  prefix: "pisg", itemId: "linear_inequalities.point_in_solution.LN.P",
  hard: [
    { op: "repr_shift", structure: "음영 그래프의 경계선·방향·점선 여부를 읽고 선택지 점 중 해인 점을 고름", extra: "경계선 위의 점이 선택지에 있어 점선·실선을 구분해야 함 — medium 은 경계선에서 먼 점", concepts: ["부등식의 그래프", "점이 해인지 판정"], sprNo: MC_ONLY_STATEMENT, gen: (rng) => mk(rng, true, "pick_solution", T1) },
    { op: "chain2", structure: "음영 그래프에서 선택지 점 중 해가 아닌 점을 고름", extra: "세 점이 해이고 하나만 아님 — 해를 찾는 것과 반대로 판정해야 함", concepts: ["부등식의 그래프", "점이 해인지 판정", "부정 조건"], sprNo: MC_ONLY_STATEMENT, gen: (rng) => mk(rng, false, "pick_non_solution", T1) },
    { op: "compose_kind", structure: "x 좌표가 같은 점 네 개 중 해인 점을 고름(경계선과의 세로 거리 비교)", extra: "같은 x 에서 y 값만 달라 경계선 값 m x + b 를 계산해 비교해야 함", concepts: ["부등식의 그래프", "경계값 계산"], sprNo: MC_ONLY_STATEMENT, gen: (rng) => mk(rng, true, "fixed_x", T1, { fixedX: true }) },
    { op: "constraint_select", structure: "x 좌표가 같은 점 네 개 중 해가 아닌 점을 고름", extra: "경계 포함 여부와 음영 방향을 함께 써서 유일한 비해를 골라야 함", concepts: ["부등식의 그래프", "경계값 계산", "부정 조건"], sprNo: MC_ONLY_STATEMENT, gen: (rng) => mk(rng, false, "fixed_x_non", T1, { fixedX: true }) },
  ],
  em: [
    { lv: "easy", name: "pick_solution_far", structure: "음영 그래프에서 해인 점을 고름(경계선에서 먼 점)", extra: "easy: 음영 안의 점", concepts: ["부등식의 그래프"], sprNo: MC_ONLY_STATEMENT, gen: (rng) => mk(rng, true, "pick_solution_easy", T1) },
    { lv: "medium", name: "pick_non_solution", structure: "음영 그래프에서 해가 아닌 점을 고름", extra: "medium: 부정 조건", concepts: ["부등식의 그래프", "부정 조건"], sprNo: MC_ONLY_STATEMENT, gen: (rng) => mk(rng, false, "pick_non_solution_med", (s, g) => [...T1(s, g), [`나머지 세 점은 모두 해이다.`, "The other three points are solutions."]]) },
  ],
});
