// circles — SPR 독립 그룹 보강(G10): 정답이 π 없는 수치인 원 문항 hard 원형 4개 × 변형 9개(그림 없이 서술·좌표·각의 식으로 성립).
import { GenFail, T, W, multi, type VFn } from "../spr-groups-b-kit";
import { spin, withParams, M, lin } from "../text";

const SKILL = "circles", KIND = "circle_numeric";
const TRIPLES: [number, number, number][] = [[3, 4, 5], [6, 8, 10], [5, 12, 13], [9, 12, 15], [8, 15, 17], [12, 16, 20], [7, 24, 25], [10, 24, 26], [15, 20, 25], [18, 24, 30], [20, 21, 29]];
const UNITS = ["centimeters", "meters", "inches", "feet", "units"] as const;

// ───────── inverse ─────────
const INV: Record<string, VFn> = {
  chord_distance_from_center: (rng) => {
    const [d, c, r] = rng.pick(TRIPLES); const u = rng.pick(UNITS); if (rng.chance(0.5)) throw new GenFail("x");
    return {
      stimulus: spin(rng, `A circle has a radius of ${r} ${u}. A chord of this circle is ${2 * c} ${u} long.`),
      question: spin(rng, `[[What is the distance, in ${u}, from the center of the circle to the chord?|How far is the chord from the center of the circle, in ${u}?]]`), correct: d,
      wrongs: [W(c, "step_missing", "현의 절반을 답했다."), W(r - c, "formula_misuse", "반지름에서 현의 절반을 뺐다."), W(2 * c, "step_missing", "현의 길이를 답했다."), W(r + c, "formula_misuse", "반지름과 현의 절반을 더했다."), W(d + 1, "other", "계산 실수.")],
      verificationJs: withParams({ r, L: 2 * c }, "const half=P.L/2; let ans=-1; for(let d=1;d<=100;d++){ if(d*d+half*half===P.r*P.r) ans=d; }\nif(ans<0) throw new Error('없음'); return ans;"),
      trace: [T("중심에서 현에 내린 수선은 현을 이등분한다.", "The perpendicular from the center bisects the chord."), T(`현의 절반은 ${2 * c} ÷ 2 = ${c} 이다.`, "Half the chord."), T("반지름, 현의 절반, 수선의 길이가 직각삼각형을 이룬다.", "These form a right triangle."), T(`d² + ${c}² = ${r}² 이므로 d² = ${r * r - c * c} 이다.`, "Pythagorean theorem."), T(`d = ${d} ${u} 이다.`, "Distance.")],
    };
  },
  thales_radius_from_legs: (rng) => {
    const t = rng.pick(TRIPLES.filter(([, , h]) => h % 2 === 0)); const [a, b, h] = t; const r = h / 2; const [x, y] = rng.pick([["A", "B"], ["P", "Q"], ["S", "T"]]); const u = rng.pick(UNITS);
    return {
      stimulus: spin(rng, `A right triangle with legs of length ${a} ${u} and ${b} ${u} is inscribed in a circle, with all three vertices on the circle.`),
      question: spin(rng, `[[What is the radius of the circle, in ${u}?|Find the radius of the circle in ${u}.]]`), correct: r,
      wrongs: [W(h, "formula_misuse", "빗변(지름)을 반지름으로 답했다."), W(Math.round((a + b) / 2), "formula_misuse", "두 변의 평균을 답했다."), W(a + b - h, "formula_misuse", "내접원 공식을 썼다."), W(Math.round(a * b / h), "formula_misuse", "빗변에 대한 높이를 답했다."), W(r + 1, "other", "계산 실수.")].filter((w) => Number.isInteger(w.v) && w.v > 0),
      verificationJs: withParams({ a, b }, "let ans=-1; for(let h=1;h<=200;h++){ if(h*h===P.a*P.a+P.b*P.b) ans=h/2; }\nif(ans<0) throw new Error('없음'); return ans;"),
      trace: [T("원에 내접하는 직각삼각형의 빗변은 원의 지름이다.", "The hypotenuse of an inscribed right triangle is a diameter."), T(`피타고라스 정리에서 빗변 h² = ${a}² + ${b}² = ${a * a + b * b} 이다.`, "Hypotenuse by the Pythagorean theorem."), T(`h = ${h} 이다.`, "Hypotenuse length."), T("반지름은 지름의 절반이다.", "Radius is half the diameter."), T(`반지름은 ${h} ÷ 2 = ${r} ${u} 이다.`, "Answer.")],
    };
  },
};

// ───────── compose_kind ─────────
const COMP: Record<string, VFn> = {
  diameter_endpoints_radius_squared: (rng) => {
    const x1 = rng.int(-9, 5), y1 = rng.int(-9, 5), hx = rng.int(1, 6), hy = rng.int(1, 6); const x2 = x1 + 2 * hx, y2 = y1 + 2 * hy; const r2 = hx * hx + hy * hy; if (r2 > 90 || hx === hy) throw new GenFail("x");
    return {
      stimulus: spin(rng, `The points (${x1}, ${y1}) and (${x2}, ${y2}) are the endpoints of a diameter of a circle in the xy-plane. An equation of the circle is ${M("(x - h)^2 + (y - k)^2 = c")}, where h, k, and c are constants.`),
      question: spin(rng, `[[What is the value of c?|Find the value of the constant c.]]`), correct: r2,
      wrongs: [W(hx * hx * 4 + hy * hy * 4, "formula_misuse", "지름의 제곱을 답했다(반지름의 제곱이 아님)."), W(Math.round(Math.sqrt(r2)) || 1, "step_missing", "제곱하지 않은 반지름 근사값을 답했다."), W(hx + hy, "formula_misuse", "좌표 변화량의 합을 답했다."), W(r2 + hx + hy, "other", "계산 실수."), W(2 * (hx * hx + hy * hy), "formula_misuse", "반지름의 제곱을 두 배로 계산했다.")],
      verificationJs: withParams({ x1, y1, x2, y2 }, "const dx=P.x2-P.x1, dy=P.y2-P.y1; const diam2=dx*dx+dy*dy; if(diam2%4!==0) throw new Error('정수 아님'); return diam2/4;"),
      trace: [T(`지름의 두 끝점 사이 거리의 제곱은 (${x2} − ${x1})² + (${y2} − ${y1})² = ${4 * r2} 이다.`, "Squared length of the diameter."), T("반지름은 지름의 절반이므로 반지름의 제곱은 지름의 제곱의 1/4 이다.", "r² is one quarter of the squared diameter."), T(`r² = ${4 * r2} ÷ 4 이다.`, "Divide by 4."), T("원의 방정식 오른쪽 상수 c 는 r² 이다.", "The constant c equals r squared."), T(`c = ${r2} 이다.`, "Answer.")],
    };
  },
  point_on_circle_missing_coordinate: (rng) => {
    const [a, b, r] = rng.pick(TRIPLES); const h = rng.int(-6, 6), k = rng.int(-6, 6); const y = k + b; if (b < 3) throw new GenFail("x"); const px = h + a; const ans = y; if (ans <= 0) throw new GenFail("x");
    return {
      stimulus: spin(rng, `A circle in the xy-plane has center (${h}, ${k}) and radius ${r}. The point (${px}, y) lies on the circle, and y is greater than ${k}.`),
      question: spin(rng, `[[What is the value of y?|Find y.]]`), correct: ans,
      wrongs: [W(k - b, "sign_error", "y 가 중심보다 작은 쪽의 값을 답했다."), W(b, "step_missing", "중심의 y 좌표를 더하지 않았다."), W(k + r, "formula_misuse", "점이 가장 높은 위치에 있다고 가정했다."), W(ans + 1, "other", "계산 실수."), W(k + a, "formula_misuse", "x 방향 거리를 더했다.")].filter((w) => w.v > 0),
      verificationJs: withParams({ h, k, r, px }, "let ans=null; for(let y=-100;y<=100;y++){ if(y>P.k && (P.px-P.h)*(P.px-P.h)+(y-P.k)*(y-P.k)===P.r*P.r) ans=y; }\nif(ans===null) throw new Error('없음'); return ans;"),
      trace: [T(`원의 방정식은 (x − ${h})² + (y − ${k})² = ${r * r} 이다.`, "Equation of the circle."), T(`x = ${px} 를 대입하면 (${px - h})² + (y − ${k})² = ${r * r} 이다.`, "Substitute x."), T(`(y − ${k})² = ${r * r} − ${a * a} = ${b * b} 이다.`, "Isolate the y term."), T(`y − ${k} = ±${b} 이고 y > ${k} 이므로 양수 쪽을 택한다.`, "Choose the root that matches the condition."), T(`y = ${k} + ${b} = ${ans} 이다.`, "Answer.")],
    };
  },
};

// ───────── chain2 ─────────
const CHAIN: Record<string, VFn> = {
  concentric_chord_tangent_to_inner: (rng) => {
    const [r, c, R] = rng.pick(TRIPLES); const u = rng.pick(UNITS); const ans = 2 * c;
    return {
      stimulus: spin(rng, `Two circles share the same center. The larger circle has a radius of ${R} ${u} and the smaller circle has a radius of ${r} ${u}. A chord of the larger circle is tangent to the smaller circle.`),
      question: spin(rng, `[[What is the length of the chord, in ${u}?|How long is the chord of the larger circle, in ${u}?]]`), correct: ans,
      wrongs: [W(c, "step_missing", "현의 절반을 답했다."), W(R - r, "formula_misuse", "반지름의 차를 답했다."), W(2 * (R - r), "formula_misuse", "반지름의 차의 두 배를 답했다."), W(R + r, "formula_misuse", "반지름의 합을 답했다."), W(ans + 2, "other", "계산 실수.")],
      verificationJs: withParams({ R, r }, "let half=-1; for(let c=1;c<=200;c++){ if(c*c+P.r*P.r===P.R*P.R) half=c; }\nif(half<0) throw new Error('없음'); return 2*half;"),
      trace: [T("접점에서 작은 원의 반지름은 현에 수직이고, 현을 이등분한다.", "The radius to the tangent point is perpendicular to the chord and bisects it."), T(`직각삼각형의 빗변은 큰 원의 반지름 ${R}, 한 변은 작은 원의 반지름 ${r} 이다.`, "Right triangle with the two radii."), T(`나머지 변 h² = ${R}² − ${r}² = ${R * R - r * r} 이다.`, "Pythagorean theorem."), T(`h = ${c} 이다.`, "Half of the chord."), T(`현의 길이는 2 × ${c} = ${ans} ${u} 이다.`, "Full chord length.")],
    };
  },
  tangent_quadrilateral_perimeter: (rng) => {
    const [r, t, d] = rng.pick(TRIPLES); const u = rng.pick(UNITS); const ans = 2 * r + 2 * t;
    return {
      stimulus: spin(rng, `Point P is outside a circle with center O and radius ${r} ${u}, and the distance OP is ${d} ${u}. Two tangent segments are drawn from P and touch the circle at points A and B. Quadrilateral OAPB is formed.`),
      question: spin(rng, `[[What is the perimeter of quadrilateral OAPB, in ${u}?|Find the perimeter of OAPB in ${u}.]]`), correct: ans,
      wrongs: [W(2 * r + 2 * d, "formula_misuse", "접선 길이 대신 OP 를 두 번 더했다."), W(t, "step_missing", "접선 하나의 길이만 답했다."), W(2 * t, "step_missing", "접선 두 개만 더했다."), W(r + t + d, "formula_misuse", "삼각형 OAP 의 둘레를 답했다."), W(ans + 2, "other", "계산 실수.")],
      verificationJs: withParams({ r, d }, "let t=-1; for(let s=1;s<=300;s++){ if(s*s+P.r*P.r===P.d*P.d) t=s; }\nif(t<0) throw new Error('없음'); return 2*P.r+2*t;"),
      trace: [T("접점에서 반지름은 접선에 수직이다.", "A radius to a tangent point is perpendicular to the tangent."), T(`삼각형 OAP 는 직각삼각형이고 빗변은 OP = ${d} 이다.`, "Right triangle OAP."), T(`접선 PA² = ${d}² − ${r}² = ${d * d - r * r} 이므로 PA = ${t} 이다.`, "Tangent length."), T(`같은 점에서 그은 두 접선의 길이는 같으므로 PB = ${t} 이다.`, "Equal tangents."), T(`둘레는 ${r} + ${r} + ${t} + ${t} = ${ans} ${u} 이다.`, "Perimeter.")],
    };
  },
  equal_area_sectors_angle: (rng) => {
    const r1 = rng.int(3, 12), r2 = rng.int(2, 9), a1 = rng.pick([20, 30, 40, 45, 60, 80, 90, 120]); if (r1 <= r2) throw new GenFail("x"); const num = a1 * r1 * r1; if (num % (r2 * r2) !== 0) throw new GenFail("x"); const ans = num / (r2 * r2); if (ans >= 360 || ans === a1) throw new GenFail("x");
    return {
      stimulus: spin(rng, `Sector A has a radius of ${r1} centimeters and a central angle of ${a1} degrees. Sector B belongs to a smaller circle with a radius of ${r2} centimeters. The two sectors have exactly the same area.`),
      question: spin(rng, `[[What is the central angle of sector B, in degrees?|Find the degree measure of the central angle of sector B.]]`), correct: ans,
      wrongs: [W(Math.round((a1 * r1) / r2), "formula_misuse", "반지름의 비를 제곱하지 않았다."), W(Math.round((a1 * r2 * r2) / (r1 * r1)) || 1, "formula_misuse", "비를 거꾸로 썼다."), W(a1, "step_missing", "첫 부채꼴의 각을 답했다."), W(360 - ans, "other", "나머지 각을 답했다."), W(ans + 5, "other", "계산 실수.")].filter((w) => Number.isInteger(w.v) && w.v > 0),
      verificationJs: withParams({ r1, r2, a1 }, "let ans=-1; for(let a=1;a<360;a++){ if(P.a1*P.r1*P.r1===a*P.r2*P.r2) ans=a; }\nif(ans<0) throw new Error('없음'); return ans;"),
      trace: [T("부채꼴의 넓이는 (각/360) × π r² 이다.", "Sector area formula."), T(`A 의 넓이는 (${a1}/360) × π × ${r1}² 이다.`, "Area of sector A."), T(`B 의 넓이는 (θ/360) × π × ${r2}² 이다.`, "Area of sector B."), T(`두 넓이가 같으므로 ${a1} × ${r1 * r1} = θ × ${r2 * r2} 이다.`, "Set them equal; π and 360 cancel."), T(`θ = ${num} ÷ ${r2 * r2} = ${ans} 도이다.`, "Solve.")],
    };
  },
};

// ───────── constraint_select ─────────
const SEL: Record<string, VFn> = {
  inscribed_angle_equation_degrees: (rng) => {
    const x0 = rng.int(8, 30), a = rng.int(1, 4), c = rng.int(2, 7); const b = rng.int(-12, 15), d = a * 2 * x0 + 2 * b - c * x0; if (c === 2 * a || Math.abs(d) > 40 || b === 0 || d === 0) throw new GenFail("x"); const inscribed = a * x0 + b, arc = c * x0 + d; if (arc !== 2 * inscribed || arc <= 20 || arc >= 340) throw new GenFail("x");
    return {
      stimulus: spin(rng, `In a circle, an inscribed angle measures ${M(`(${lin(a, b)})^\\circ`)} and the arc it intercepts measures ${M(`(${lin(c, d)})^\\circ`)}.`),
      question: spin(rng, `[[What is the measure, in degrees, of the intercepted arc?|What is the degree measure of the arc?]]`), correct: arc,
      wrongs: [W(inscribed, "other", "내접각의 크기를 답했다."), W(x0, "step_missing", "x 의 값만 답했다."), W(Math.round(arc / 2) + x0, "other", "계산 실수."), W(inscribed * 4, "formula_misuse", "호를 중심각의 두 배로 다시 계산했다."), W(360 - arc, "other", "나머지 호를 답했다.")].filter((w) => w.v > 0),
      verificationJs: withParams({ a, b, c, d }, "let ans=-1; for(let x=1;x<=179;x++){ const ang=P.a*x+P.b, arc=P.c*x+P.d; if(arc===2*ang && arc>0 && arc<360) ans=arc; }\nif(ans<0) throw new Error('없음'); return ans;"),
      trace: [T("내접각의 크기는 그 호의 크기의 절반이다.", "An inscribed angle is half its intercepted arc."), T(`${lin(a, b)} = (${lin(c, d)})/2 이다.`, "Set up the equation."), T(`양변에 2 를 곱하면 ${lin(2 * a, 2 * b)} = ${lin(c, d)} 이다.`, "Clear the fraction."), T(`x = ${x0} 이다.`, "Solve for x."), T(`호의 크기는 ${c} × ${x0} + ${d} = ${arc}° 이다.`, "Evaluate the arc.")],
    };
  },
  cyclic_quadrilateral_opposite_angle: (rng) => {
    const x0 = rng.int(10, 30), a = rng.int(1, 3), c = rng.int(1, 3), b = rng.int(-10, 20); const d = 180 - (a + c) * x0 - b; if (Math.abs(d) > 40 || d === 0 || b === 0 || a === c) throw new GenFail("x"); const A = a * x0 + b, C = c * x0 + d; if (A <= 20 || C <= 20 || A === C) throw new GenFail("x"); const ans = Math.max(A, C);
    return {
      stimulus: spin(rng, `Quadrilateral ABCD is inscribed in a circle. Angle A measures ${M(`(${lin(a, b)})^\\circ`)} and the opposite angle C measures ${M(`(${lin(c, d)})^\\circ`)}.`),
      question: spin(rng, `[[What is the measure, in degrees, of the larger of angles A and C?|What is the degree measure of the greater of the two opposite angles A and C?]]`), correct: ans,
      wrongs: [W(Math.min(A, C), "other", "작은 각을 답했다."), W(x0, "step_missing", "x 의 값만 답했다."), W(360 - A - C + ans, "formula_misuse", "합을 360 으로 놓고 풀었다."), W(ans + 10, "other", "계산 실수."), W(90, "formula_misuse", "반원 각을 답했다.")],
      verificationJs: withParams({ a, b, c, d }, "let ans=-1; for(let x=1;x<=179;x++){ const A=P.a*x+P.b, C=P.c*x+P.d; if(A+C===180 && A>0 && C>0) ans=Math.max(A,C); }\nif(ans<0) throw new Error('없음'); return ans;"),
      trace: [T("원에 내접하는 사각형의 마주 보는 두 각의 합은 180° 이다.", "Opposite angles of a cyclic quadrilateral are supplementary."), T(`(${lin(a, b)}) + (${lin(c, d)}) = 180 이다.`, "Set up the equation."), T(`${a + c}x + ${b + d} = 180 이다.`, "Combine like terms."), T(`x = ${x0} 이다.`, "Solve for x."), T(`두 각은 ${A}° 와 ${C}° 이고 큰 쪽은 ${ans}° 이다.`, "Compare the two angles.")],
    };
  },
};

export const CI_SPR_B_ARCHETYPES = [
  multi({ id: "cib.circle_numeric.inverse", skill: SKILL, kind: KIND, operator: "inverse", structure: "현의 길이와 반지름에서 중심까지의 거리를, 직각삼각형의 두 변에서 외접원의 반지름을 거꾸로 구하는 2가지 장면", extraThinking: "원의 성질(수선의 이등분, 직각삼각형의 외접원)을 떠올려 숨은 직각삼각형을 만들어야 함 — medium 은 반지름으로 둘레·넓이를 바로 계산", concepts: ["원의 성질", "피타고라스 정리", "직각삼각형의 외접원"], mediumSteps: 2, variants: INV }),
  multi({ id: "cib.circle_numeric.compose_kind", skill: SKILL, kind: KIND, operator: "compose_kind", structure: "좌표평면의 원 방정식과 거리 공식·피타고라스를 합성하는 2가지 장면(지름 끝점의 r², 원 위 점의 좌표)", extraThinking: "원의 방정식을 거리 공식과 합성해 반지름·좌표를 구해야 함 — medium 은 방정식에서 중심·반지름을 읽음", concepts: ["원의 방정식", "거리 공식", "좌표 계산"], mediumSteps: 2, variants: COMP }),
  multi({ id: "cib.circle_numeric.chain2", skill: SKILL, kind: KIND, operator: "chain2", structure: "접선·동심원의 현·같은 넓이의 부채꼴에서 앞 단계 길이가 뒤 단계의 입력이 되는 3가지 2단계 연쇄", extraThinking: "접선의 수직성·넓이 보존으로 한 양을 구한 뒤 다시 다른 양에 쓰는 연쇄 — medium 은 공식 한 번의 적용", concepts: ["접선의 성질", "부채꼴 넓이 비례", "직각삼각형"], mediumSteps: 2, variants: CHAIN }),
  multi({ id: "cib.circle_numeric.constraint_select", skill: SKILL, kind: KIND, operator: "constraint_select", structure: "내접각과 호의 관계·원에 내접하는 사각형의 대각 조건을 일차방정식으로 세워 각도를 선택하는 2가지 장면", extraThinking: "원의 각 성질을 식으로 번역한 뒤 해를 구하고 묻는 각을 골라야 함 — medium 은 각 하나의 계산", concepts: ["내접각", "원에 내접하는 사각형", "일차방정식"], mediumSteps: 2, variants: SEL }),
];
