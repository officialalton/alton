// 표 선택형 부등식 문항(S-M28)의 해설을 "실제 표 데이터에서 계산한 값"으로 만든다. 순수 함수(DB·네트워크 없음).
// 기존 해설은 템플릿(식 값이 하나도 없고 "다른 표는 정확히 한 군데만 어긋난다"는 근거 없는 문장)이었다. 여기서는 모든 표의 모든 행을 계산해 어긋난 행을 그대로 적고,
// 정답 표가 정확히 하나가 아니면 예외를 던진다(키 검증을 겸한다).
export type Op = "<" | "<=" | ">" | ">=";
export type TableSpec =
  | { kind: "sum"; a: number; b: number; op: Op; c: number; xv: string; yv: string; ineq: string }
  | { kind: "yexpr"; m: number; k: number; op: Op; xv: string; yv: string; ineq: string };
export type Row = [number, number];

const cmp = (l: number, op: Op, r: number) => (op === "<" ? l < r : op === "<=" ? l <= r : op === ">" ? l > r : l >= r);
const OP_EN: Record<Op, string> = { "<": "less than", "<=": "at most", ">": "greater than", ">=": "at least" };
const OP_KO: Record<Op, string> = { "<": "보다 작아야", "<=": "이하여야", ">": "보다 커야", ">=": "이상이어야" };
const n = (v: number) => (v < 0 ? `(${v})` : String(v));

export type RowEval = { row: Row; shown: string; ok: boolean };
export function evalRow(spec: TableSpec, [x, y]: Row): RowEval {
  if (spec.kind === "sum") {
    const val = spec.a * x + spec.b * y;
    return { row: [x, y], shown: `${spec.a} \\cdot ${n(x)} + ${spec.b} \\cdot ${n(y)} = ${val}`, ok: cmp(val, spec.op, spec.c) };
  }
  const e = spec.m * x + spec.k;
  return { row: [x, y], shown: `${spec.yv} = ${y}, ${spec.m} \\cdot ${n(x)} ${spec.k < 0 ? "-" : "+"} ${Math.abs(spec.k)} = ${e}`, ok: cmp(y, spec.op, e) };
}

export function evalTables(spec: TableSpec, tables: Row[][]) {
  return tables.map((rows) => rows.map((r) => evalRow(spec, r)));
}

export type TableExplanation = { ko: string; en: string; correctIndex: number };
export function tableExplanations(spec: TableSpec, tables: Row[][], expectedIndex?: number): TableExplanation {
  const ev = evalTables(spec, tables);
  const good = ev.map((rows, i) => (rows.every((r) => r.ok) ? i : -1)).filter((i) => i >= 0);
  if (good.length !== 1) throw new Error(`exactly one table must satisfy every row, got ${good.length} (${spec.ineq})`);
  const ci = good[0];
  if (expectedIndex !== undefined && ci !== expectedIndex) throw new Error(`computed correct table ${"ABCD"[ci]} differs from the key ${"ABCD"[expectedIndex]} (${spec.ineq})`);
  const L = "ABCD";
  const rel = spec.kind === "sum" ? `${OP_EN[spec.op]} ${spec.c}` : `${OP_EN[spec.op]} the expression`;
  const relKo = spec.kind === "sum" ? `${spec.c}${OP_KO[spec.op]}` : `식의 값${OP_KO[spec.op]}`;
  const pair = (r: Row) => `(${r[0]}, ${r[1]})`;
  const enParts = ev.map((rows, i) => `Table ${L[i]}: ${rows.map((r) => `$${pair(r.row)}$ gives $${r.shown}$ (${r.ok ? "works" : "fails"})`).join("; ")}.`);
  const koParts = ev.map((rows, i) => `표 ${L[i]}: ${rows.map((r) => `$${pair(r.row)}$ 에서 $${r.shown}$ (${r.ok ? "성립" : "불성립"})`).join("; ")}.`);
  const en = `A table is correct only if every one of its rows satisfies $${spec.ineq}$, that is, the left-hand quantity must be ${rel}. Checking each row: ${enParts.join(" ")} Only table ${L[ci]} has all three rows satisfying the inequality, so the answer is ${L[ci]}.`;
  const ko = `표가 정답이려면 모든 행이 부등식 $${spec.ineq}$ 를 만족해야 한다. 즉 좌변의 값이 ${relKo} 한다. 각 행을 대입하면 다음과 같다. ${koParts.join(" ")} 세 행이 모두 성립하는 표는 ${L[ci]} 하나뿐이므로 정답은 ${L[ci]}이다.`;
  return { ko, en, correctIndex: ci };
}
