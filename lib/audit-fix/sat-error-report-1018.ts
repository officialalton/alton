// 외부 검수 SAT Practice Test 1 Math 오류 신고(2026-10-18) 수정 패치 생성기 — 순수 함수(DB·네트워크 없음).
// 공개 문항의 현재 버전 한 줄(VersionRow 일부)을 받아, 컴파일러 옛 틀의 문안을 새 컴파일러가 만드는 문안으로 되돌려 쓰는 PatchChange[] 를 만든다.
// 결과는 기존 감사 수정 흐름(lib/audit-fix/plan.ts planPatch → 새 problem_versions)에 그대로 들어간다. 이 파일은 DB 에 쓰지 않는다.
import { CONTEXT_PHRASES } from "../problem-generation/math-compilers/inference-from-sample";
import { barLineNeedsValueLabels, type DataSpec } from "../problem-figures/templates/data";
import { hasGraphAndExpressionForSameCurves } from "../problem-generation/graph-expression-redundancy";

export type SatRow = {
  problem_id?: string; version_id?: string; skill_code?: string | null;
  passage: string | null; question: string | null; options: string[] | null; correct_index: number | null;
  explanation: string | null; explanation_en: string | null; figure: unknown;
};
export type Change = { field: string; old: unknown; new: unknown };
export type RuleResult = { rule: string; status: "patch" | "manual"; why: string; changes: Change[] };

const EVAL_Q = /^What is f\((-?\d+(?:\.\d+)?)\)\?$/;
const FINDX_Q = /^For what value of x does f\(x\) = (-?\d+(?:\.\d+)?)\?$/;

function diff(row: SatRow, next: Partial<Record<keyof SatRow, unknown>>): Change[] {
  const out: Change[] = [];
  for (const [field, value] of Object.entries(next)) {
    const old = (row as Record<string, unknown>)[field];
    if (JSON.stringify(old) !== JSON.stringify(value)) out.push({ field, old, new: value });
  }
  return out;
}

/** 현재 버전 한 건에 적용할 수정 규칙을 찾는다. 해당 없으면 null. 한 문항에 여러 결함이 겹치면 첫 규칙만(문항 하나에 한 번의 새 버전). */
export function planSatErrorReportFix(row: SatRow): RuleResult | null {
  const passage = row.passage ?? "";
  const question = row.question ?? "";
  const fig = row.figure as { type?: string; kind?: string; rows?: unknown[][]; objects?: unknown[] } | null;
  const answer = row.options && row.correct_index != null ? row.options[row.correct_index] : "";

  // (13) sin(angle B) -> sin B
  const trig = question.match(/^What is (sin|cos|tan)\((?:angle )?([A-Z])\) in the right triangle shown\?$/);
  if (trig) {
    const fix = (t: string | null) => (t ? t.replace(/\b(sin|cos|tan)\(([A-Z])\) =/g, "$1 $2 =") : t);
    return { rule: "R13-trig-notation", status: "patch", why: "삼각비 표기를 SAT 관례(sin B)로", changes: diff(row, { question: `What is ${trig[1]} ${trig[2]} in the right triangle shown?`, explanation: fix(row.explanation), explanation_en: fix(row.explanation_en) }) };
  }

  // (14) same characteristic -> 성질 명시
  const inf = passage.match(/^A random sample of (\d+) (residents|students|customers|employees) was surveyed\. Of those surveyed, (\d+) were (.+)\. The population consists of (\d+) total\.( The sample results are also shown in the table below\.)?$/);
  if (inf && CONTEXT_PHRASES[inf[4]] && /same characteristic/.test(question)) {
    const ph = CONTEXT_PHRASES[inf[4]];
    const newPassage = `A random sample of ${inf[1]} ${ph.sample} was surveyed. Of those surveyed, ${inf[3]} ${ph.trait}. The population consists of ${inf[5]} ${ph.population} in total.${inf[6] ?? ""}`;
    const next: Partial<Record<keyof SatRow, unknown>> = { passage: newPassage, question: `Based on the sample, about how many of the ${inf[5]} ${ph.population} would be expected to ${ph.traitInfinitive}?` };
    if (fig?.type === "data" && fig.kind === "table" && Array.isArray(fig.rows)) next.figure = { ...fig, rows: fig.rows.map((r) => (r[0] === "Have this characteristic" ? [`Sampled ${ph.population} who ${ph.trait}`, ...r.slice(1)] : r)) };
    return { rule: "R14-inference-trait", status: "patch", why: "지시어 'same characteristic' 대신 성질을 문장에 직접 명시", changes: diff(row, next) };
  }

  // (7) highest power of x is 2 삭제
  if (/,\s*whose highest power of \$x\$ is 2,/.test(passage)) {
    return { rule: "R7-polynomial-degree", status: "patch", why: "표준형 ax²+bx+c 를 이미 주므로 차수 안내 삭제", changes: diff(row, { passage: passage.replace(/,\s*whose highest power of \$x\$ is 2,/, "") }) };
  }

  // (2) 막대·선그래프 값 라벨
  if (fig?.type === "data" && (fig.kind === "bar" || fig.kind === "line") && barLineNeedsValueLabels(fig as unknown as DataSpec)) {
    return { rule: "R2-chart-value-labels", status: "patch", why: "눈금으로 읽을 수 없는 값이 있어 데이터 라벨을 켠다(렌더러도 자동 처리)", changes: diff(row, { figure: { ...fig, valueLabels: true } }) };
  }

  // (1) 그래프 + 식 중복
  if (fig?.type !== "plane") return null;
  const redundant = hasGraphAndExpressionForSameCurves(fig as never, passage) || /^Consider the graph of the inequality shown\./.test(passage) || /defined by the equation|has center \(/.test(passage);

  const lin = passage.match(/^The function f is defined by .+\. The graph of y = f\(x\) is shown in the xy-plane below\.$/);
  if (lin && !/\$/.test(passage)) {
    const ev = question.match(EVAL_Q), fx = question.match(FINDX_Q);
    if (ev || fx) {
      const ko = ev ? `그래프에서 x = ${ev[1]}일 때의 y값을 읽으면 f(${ev[1]}) = ${answer}이다.` : `그래프에서 y = ${fx![1]}인 점의 x좌표를 읽으면 x = ${answer}이다.`;
      const en = ev ? `Reading the graph at x = ${ev[1]} gives y = ${answer}, so f(${ev[1]}) = ${answer}.` : `On the graph, the point with y = ${fx![1]} has x = ${answer}.`;
      return { rule: "G1-linear-function-graph-only", status: "patch", why: "그래프 읽기: 식 삭제(그래프만 제시)", changes: diff(row, { passage: "The graph of y = f(x) is shown in the xy-plane below.", explanation: ko, explanation_en: en }) };
    }
  }
  if (/^In the xy-plane, line f passes through the points .+ The graph of line f is shown below\.$/.test(passage)) {
    return { rule: "G2-slope-graph-only", status: "patch", why: "그래프 읽기: 두 점 좌표 삭제(그래프만 제시)", changes: diff(row, { passage: "The graph of line f is shown in the xy-plane below." }) };
  }
  const quad = passage.match(/^The function f is defined by (\$f\(x\) = .+\$)\. The graph of y = f\(x\) is shown in the xy-plane below\.$/);
  if (quad) {
    if (EVAL_Q.test(question)) return { rule: "G3-quadratic-evaluate-expression-only", status: "patch", why: "계산 문항: 그래프 삭제(식만 제시)", changes: diff(row, { passage: `The function f is defined by ${quad[1]}.`, figure: null }) };
    const vx = /x-coordinate of the vertex/.test(question), vy = /y-coordinate of the vertex/.test(question);
    if (vx || vy) {
      const ko = `그래프의 꼭짓점을 읽으면 ${vx ? "x" : "y"}좌표는 ${answer}이다.`, en = `Reading the vertex of the graph, its ${vx ? "x" : "y"}-coordinate is ${answer}.`;
      return { rule: "G3-quadratic-vertex-graph-only", status: "patch", why: "그래프 읽기: 식 삭제(그래프만 제시)", changes: diff(row, { passage: "The graph of y = f(x), a parabola, is shown in the xy-plane below.", explanation: ko, explanation_en: en }) };
    }
  }
  const sys = passage.match(/^Consider the system of equations shown\. The graphs of the equations are shown in the xy-plane below\.\n\n\$y = (.+)\$\n\$y = (.+)\$$/);
  if (sys) {
    const q2 = question
      .replace("How many points of intersection do the graphs of the equations shown have?", "How many points of intersection do the two graphs shown have?")
      .replace("of the intersection point of the graphs of the equations shown?", "of the intersection point of the two graphs shown?")
      .replace("of the two intersection points of the graphs of the equations shown?", "of the two intersection points of the graphs shown?");
    const ko = `그래프의 두 곡선은 y = ${sys[1].replace("x^2", "x²")}, y = ${sys[2]}이다. ` + (row.explanation ?? "");
    const en = `The two graphs are y = ${sys[1].replace("x^2", "x²")} and y = ${sys[2]}. ` + (row.explanation_en ?? "");
    return { rule: "G4-intersection-graph-only", status: "patch", why: "그래프 읽기: 식 삭제(그래프만 제시)", changes: diff(row, { passage: "The graphs of a quadratic function and a linear function are shown in the xy-plane below.", question: q2, explanation: ko, explanation_en: en }) };
  }
  if (/^(Consider the system of equations shown\.|The solution to the system of equations shown is \(x, y\)\.)\n\n[^\n]+\n[^\n]+$/.test(passage)) {
    return { rule: "G5-system-expression-only", status: "patch", why: "계산 문항: 같은 두 직선의 그래프 삭제(식만 제시)", changes: diff(row, { figure: null }) };
  }
  if (/^Consider the graph of the inequality shown\.\n\n/.test(passage)) {
    return { rule: "G6-inequality-expression-only", status: "patch", why: "계산 문항: 같은 부등식의 그래프 삭제(식만 제시)", changes: diff(row, { passage: passage.replace("Consider the graph of the inequality shown.", "Consider the inequality shown."), figure: null }) };
  }
  let m: RegExpMatchArray | null;
  if ((m = passage.match(/^A circle in the xy-plane is defined by the equation .+\. The circle is shifted (.+)\. The circle is shown in the xy-plane below\.$/))) {
    return { rule: "G7-circle-graph-only", status: "patch", why: "그래프 읽기: 방정식 삭제(그래프만 제시)", changes: diff(row, { passage: `The circle shown in the xy-plane below is shifted ${m[1]}.` }) };
  }
  if (/^A circle in the xy-plane is defined by the equation .+\. The circle is shown in the xy-plane below\.$/.test(passage) || /^A circle in the xy-plane has center \(.+\) and radius .+\. The circle is shown in the xy-plane below\.$/.test(passage)) {
    return { rule: "G7-circle-graph-only", status: "patch", why: "그래프 읽기: 방정식·중심·반지름 삭제(그래프만 제시)", changes: diff(row, { passage: "A circle is shown in the xy-plane below." }) };
  }
  if (!redundant) return null;
  return { rule: "G-manual", status: "manual", why: "그래프와 식을 둘 다 주지만 컴파일러 옛 틀이 아니라 자동 패치 불가 — 같은 skill·난이도의 새 문항으로 교체하거나 한 표현만 남기도록 손으로 재설계", changes: [] };
}
