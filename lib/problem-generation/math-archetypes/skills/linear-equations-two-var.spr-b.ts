// linear_equations_two_var — SPR 독립 그룹 보강(G10): 이원일차방정식 응용 hard 원형 4개(변형 1개씩 = 유사문항 그룹 4개).
import { GenFail, T, W, multi, type VFn } from "../spr-groups-b-kit";
import { spin, withParams, M } from "../text";
import { gcd } from "../rng";

const SKILL = "linear_equations_two_var", KIND = "line_applications";

const AREA: Record<string, VFn> = {
  triangle_area_with_axes: (rng) => {
    const a = rng.int(1, 6), b = rng.int(1, 6), cx = rng.int(2, 9), c = cx * a * b / gcd(a, b); const xi = c / a, yi = c / b; if (!Number.isInteger(xi) || !Number.isInteger(yi) || a === b || (xi * yi) % 2 !== 0 || xi * yi / 2 > 300) throw new GenFail("x"); const ans = (xi * yi) / 2;
    return {
      stimulus: spin(rng, `The graph of ${M(`${a === 1 ? "" : a}x + ${b === 1 ? "" : b}y = ${c}`)} in the xy-plane crosses the x-axis and the y-axis. Together with the origin, the two crossing points are the vertices of a triangle.`),
      question: spin(rng, `[[What is the area of this triangle, in square units?|Find the area, in square units, of the triangle formed by the two intercepts and the origin.]]`), correct: ans,
      wrongs: [W(xi * yi, "formula_misuse", "1/2 를 곱하지 않았다."), W(xi + yi, "formula_misuse", "절편의 합을 답했다."), W(Math.round((c * c) / (a + b)) || 1, "formula_misuse", "계수의 합으로 계산했다."), W(Math.round(xi * yi / 2) + a, "other", "계산 실수."), W(Math.round((a * b * c) / 2) || 1, "formula_misuse", "계수를 곱했다.")],
      verificationJs: withParams({ a, b, c }, "let xi=null, yi=null; for(let x=0;x<=500;x++){ if(P.a*x===P.c) xi=x; } for(let y=0;y<=500;y++){ if(P.b*y===P.c) yi=y; }\nif(xi===null||yi===null) throw new Error('절편 없음'); return xi*yi/2;"),
      trace: [T(`y = 0 을 대입하면 x 절편은 ${c}/${a} = ${xi} 이다.`, "x-intercept."), T(`x = 0 을 대입하면 y 절편은 ${c}/${b} = ${yi} 이다.`, "y-intercept."), T("두 절편과 원점은 직각삼각형을 이룬다.", "The triangle is right-angled at the origin."), T(`밑변은 ${xi}, 높이는 ${yi} 이다.`, "Base and height."), T(`넓이 = ${xi} × ${yi} ÷ 2 = ${ans} 이다.`, "Area.")],
    };
  },
};
const DIST: Record<string, VFn> = {
  intercept_distance: (rng) => {
    const [p, q, h] = rng.pick([[3, 4, 5], [6, 8, 10], [5, 12, 13], [8, 6, 10], [12, 5, 13], [9, 12, 15], [15, 8, 17]] as const); const a = rng.pick([2, 3, 4, 5]), b = rng.pick([2, 3, 4, 6]); if (a === b) throw new GenFail("x"); const c = a * p * (b * q) / gcd(a * p, b * q); const xi = c / a, yi = c / b; if (!Number.isInteger(xi) || !Number.isInteger(yi) || xi * xi + yi * yi !== Math.pow(Math.round(Math.sqrt(xi * xi + yi * yi)), 2) || c > 300) throw new GenFail("x"); const dist = Math.round(Math.sqrt(xi * xi + yi * yi));
    return {
      stimulus: spin(rng, `The line ${M(`${a}x + ${b}y = ${c}`)} crosses the x-axis at point P and the y-axis at point Q.`),
      question: spin(rng, `[[What is the distance between P and Q?|How far apart are the points P and Q, in units?]]`), correct: dist,
      wrongs: [W(xi + yi, "formula_misuse", "두 절편의 합을 답했다."), W(Math.abs(xi - yi), "formula_misuse", "두 절편의 차를 답했다."), W(xi, "step_missing", "x 절편만 답했다."), W(yi, "step_missing", "y 절편만 답했다."), W(dist + 1, "other", "계산 실수.")],
      verificationJs: withParams({ a, b, c }, "const xi=P.c/P.a, yi=P.c/P.b; const d=Math.sqrt(xi*xi+yi*yi);\nif(Math.abs(d-Math.round(d))>1e-9) throw new Error('정수 아님'); return Math.round(d);"),
      trace: [T(`x 절편: y = 0 이면 x = ${c}/${a} = ${xi} 이므로 P = (${xi}, 0) 이다.`, "Find P."), T(`y 절편: x = 0 이면 y = ${c}/${b} = ${yi} 이므로 Q = (0, ${yi}) 이다.`, "Find Q."), T(`거리 공식에서 PQ² = ${xi}² + ${yi}² = ${xi * xi + yi * yi} 이다.`, "Distance formula."), T("원점, P, Q 는 직각삼각형을 이룬다.", "Right triangle with the origin."), T(`PQ = ${dist} 이다.`, "Answer.")],
    };
  },
};
const LATT: Record<string, VFn> = {
  lattice_positive_solution_count: (rng) => {
    const a = rng.int(3, 9), b = rng.int(2, 8), c = rng.int(40, 140); if (a === b || gcd(a, b) !== 1) throw new GenFail("x"); let cnt = 0; for (let x = 1; x <= 200; x++) for (let y = 1; y <= 200; y++) if (a * x + b * y === c) cnt++; if (cnt < 3 || cnt > 14) throw new GenFail("x");
    const [i1, i2] = rng.pick([["adult tickets", "child tickets"], ["large pizzas", "small pizzas"], ["notebooks", "folders"], ["bus rides", "train rides"]]);
    return {
      stimulus: spin(rng, `A group spends exactly ${c} dollars on ${i1} that cost ${a} dollars each and ${i2} that cost ${b} dollars each, and it buys at least one of each kind. The equation ${M(`${a}x + ${b}y = ${c}`)} describes the purchase, where x and y are the numbers bought.`),
      question: spin(rng, `[[How many different combinations of ${i1} and ${i2} are possible?|In how many different ways can the group buy at least one of each?]]`), correct: cnt,
      wrongs: [W(cnt + 1, "other", "x 또는 y 가 0 인 경우를 포함했다."), W(Math.max(1, cnt - 1), "other", "경계 경우를 빠뜨렸다."), W(Math.floor(c / a), "step_missing", "첫 물건만으로 가능한 개수를 답했다."), W(Math.floor(c / b), "step_missing", "둘째 물건만으로 가능한 개수를 답했다."), W(Math.floor(c / (a + b)), "formula_misuse", "한 쌍의 가격으로 나눴다.")].filter((w) => w.v !== cnt),
      verificationJs: withParams({ a, b, c }, "let n=0; for(let x=1;x<=500;x++){ for(let y=1;y<=500;y++){ if(P.a*x+P.b*y===P.c) n++; } }\nreturn n;"),
      trace: [T(`${a}x + ${b}y = ${c} 에서 x, y 는 모두 1 이상의 정수이다.`, "Both unknowns are positive integers."), T(`y = (${c} − ${a}x)/${b} 이므로 ${c} − ${a}x 가 ${b} 의 배수여야 한다.`, "Divisibility condition."), T(`${c} − ${a}x > 0 이므로 x ≤ ${Math.floor((c - 1) / a)} 이다.`, "Upper bound on x."), T("조건을 만족하는 x 를 하나씩 확인한다.", "Check each x."), T(`가능한 쌍은 ${cnt} 개이다.`, "Count.")],
    };
  },
};
const MAXI: Record<string, VFn> = {
  max_first_item_exact_budget: (rng) => {
    const a = rng.int(2, 6), b = rng.int(5, 12), c = rng.int(40, 120); if (a === b) throw new GenFail("x"); let best = -1; for (let x = 0; x <= 200; x++) { const rem = c - a * x; if (rem >= 0 && rem % b === 0) best = x; } if (best < 2) throw new GenFail("x");
    const [i1, i2] = rng.pick([["small pretzels", "large pretzels"], ["sticker packs", "model kits"], ["arcade tokens", "prize tickets"]]);
    return {
      stimulus: spin(rng, `A booth sells ${i1} for ${a} dollars each and ${i2} for ${b} dollars each. A customer spends exactly ${c} dollars, which is described by ${M(`${a}x + ${b}y = ${c}`)}, where x and y are whole numbers (either may be zero).`),
      question: spin(rng, `[[What is the greatest possible number of ${i1} the customer could have bought?|At most how many ${i1} can the customer have bought?]]`), correct: best,
      wrongs: [W(Math.floor(c / a), "condition_ignored", "정확히 맞아떨어지는 조건을 무시했다."), W(best - 1, "other", "경계에서 하나 덜 잡았다."), W(Math.floor(c / b), "step_missing", "다른 물건의 최대 개수를 답했다."), W(best + 1, "other", "경계에서 하나 더 잡았다."), W(Math.floor((c - b) / a), "condition_ignored", "다른 물건을 한 개 이상 사야 한다고 가정했다.")].filter((w) => w.v !== best && w.v >= 0),
      verificationJs: withParams({ a, b, c }, "let best=-1; for(let x=0;x<=1000;x++){ for(let y=0;y<=1000;y++){ if(P.a*x+P.b*y===P.c) best=Math.max(best,x); } }\nif(best<0) throw new Error('없음'); return best;"),
      trace: [T(`${a}x + ${b}y = ${c} 에서 x, y 는 0 이상의 정수이다.`, "Both unknowns are non-negative integers."), T(`y = (${c} − ${a}x)/${b} 가 0 이상의 정수여야 한다.`, "y must be a non-negative integer."), T(`${c} − ${a}x 는 ${b} 의 배수이면서 0 이상이어야 한다.`, "The remainder must be a multiple of b and non-negative."), T(`x 가 큰 쪽부터 조건을 확인한다.`, "Test x from the largest downward."), T(`가장 큰 x 는 ${best} 이다.`, "Answer.")],
    };
  },
};

export const L2_SPR_B_ARCHETYPES = [
  multi({ id: "l2b.line_applications.compose_kind", skill: SKILL, kind: KIND, operator: "compose_kind", structure: "직선의 두 절편과 원점이 이루는 삼각형의 넓이(방정식 + 도형 합성)", extraThinking: "직선의 절편을 구해 삼각형의 밑변·높이로 합성해야 함 — medium 은 절편 하나만 구함", concepts: ["이원일차방정식의 절편", "삼각형의 넓이"], mediumSteps: 2, variants: AREA }),
  multi({ id: "l2b.line_applications.chain2", skill: SKILL, kind: KIND, operator: "chain2", structure: "x 절편과 y 절편을 구한 뒤 두 점 사이의 거리를 구하는 2단계 연쇄", extraThinking: "앞 단계에서 구한 두 절편이 거리 공식의 입력이 됨 — medium 은 절편 하나만 구함", concepts: ["이원일차방정식의 절편", "거리 공식"], mediumSteps: 2, variants: DIST }),
  multi({ id: "l2b.line_applications.constraint_select", skill: SKILL, kind: KIND, operator: "constraint_select", structure: "ax + by = c 의 양의 정수 해(구매 조합)의 개수 선택", extraThinking: "나누어떨어짐과 양수 조건으로 정수 해를 걸러 개수를 세야 함 — medium 은 한 해를 대입해 확인", concepts: ["이원일차방정식", "정수 해 조건"], mediumSteps: 2, variants: LATT }),
  multi({ id: "l2b.line_applications.param_condition", skill: SKILL, kind: KIND, operator: "param_condition", structure: "ax + by = c 를 정확히 만족하는 0 이상의 정수 조합 중 한 물건 수의 최댓값 선택", extraThinking: "나머지가 다른 물건 가격의 배수가 되어야 하는 조건을 큰 값부터 따져야 함 — medium 은 한 조합을 확인", concepts: ["이원일차방정식", "배수 조건", "최댓값 선택"], mediumSteps: 2, variants: MAXI }),
];
