// linear_inequalities.table_verification.TB.C — 지문의 부등식(또는 연립부등식)을 모든 행이 만족하는 (x, y) 값표를 4개 중에서 고른다.
// 오답 규칙: IN1_reversed(부등호 방향 반대 — 모든 행이 첫 부등식의 반대쪽), IN2_boundary(경계 포함/제외 혼동 — 한 행이 엄격 부등식의 경계 위),
//            IN3_one_row(한 행만 확인하지 않음 — 한 행이 반대쪽), IN4_swap_xy(x 와 y 를 바꿔 대입 — 정답 표의 두 열 교환).
import { GenFail, type Instance } from "../../../types";
import type { Rng } from "../../../rng";
import { choiceInst } from "../../tvd-fig-choice";
import { defineItem } from "../item-kit";
import { SPR_NO_TABLE, tableChoices, type Rows } from "./_t8-kit";

type Op = "<" | "<=" | ">" | ">=";
type K = { a: number; b: number; c: number; op: Op };
const val = (k: K, x: number, y: number) => k.a * x + k.b * y - k.c;
const sat = (k: K, x: number, y: number) => { const v = val(k, x, y); return k.op === "<" ? v < 0 : k.op === "<=" ? v <= 0 : k.op === ">" ? v > 0 : v >= 0; };
const opp = (k: K, x: number, y: number) => { const v = val(k, x, y); return k.op[0] === "<" ? v > 0 : v < 0; };
const allSat = (ks: K[], x: number, y: number) => ks.every((k) => sat(k, x, y));
const enc = (ks: K[]) => ks.map((k) => `${k.a},${k.b},${k.c},${k.op}`).join(";");
const TEX: Record<Op, string> = { "<": "<", "<=": "\\le", ">": ">", ">=": "\\ge" };
const KO: Record<Op, string> = { "<": "보다 작다", "<=": "이하이다", ">": "보다 크다", ">=": "이상이다" };

const K_JS = `const K = String(P.K).split(";").map((s) => { const q = s.split(","); return { a: +q[0], b: +q[1], c: +q[2], op: q[3] }; });
const val = (k, x, y) => k.a * x + k.b * y - k.c;
const sat = (k, x, y) => { const v = val(k, x, y); return k.op === "<" ? v < 0 : k.op === "<=" ? v <= 0 : k.op === ">" ? v > 0 : v >= 0; };
const opp = (k, x, y) => { const v = val(k, x, y); return k.op[0] === "<" ? v > 0 : v < 0; };`;
const PRED = `${K_JS}\nconst R = c.rows; if (!R.length || R.some((r) => r.length !== 2)) throw new Error('표 형식'); return R.every((r) => K.every((k) => sat(k, r[0], r[1])));`;
const DIAG = `${K_JS}
const R = c.rows, O = ok.rows; const eq = (u, v) => JSON.stringify(u) === JSON.stringify(v);
if (eq(R, O.map((r) => [r[1], r[0]]))) return "IN4_swap_xy";
if (R.every((r) => opp(K[0], r[0], r[1]))) return "IN1_reversed";
const bad = R.filter((r) => !K.every((k) => sat(k, r[0], r[1])));
if (bad.length === 1) { const r = bad[0]; return K.every((k) => sat(k, r[0], r[1]) || val(k, r[0], r[1]) === 0) ? "IN2_boundary" : "IN3_one_row"; }
return null;`;

type Scene = { ks: K[]; xs: number[]; ylo: number; yhi: number; cols: [string, string] };
/** 정답 표: 각 x 에서 모든 부등식을 만족하는 y. 한 행은 경계에 가장 가까운 y(경계 포함이면 경계 위)로 둔다. */
function okRows(rng: Rng, s: Scene): Rows {
  const tight = rng.int(0, s.xs.length - 1);
  return s.xs.map((x, i) => {
    const ys: number[] = []; for (let y = s.ylo; y <= s.yhi; y++) if (allSat(s.ks, x, y)) ys.push(y);
    if (ys.length < 2) throw new GenFail("가능한 y 부족");
    if (i !== tight) return [x, rng.pick(ys)];
    const best = ys.reduce((p, q) => (Math.min(...s.ks.map((k) => Math.abs(val(k, x, q)))) < Math.min(...s.ks.map((k) => Math.abs(val(k, x, p)))) ? q : p));
    return [x, best];
  });
}
function wrongCands(rng: Rng, s: Scene, ok: Rows) {
  const k0 = s.ks[0]; const range: number[] = []; for (let y = s.ylo; y <= s.yhi; y++) range.push(y);
  const rev = s.xs.map((x) => { const ys = range.filter((y) => opp(k0, x, y)); return ys.length ? [x, rng.pick(ys)] : null; });
  const out: { rule: string; rows: Rows | null }[] = [{ rule: "IN1_reversed", rows: rev.every(Boolean) ? (rev as Rows) : null }, { rule: "IN4_swap_xy", rows: ok.map((r) => [r[1], r[0]]) }];
  const i = rng.int(0, ok.length - 1); const x = ok[i][0];
  const bnd = range.filter((y) => !allSat(s.ks, x, y) && s.ks.every((k) => sat(k, x, y) || val(k, x, y) === 0));
  out.push({ rule: "IN2_boundary", rows: bnd.length ? ok.map((r, j) => (j === i ? [x, bnd[0]] : [...r])) : null });
  const j3 = (i + 1 + rng.int(0, ok.length - 2)) % ok.length; const x3 = ok[j3][0];
  const one = range.filter((y) => !allSat(s.ks, x3, y) && s.ks.some((k) => !sat(k, x3, y) && val(k, x3, y) !== 0) && Math.min(...s.ks.map((k) => Math.abs(val(k, x3, y)))) <= Math.max(6, Math.abs(k0.b) * 4));
  out.push({ rule: "IN3_one_row", rows: one.length ? ok.map((r, j) => (j === j3 ? [x3, rng.pick(one)] : [...r])) : null });
  return out;
}
function build(rng: Rng, s: Scene, d: { stimulus: string; question: string; P: Record<string, number | string>; trace: [string, string][]; variant: string }): Instance {
  const ok = okRows(rng, s); const P = { ...d.P, K: enc(s.ks) };
  const { choices, correctIndex, rules } = tableChoices(rng, { cols: s.cols, ok, cands: wrongCands(rng, s, ok), P, predicateJs: PRED, diagnoseJs: DIAG });
  const tr: [string, string][] = [...d.trace, [`정답 표의 각 행 ${ok.map((r) => `(${r[0]}, ${r[1]})`).join(", ")} 은 모두 조건을 만족한다.`, "Every row of the correct table satisfies the condition."], [`다른 표는 부등호 방향·경계·한 행·x 와 y 의 순서 중 하나가 어긋난다.`, "Each other table fails in exactly one way."]];
  return choiceInst(rng, { stimulus: d.stimulus, question: d.question, choices, correctIndex, rules, P, predicateJs: PRED, diagnoseJs: DIAG, trace: tr, variant: d.variant, explainKo: "", explainEn: "" });
}
const pickXs = (rng: Rng, lo: number, hi: number, n: number) => rng.shuffle(Array.from({ length: hi - lo + 1 }, (_, i) => lo + i)).slice(0, n).sort((p, q) => p - q);
const lin = (m: number, b: number, v = "x") => `${m === 1 ? "" : m === -1 ? "-" : m}${v}${b === 0 ? "" : b > 0 ? ` + ${b}` : ` - ${-b}`}`;
const Q_ALL = (X: string, Y: string) => [`Which table gives values of $${X}$ and their corresponding values of $${Y}$ that are all solutions to the inequality?`, `Which of the following tables shows only pairs $(${X}, ${Y})$ that satisfy the inequality?`, `In which table is every pair $(${X}, ${Y})$ a solution to the inequality?`];
const Q_SYS = (X: string, Y: string) => [`Which table gives values of $${X}$ and their corresponding values of $${Y}$ that are all solutions to the system?`, `In which table is every pair $(${X}, ${Y})$ a solution to the system of inequalities?`, `Which of the following tables shows only pairs $(${X}, ${Y})$ that satisfy both inequalities?`];
const VARS: [string, string][] = [["x", "y"], ["a", "b"], ["m", "n"], ["p", "q"], ["s", "t"], ["u", "v"], ["h", "k"], ["c", "d"], ["r", "w"]];
const vp = (rng: Rng) => rng.pick(VARS);
const INTRO = ["Consider the inequality shown.", "An inequality is given above.", "The inequality shown relates two variables.", "Pairs of values are tested against the inequality shown.", "A linear inequality in two variables is shown."];

const BUY = [
  { who: "A student is buying", a: "notebooks", b: "pens", pa: [3, 4, 5, 6], pb: [1, 2] },
  { who: "A bakery is ordering", a: "bags of flour", b: "bags of sugar", pa: [8, 9, 12], pb: [3, 4, 5] },
  { who: "A coach is buying", a: "soccer balls", b: "water bottles", pa: [12, 15, 18], pb: [4, 5, 6] },
  { who: "A gardener is buying", a: "rose bushes", b: "tulip bulbs", pa: [7, 9, 11], pb: [2, 3] },
  { who: "A teacher is buying", a: "puzzle sets", b: "markers", pa: [6, 8, 10], pb: [1, 2, 3] },
  { who: "A café is stocking", a: "cases of juice", b: "cartons of milk", pa: [10, 14, 16], pb: [3, 4] },
];
const WORDS: [Op, string][] = [["<=", "at most"], ["<", "less than"], [">=", "at least"], [">", "more than"]];
const UNITS = [
  { big: "hours", sg: "hour", small: "minutes", per: 60, what: "practicing piano", who: "A musician" },
  { big: "feet", sg: "foot", small: "inches", per: 12, what: "of ribbon", who: "A crafter" },
  { big: "gallons", sg: "gallon", small: "quarts", per: 4, what: "of water", who: "A camper" },
  { big: "pounds", sg: "pound", small: "ounces", per: 16, what: "of clay", who: "A potter" },
  { big: "minutes", sg: "minute", small: "seconds", per: 60, what: "warming up", who: "A runner" },
];

export const ITEM = defineItem({
  prefix: "li", itemId: "linear_inequalities.table_verification.TB.C",
  hard: [
    {
      op: "repr_shift", sprNo: SPR_NO_TABLE, structure: "가격·예산 문장을 일차부등식 px + qy (≤,<,≥,>) B 로 번역하고, 모든 행이 이를 만족하는 (x, y) 표를 4개 중에서 고름", extra: "문장(가격·예산·비교어)을 부등식으로 번역한 뒤 네 표의 모든 행을 대입해 방향·경계를 구별해야 함 — medium 은 부등식이 식으로 주어짐",
      concepts: ["문장→일차부등식", "부등식의 해 확인", "값표 비교"],
      gen(rng) {
        const [X, Y] = vp(rng);
        const t = rng.pick(BUY); const p = rng.pick(t.pa), q = rng.pick(t.pb); const [op, w] = rng.pick(WORDS); const B = rng.int(4, 12) * p;
        const xmax = Math.floor(B / p) + 2; const s: Scene = { ks: [{ a: p, b: q, c: B, op }], xs: pickXs(rng, 0, Math.min(xmax, 12), 3), ylo: 0, yhi: Math.ceil(B / q) + 6, cols: [X, Y] };
        return build(rng, s, {
          stimulus: `${t.who} $${X}$ ${t.a} that cost ${p} dollars each and $${Y}$ ${t.b} that cost ${q} dollars each. The total cost must be ${w} ${B} dollars.`,
          question: rng.pick([`Which table gives values of $${X}$ and their corresponding values of $${Y}$ that meet this condition?`, `In which table does every pair $(${X}, ${Y})$ satisfy this condition?`]), P: { p, q, B },
          trace: [[`총비용은 ${p}x + ${q}y 이다.`, "Write the total cost."], [`'${w}' 이므로 ${p}x + ${q}y ${op} ${B} 이다.`, "Translate the comparison word into an inequality sign."], [`각 표의 행마다 ${p}x + ${q}y 를 계산해 ${B} 와 비교한다.`, "Substitute each row."]], variant: `budget_${op}`,
        });
      },
    },
    {
      op: "inverse", sprNo: SPR_NO_TABLE, structure: "해 영역의 경계선이 지나는 두 점과 해가 있는 쪽·경계 포함 여부를 주고, 부등식을 먼저 세운 뒤 표를 고름", extra: "두 점에서 경계선 식(기울기·절편)을 역으로 구하고 위/아래·포함 여부를 부등호로 바꾼 뒤 표를 검사 — medium 은 부등식이 직접 주어짐",
      concepts: ["두 점으로 직선의 식", "부등식의 영역", "경계 포함 여부"],
      gen(rng) {
        const [X, Y] = vp(rng);
        const m = rng.nz(-4, 4), b = rng.int(-6, 12); const x1 = rng.int(-3, 1), x2 = x1 + rng.int(2, 5); const above = rng.chance(0.5), incl = rng.chance(0.5);
        const op: Op = above ? (incl ? ">=" : ">") : incl ? "<=" : "<";
        const s: Scene = { ks: [{ a: -m, b: 1, c: b, op }], xs: pickXs(rng, -4, 6, 3), ylo: -30, yhi: 40, cols: [X, Y] };
        return build(rng, s, {
          stimulus: rng.pick([
            `In the coordinate plane with horizontal axis $${X}$ and vertical axis $${Y}$, the boundary line of the solutions to an inequality passes through the points $(${x1}, ${m * x1 + b})$ and $(${x2}, ${m * x2 + b})$. The solutions are the points ${above ? "above" : "below"} this line${incl ? ", and points on the line are also solutions" : ", and points on the line are not solutions"}.`,
            `The solution region of a linear inequality in $${X}$ and $${Y}$ is bounded by the line through $(${x1}, ${m * x1 + b})$ and $(${x2}, ${m * x2 + b})$. Every point lying ${above ? "above" : "below"} that line is a solution, ${incl ? "and so is every point on the line" : "but no point on the line is a solution"}.`,
            `A line through $(${x1}, ${m * x1 + b})$ and $(${x2}, ${m * x2 + b})$ separates the solutions of an inequality in $${X}$ and $${Y}$ from the non-solutions. Solutions lie on the side where $${Y}$ is ${above ? "greater" : "smaller"} than on the line, and the line itself is ${incl ? "included" : "excluded"}.`,
            `Points $(${x1}, ${m * x1 + b})$ and $(${x2}, ${m * x2 + b})$ both lie on the boundary of the solution set of an inequality in $${X}$ and $${Y}$. A point is a solution exactly when it is ${above ? "above" : "below"} that boundary${incl ? " or on it" : " and not on it"}.`,
          ]),
          question: rng.pick([`Which table gives values of $${X}$ and their corresponding values of $${Y}$ that are all solutions to this inequality?`, `In which table is every pair $(${X}, ${Y})$ a solution to this inequality?`]), P: { x1, x2, y1: m * x1 + b, y2: m * x2 + b },
          trace: [[`기울기 = (${m * x2 + b} - (${m * x1 + b})) ÷ (${x2} - (${x1})) = ${m} 이다.`, "Slope from the two points."], [`y 절편: ${m * x1 + b} - ${m}·(${x1}) = ${b} 이므로 경계선은 y = ${lin(m, b)} 이다.`, "Intercept of the boundary line."], [`${above ? "위쪽" : "아래쪽"}${incl ? "(경계 포함)" : "(경계 제외)"} 이므로 y ${op} ${lin(m, b)} 이다.`, "Turn the side and the boundary rule into an inequality."]], variant: `boundary_from_points_${op}`,
        });
      },
    },
    {
      op: "chain2", sprNo: SPR_NO_TABLE, structure: "두 일차부등식의 연립에서 모든 행이 두 부등식을 동시에 만족하는 (x, y) 표를 고름", extra: "행마다 두 부등식을 차례로 검사해야 함(첫 부등식만 맞는 표·경계 행이 함정) — medium 은 부등식 하나",
      concepts: ["연립일차부등식", "부등식의 해 확인", "값표 비교"],
      gen(rng) {
        const [X, Y] = vp(rng);
        const m1 = rng.nz(-3, 3), m2 = rng.nz(-3, 3); if (m1 === m2) throw new GenFail("평행"); const b1 = rng.int(-8, 4), b2 = b1 + rng.int(8, 18);
        const o1: Op = rng.pick([">", ">="]), o2: Op = rng.pick(["<", "<="]);
        const xs = pickXs(rng, -3, 5, 3); if (xs.some((x) => m2 * x + b2 - (m1 * x + b1) < 3)) throw new GenFail("폭");
        const s: Scene = { ks: [{ a: -m1, b: 1, c: b1, op: o1 }, { a: -m2, b: 1, c: b2, op: o2 }], xs, ylo: -30, yhi: 40, cols: [X, Y] };
        return build(rng, s, {
          stimulus: `$$${Y} ${TEX[o1]} ${lin(m1, b1, X)}$$ $$${Y} ${TEX[o2]} ${lin(m2, b2, X)}$$ ${rng.pick(["Consider the system of inequalities shown.", "The system of inequalities above is given.", "A system of two inequalities is shown."])}`,
          question: rng.pick(Q_SYS(X, Y)), P: { m1, b1, m2, b2 },
          trace: [[`첫 부등식: y 는 ${lin(m1, b1)} ${KO[o1]}.`, "First condition."], [`둘째 부등식: y 는 ${lin(m2, b2)} ${KO[o2]}.`, "Second condition."], [`각 행에서 두 경계값을 계산해 y 가 그 사이(경계 규칙 포함)에 있는지 확인한다.`, "Check both conditions for every row."]], variant: `system_${o1}_${o2}`,
        });
      },
    },
    {
      op: "unit_ratio", sprNo: SPR_NO_TABLE, structure: "x 는 큰 단위, y 는 작은 단위로 잰 두 양의 합에 대한 조건(큰 단위로 표현)을 부등식 per·x + y (≤,<,≥,>) per·T 로 바꿔 표를 고름", extra: "단위를 통일(큰 단위 → 작은 단위 환산)해야 부등식이 서고, 환산 없이 x + y 와 T 를 비교하면 틀림 — medium 은 단위가 같음",
      concepts: ["단위 환산", "문장→일차부등식", "부등식의 해 확인"],
      gen(rng) {
        const [X, Y] = vp(rng);
        const u = rng.pick(UNITS); const T = rng.int(2, 6); const [op, w] = rng.pick(WORDS); const c = u.per * T;
        const s: Scene = { ks: [{ a: u.per, b: 1, c, op }], xs: pickXs(rng, 0, T - 1, 3), ylo: 0, yhi: c + u.per, cols: [X, Y] };
        return build(rng, s, {
          stimulus: `${u.who} records $${X}$ ${u.big} and $${Y}$ ${u.small} ${u.what}. The total amount must be ${w} ${T} ${u.big}. (1 ${u.sg} = ${u.per} ${u.small})`,
          question: rng.pick([`Which table gives values of $${X}$ and their corresponding values of $${Y}$ that meet this condition?`, `In which table does every pair $(${X}, ${Y})$ meet this condition?`]), P: { per: u.per, T },
          trace: [[`작은 단위로 통일하면 전체는 ${u.per}x + y ${u.small} 이다.`, "Convert to the smaller unit."], [`${T} ${u.big} = ${c} ${u.small} 이다.`, "Convert the limit."], [`'${w}' 이므로 ${u.per}x + y ${op} ${c} 이다.`, "Write the inequality."]], variant: `unit_sum_${op}`,
        });
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "slope_form", sprNo: SPR_NO_TABLE, structure: "y > mx + b 꼴 부등식을 모든 행이 만족하는 표를 고름", extra: "easy: 각 행을 식에 대입", concepts: ["부등식의 해 확인", "값표"],
      gen(rng) {
        const [X, Y] = vp(rng);
        const m = rng.nz(-3, 4), b = rng.int(-5, 9); const op: Op = rng.pick(["<", "<=", ">", ">="]);
        const s: Scene = { ks: [{ a: -m, b: 1, c: b, op }], xs: pickXs(rng, -2, 5, 3), ylo: -20, yhi: 30, cols: [X, Y] };
        return build(rng, s, { stimulus: `$$${Y} ${TEX[op]} ${lin(m, b, X)}$$ ${rng.pick(INTRO)}`, question: rng.pick(Q_ALL(X, Y)), P: { m, b }, trace: [[`각 행의 x 로 ${lin(m, b)} 를 계산한다.`, "Evaluate the right side."], [`y 가 그 값${KO[op]}고 할 수 있는지 확인한다.`, "Compare with y."]], variant: `slope_form_${op}` });
      },
    },
    {
      lv: "medium", name: "standard_form", sprNo: SPR_NO_TABLE, structure: "ax + by (≤,<,≥,>) c 꼴 부등식을 모든 행이 만족하는 표를 고름", extra: "medium: 두 항을 계산해 합을 c 와 비교", concepts: ["부등식의 해 확인", "값표"],
      gen(rng) {
        const [X, Y] = vp(rng);
        let a = 0, b = 0, c = 0, op: Op = "<", s: Scene | null = null;
        for (let t = 0; t < 200; t++) {
          a = rng.int(2, 6); b = rng.int(2, 5); c = rng.int(10, 40); op = rng.pick(["<", "<=", ">", ">="]);
          const cand: Scene = { ks: [{ a, b, c, op }], xs: pickXs(rng, 0, Math.ceil(c / a) + 1, 3), ylo: 0, yhi: Math.ceil(c / b) + 6, cols: [X, Y] };
          if (cand.xs.every((x) => { let n = 0; for (let y = cand.ylo; y <= cand.yhi; y++) if (allSat(cand.ks, x, y)) n++; return n >= 2; })) { s = cand; break; }
        }
        if (!s) throw new GenFail("가능한 y 부족");
        return build(rng, s, { stimulus: `$$${a}${X} + ${b}${Y} ${TEX[op]} ${c}$$ ${rng.pick(INTRO)}`, question: rng.pick(Q_ALL(X, Y)), P: { a, b, c }, trace: [[`각 행에서 ${a}x + ${b}y 를 계산한다.`, "Compute the left side."], [`그 값이 ${c} ${KO[op]}고 할 수 있는지 확인한다.`, "Compare with the constant."], [`경계(같은 경우)의 포함 여부도 확인한다.`, "Check the boundary rule."]], variant: `standard_form_${op}` });
      },
    },
  ],
});
