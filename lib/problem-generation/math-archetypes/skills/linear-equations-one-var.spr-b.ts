// linear_equations_one_var — SPR 독립 그룹 보강(G10): 일차방정식 응용 hard 원형 4개 × 변형 20개(변형 하나 = 유사문항 그룹 하나). 금액은 dollars 로 쓴다.
import { GenFail, T, W, multi, type VFn } from "../spr-groups-b-kit";
import { spin, withParams, M, lin } from "../text";

const SKILL = "linear_equations_one_var", KIND = "equation_applications";

// ───────── param_condition: 방정식의 상수·매개변수가 해의 성질을 정함 ─────────
const PARAM: Record<string, VFn> = {
  divisor_count_integer_solution: (rng) => {
    const c = rng.int(3, 15), N0 = rng.pick([36, 48, 60, 72, 90, 120]), R = rng.int(10, N0 - 4); const N = N0 + c; let cnt = 0; for (let k = 1; k <= R; k++) if (N0 % k === 0) cnt++; if (cnt < 4) throw new GenFail("x");
    return {
      stimulus: spin(rng, `In the equation ${M(`kx + ${c} = ${N}`)}, k is a positive integer constant and x is the unknown.`),
      question: spin(rng, `[[For how many values of k with k ≤ ${R} is the solution x a positive integer?|How many positive integers k, with k ≤ ${R}, make the solution of the equation a positive integer?]]`), correct: cnt,
      wrongs: [W(R, "step_missing", "k 의 범위 크기를 그대로 답했다."), W(cnt + 1, "other", "약수를 하나 더 셌다."), W(Math.max(1, cnt - 1), "other", "약수를 하나 빠뜨렸다."), W(cnt * 2, "other", "약수와 몫을 따로 셌다."), W([...Array(N + 1).keys()].filter((k) => k > 0 && N % k === 0).filter((k) => k <= R).length || 1, "formula_misuse", `상수항을 옮기지 않고 ${N} 의 약수로 계산했다.`)],
      verificationJs: withParams({ c, N, R }, "let n=0; for(let k=1;k<=P.R;k++){ for(let x=1;x<=P.N;x++){ if(k*x+P.c===P.N){ n++; break; } } }\nreturn n;"),
      trace: [T(`상수항을 이항하면 kx = ${N} − ${c} = ${N0} 이다.`, "Move the constant."), T(`x = ${N0}/k 이므로 k 는 ${N0} 의 약수여야 한다.`, "x is a positive integer only if k divides the constant."), T(`${N0} 의 약수를 모두 나열한다.`, "List the divisors."), T(`그 중 k ≤ ${R} 인 것만 고른다.`, "Keep divisors up to the bound."), T(`${cnt} 개이다.`, "Count.")],
    };
  },
  solution_equals_parameter: (rng) => {
    const k0 = rng.int(2, 12), a = rng.int(4, 9), c = rng.int(1, a - 2), b = rng.int(1, 6), d = rng.int(1, 6); const e = (a - c + b - d) * k0; if (e <= 0 || e > 120 || b === d) throw new GenFail("x");
    return {
      stimulus: spin(rng, `In the equation ${M(`${a}x + ${b}k = ${c}x + ${d}k + ${e}`)}, k is a constant. The solution for x is equal to k itself.`),
      question: spin(rng, `[[What is the value of k?|Find k.]]`), correct: k0,
      wrongs: [W(e, "step_missing", "상수항을 답했다."), W(Math.round(e / (a - c)), "step_missing", "k 항을 정리하지 않고 x 계수로만 나눴다."), W(k0 + 1, "other", "계산 실수."), W(Math.round(e / (a - c - b + d)) || 1, "sign_error", "k 항의 부호를 잘못 옮겼다."), W(Math.round(e / (a + b + c + d)) || 1, "sign_error", "모든 항을 더했다.")],
      verificationJs: withParams({ a, b, c, d, e }, "let ans=-1; for(let k=1;k<=500;k++){ const x=k; if(P.a*x+P.b*k===P.c*x+P.d*k+P.e) ans=k; }\nif(ans<0) throw new Error('없음'); return ans;"),
      trace: [T("x = k 를 방정식에 대입한다.", "Substitute x = k."), T(`${a}k + ${b}k = ${c}k + ${d}k + ${e} 이다.`, "Rewrite."), T(`좌변은 ${a + b}k, 우변은 ${c + d}k + ${e} 이다.`, "Combine like terms."), T(`${a + b - c - d}k = ${e} 이다.`, "Collect k on one side."), T(`k = ${e}/${a + b - c - d} = ${k0} 이다.`, "Solve.")],
    };
  },
  abs_solutions_sum: (rng) => {
    const a = rng.int(2, 6), b = rng.int(2, 24), c = rng.int(3, 20); if ((2 * b) % a !== 0 || c === b) throw new GenFail("x"); const sum = (2 * b) / a; if (sum < 2) throw new GenFail("x");
    return {
      stimulus: spin(rng, `Consider the equation ${M(`|${a}x - ${b}| = ${c}`)}. It has two different real solutions.`),
      question: spin(rng, `[[What is the sum of the two solutions?|What do the two solutions add up to?]]`), correct: sum,
      wrongs: [W(c, "step_missing", "우변의 값을 답했다."), W(b, "step_missing", "상수항을 답했다."), W((2 * c) / a, "formula_misuse", "두 해의 차를 합으로 답했다."), W(sum + 1, "other", "계산 실수."), W(Math.round(b / a), "step_missing", "한 쪽 해만 구한 것의 중심값을 답했다.")].filter((w) => Number.isInteger(w.v)),
      verificationJs: withParams({ a, b, c }, "let total=0; for(let i=-3000;i<=3000;i++){ if(Math.abs(i-P.b)===P.c){ total+=i/P.a; } }\nreturn total;"),
      trace: [T(`절댓값 방정식은 ${a}x − ${b} = ${c} 또는 ${a}x − ${b} = −${c} 이다.`, "Split into two cases."), T(`첫째: x = ${(b + c)}/${a} 이다.`, "First solution."), T(`둘째: x = ${(b - c)}/${a} 이다.`, "Second solution."), T(`두 해를 더하면 (${b + c} + ${b - c})/${a} 이다.`, "Add the solutions."), T(`합은 ${sum} 이다.`, "Answer.")],
    };
  },
  equal_solutions_two_equations: (rng) => {
    const x0 = rng.int(2, 9), a = rng.int(2, 6), b = rng.int(-9, 12), p = rng.int(2, 8), k0 = rng.int(2, 15); const c = a * x0 + b, r = p * x0 - k0; if (b === 0 || c <= 0 || Math.abs(r) > 60) throw new GenFail("x");
    return {
      stimulus: spin(rng, `The equation ${M(`${lin(a, b)} = ${c}`)} and the equation ${M(`${p}x - k = ${r}`)} have the same solution for x, where k is a constant.`),
      question: spin(rng, `[[What is the value of k?|Find the value of the constant k.]]`), correct: k0,
      wrongs: [W(x0, "step_missing", "첫 방정식의 해를 답했다."), W(r, "step_missing", "둘째 방정식의 상수항을 답했다."), W(p * x0 + r, "sign_error", "k 항을 이항할 때 부호를 틀렸다."), W(k0 + p, "other", "계산 실수."), W(Math.round(Math.abs(c - r)) || 1, "formula_misuse", "두 상수항의 차를 답했다.")],
      verificationJs: withParams({ a, b, c, p, r }, "let sol=null; for(let x=-300;x<=300;x++){ if(P.a*x+P.b===P.c) sol=x; }\nif(sol===null) throw new Error('해 없음'); for(let k=-500;k<=500;k++){ if(P.p*sol-k===P.r) return k; }\nthrow new Error('k 없음');"),
      trace: [T(`첫 방정식에서 ${a}x = ${c - b} 이다.`, "Isolate the x-term of the first equation."), T(`x = ${x0} 이다.`, "First solution."), T("둘째 방정식도 같은 해를 가지므로 x = " + x0 + " 를 대입한다.", "Substitute into the second equation."), T(`${p} × ${x0} − k = ${r} 이다.`, "Write it out."), T(`k = ${p * x0} − ${r} = ${k0} 이다.`, "Solve for k.")],
    };
  },
  solution_sign_condition_count: (rng) => {
    const a = rng.int(2, 6), N = rng.int(15, 70); let cnt = 0; for (let k = 1; k <= 200; k++) { const num = N - k; if (num > 0 && num % a === 0) cnt++; } if (cnt < 3 || cnt > 14) throw new GenFail("x");
    return {
      stimulus: spin(rng, `Consider the equation ${M(`${a}x + k = ${N}`)}, where k is a positive integer constant.`),
      question: spin(rng, `[[For how many values of k is the solution x a positive integer?|How many positive integers k give a solution x that is also a positive integer?]]`), correct: cnt,
      wrongs: [W(N - 1, "step_missing", "x 가 정수여야 한다는 조건을 무시했다."), W(cnt + 1, "other", "x = 0 인 경우를 포함했다."), W(Math.max(1, cnt - 1), "other", "경계 경우를 빠뜨렸다."), W(Math.floor(N / a), "step_missing", "k 를 구하지 않고 x 의 최대 크기만 구했다."), W(cnt * a, "other", "계수를 곱했다.")],
      verificationJs: withParams({ a, N }, "let n=0; for(let k=1;k<=500;k++){ for(let x=1;x<=500;x++){ if(P.a*x+k===P.N){ n++; break; } } }\nreturn n;"),
      trace: [T(`k 를 이항하면 ${a}x = ${N} − k 이다.`, "Isolate the x-term."), T(`x = (${N} − k)/${a} 이다.`, "Solve for x."), T(`x 가 양수이려면 ${N} − k > 0 이므로 k < ${N} 이다.`, "Positivity condition."), T(`x 가 정수이려면 ${N} − k 가 ${a} 의 배수여야 한다.`, "Integrality condition."), T(`조건을 만족하는 k 는 ${cnt} 개이다.`, "Count.")],
    };
  },
};

// ───────── inverse: 결과에서 시작량·미지수를 거꾸로 ─────────
const INV: Record<string, VFn> = {
  coins_count_quarters: (rng) => {
    const q = rng.int(3, 18), d = rng.int(3, 18), n = q + d; const V = 10 * d + 25 * q; if (q === d) throw new GenFail("x");
    const who = rng.pick(["Dana", "Marcus", "Priya", "Leo", "Nina"]);
    return {
      stimulus: spin(rng, `${who} has ${n} coins in a jar. Every coin is a dime (10 cents) or a quarter (25 cents), and the coins are worth ${V} cents in all.`),
      question: spin(rng, `[[How many quarters are in the jar?|What is the number of quarters in the jar?]]`), correct: q,
      wrongs: [W(d, "other", "다임의 수를 답했다."), W(Math.round(V / 25), "step_missing", "모두 쿼터라고 가정했다."), W(Math.round((V - 10 * n) / 10), "formula_misuse", "차이를 10 으로 나눴다."), W(q + 1, "other", "계산 실수."), W(Math.round(V / 35), "formula_misuse", "평균 가치로 나눴다.")],
      verificationJs: withParams({ n, V }, "let ans=-1; for(let q=0;q<=P.n;q++){ const d=P.n-q; if(10*d+25*q===P.V) ans=q; }\nif(ans<0) throw new Error('없음'); return ans;"),
      trace: [T(`쿼터의 수를 q 라 하면 다임은 ${n} − q 개이다.`, "Let q be the number of quarters."), T(`가치는 25q + 10(${n} − q) = ${V} 이다.`, "Write the value equation."), T(`15q + ${10 * n} = ${V} 이다.`, "Simplify."), T(`15q = ${V - 10 * n} 이다.`, "Isolate."), T(`q = ${q} 이다.`, "Solve.")],
    };
  },
  reverse_operation_chain: (rng) => {
    const x0 = rng.int(3, 30), m = rng.int(2, 6), s = rng.int(1, 12), dv = rng.pick([2, 3, 4, 5]), a = rng.int(1, 15); if ((m * x0 - s) % dv !== 0 || m * x0 - s <= 0) throw new GenFail("x"); const R = (m * x0 - s) / dv + a; if (R > 200) throw new GenFail("x");
    return {
      stimulus: spin(rng, `A number is multiplied by ${m}, then ${s} is subtracted from the product. That result is divided by ${dv}, and finally ${a} is added. The final result is ${R}.`),
      question: spin(rng, `[[What was the original number?|What number did the process start with?]]`), correct: x0,
      wrongs: [W(R, "step_missing", "최종 결과를 답했다."), W((((R - a) * dv - s) / m), "sign_error", "빼기 단계를 되돌릴 때 부호를 틀렸다."), W((((R + a) * dv + s) / m), "sign_error", "더하기 단계를 거꾸로 적용하지 않았다."), W(Math.round(((R - a) * dv + s) / m) + 1, "other", "계산 실수."), W((R - a) * dv, "step_missing", "일부 단계만 되돌렸다.")].filter((w) => Number.isInteger(w.v)),
      verificationJs: withParams({ m, s, dv, a, R }, "let ans=-1; for(let x=1;x<=1000;x++){ const v=(P.m*x-P.s)/P.dv+P.a; if(Math.abs(v-P.R)<1e-9) ans=x; }\nif(ans<0) throw new Error('없음'); return ans;"),
      trace: [T(`마지막 단계 ${a} 를 더한 것을 되돌려 ${R} − ${a} = ${R - a} 이다.`, "Undo the final addition."), T(`${dv} 로 나눈 것을 되돌려 ${(R - a) * dv} 이다.`, "Undo the division."), T(`${s} 를 뺀 것을 되돌려 ${(R - a) * dv + s} 이다.`, "Undo the subtraction."), T(`${m} 를 곱한 것을 되돌려 ${(R - a) * dv + s} ÷ ${m} 이다.`, "Undo the multiplication."), T(`처음 수는 ${x0} 이다.`, "Answer.")],
    };
  },
  later_start_meeting_distance: (rng) => {
    const vA = rng.int(10, 24), vB = rng.int(8, 22), h = rng.int(1, 3), t0 = rng.int(h + 1, h + 6); const D = vA * t0 + vB * (t0 - h); if (D > 900 || vA === vB) throw new GenFail("x"); const ans = vA * t0;
    const [x, y] = rng.pick([["Ava", "Ben"], ["Kai", "Rosa"], ["Theo", "Lina"], ["Omar", "June"]]);
    return {
      stimulus: spin(rng, `${x} and ${y} live ${D} miles apart and ride bicycles toward each other along the same straight road. ${x} leaves first and rides at ${vA} miles per hour. ${y} leaves ${h} hours later and rides at ${vB} miles per hour.`),
      question: spin(rng, `[[How many miles has ${x} ridden when they meet?|By the time the two riders meet, what distance, in miles, has ${x} covered?]]`), correct: ans,
      wrongs: [W(vB * (t0 - h), "other", "상대가 달린 거리를 답했다."), W(Math.round((D * vA) / (vA + vB)), "step_missing", "늦게 출발한 시간을 무시했다."), W(t0, "step_missing", "만날 때까지 걸린 시간만 답했다."), W(ans + vA, "other", "시간을 하나 더 잡았다."), W(Math.round(D / 2), "formula_misuse", "정확히 중간에서 만난다고 가정했다.")],
      verificationJs: withParams({ D, vA, vB, h }, "let ans=-1; for(let t=P.h;t<=100;t++){ const a=P.vA*t, b=P.vB*(t-P.h); if(a+b===P.D) ans=a; }\nif(ans<0) throw new Error('만나지 않음'); return ans;"),
      trace: [T(`${x} 가 출발한 지 t 시간 뒤 만난다고 하면 ${y} 는 (t − ${h}) 시간 탔다.`, "Set up the riding times."), T(`거리 합: ${vA}t + ${vB}(t − ${h}) = ${D} 이다.`, "The distances sum to the total."), T(`${vA + vB}t − ${vB * h} = ${D} 이므로 ${vA + vB}t = ${D + vB * h} 이다.`, "Simplify."), T(`t = ${t0} 시간이다.`, "Solve for t."), T(`${x} 의 거리는 ${vA} × ${t0} = ${ans} mi 이다.`, "Distance ridden by the first rider.")],
    };
  },
  equal_perimeters_shapes: (rng) => {
    const x0 = rng.int(2, 9), a = rng.int(1, 4), c = rng.int(1, 4), m = rng.int(3, 12); const b = 5 * m - a * x0, d = 4 * m - c * x0; if (b === 0 || d === 0 || Math.abs(b) > 14 || Math.abs(d) > 14 || a * x0 + b <= 0 || c * x0 + d <= 0 || a === c) throw new GenFail("x"); const per = 20 * m;
    return {
      stimulus: spin(rng, `A square has side length ${M(lin(a, b))} centimeters, and a regular pentagon has side length ${M(lin(c, d))} centimeters. The square and the pentagon have the same perimeter.`),
      question: spin(rng, `[[What is the perimeter, in centimeters, of the square?|What is the common perimeter of the two shapes, in centimeters?]]`), correct: per,
      wrongs: [W(a * x0 + b, "step_missing", "한 변의 길이를 답했다."), W(x0, "step_missing", "x 의 값만 답했다."), W(5 * (c * x0 + d) + 4 * m, "other", "오각형 둘레에 계산 실수."), W(4 * (a * x0 + b) + m, "other", "계산 실수."), W((a * x0 + b) * 5, "formula_misuse", "정사각형 둘레를 5 배로 계산했다.")],
      verificationJs: withParams({ a, b, c, d }, "let per=-1; for(let x=1;x<=200;x++){ const s=P.a*x+P.b, p=P.c*x+P.d; if(s>0&&p>0&&4*s===5*p) per=4*s; }\nif(per<0) throw new Error('없음'); return per;"),
      trace: [T(`정사각형의 둘레는 4(${lin(a, b)}) 이다.`, "Perimeter of the square."), T(`정오각형의 둘레는 5(${lin(c, d)}) 이다.`, "Perimeter of the pentagon."), T(`둘레가 같으므로 4(${lin(a, b)}) = 5(${lin(c, d)}) 이다.`, "Set them equal."), T(`전개하여 x = ${x0} 를 얻는다.`, "Solve for x."), T(`정사각형의 둘레는 4 × ${a * x0 + b} = ${per} cm 이다.`, "Compute the perimeter.")],
    };
  },
  fraction_remaining_total: (rng) => {
    const [f1n, f1d] = rng.pick([[1, 4], [1, 3], [2, 5], [1, 5], [3, 8]] as const), [f2n, f2d] = rng.pick([[1, 3], [1, 2], [2, 3], [1, 4]] as const); const rem1d = f1d - f1n; const Tt = f1d * f2d * rng.int(1, 6); const eaten1 = (Tt * f1n) / f1d; const r1 = Tt - eaten1; const eaten2 = (r1 * f2n) / f2d; const L = r1 - eaten2; if (!Number.isInteger(eaten1) || !Number.isInteger(eaten2) || L < 3 || Tt > 300 || rem1d <= 0) throw new GenFail("x");
    const what = rng.pick(["pizza slices", "cookies in a tin", "pages in a workbook", "marbles in a bag"]);
    return {
      stimulus: spin(rng, `Of all the ${what}, ${f1n}/${f1d} are used on the first day. On the second day, ${f2n}/${f2d} of the ${what} that were left after the first day are used. Exactly ${L} ${what} remain after the second day.`),
      question: spin(rng, `[[How many ${what} were there at the start?|What was the original number of ${what}?]]`), correct: Tt,
      wrongs: [W(Math.round(L / (1 - f1n / f1d - f2n / f2d)), "formula_misuse", "두 번째 분수를 처음 전체에 대한 것으로 계산했다."), W(Math.round(L * f1d / (f1d - f1n)), "step_missing", "첫날 사용분만 되돌렸다."), W(r1, "step_missing", "첫날 이후 남은 양을 답했다."), W(L + eaten1 + eaten2 + 1, "other", "계산 실수."), W(L * (f1d + f2d), "formula_misuse", "분모를 더해 곱했다.")].filter((w) => Number.isInteger(w.v)),
      verificationJs: withParams({ f1n, f1d, f2n, f2d, L }, "let ans=-1; for(let T=1;T<=600;T++){ const r1=T-T*P.f1n/P.f1d; const left=r1-r1*P.f2n/P.f2d; if(Math.abs(left-P.L)<1e-9 && Number.isInteger(T*P.f1n/P.f1d) && Number.isInteger(r1*P.f2n/P.f2d)) ans=T; }\nif(ans<0) throw new Error('없음'); return ans;"),
      trace: [T(`처음 양을 T 라 하면 첫날 후 남은 양은 T × ${f1d - f1n}/${f1d} 이다.`, "Amount left after the first day."), T(`둘째 날 후 남은 양은 그 값 × ${f2d - f2n}/${f2d} 이다.`, "Amount left after the second day."), T(`즉 T × ${f1d - f1n}/${f1d} × ${f2d - f2n}/${f2d} = ${L} 이다.`, "Set up the equation."), T(`곱한 분수는 ${((f1d - f1n) * (f2d - f2n))}/${f1d * f2d} 이다.`, "Multiply the fractions."), T(`T = ${L} × ${f1d * f2d}/${(f1d - f1n) * (f2d - f2n)} = ${Tt} 이다.`, "Solve.")],
    };
  },
};

// ───────── chain2: 앞 방정식의 해가 뒤 단계의 입력 ─────────
const CHAIN: Record<string, VFn> = {
  overtime_total_hours: (rng) => {
    const w = rng.pick([12, 14, 16, 18, 20, 22, 24]), h = rng.int(2, 14); const E = 40 * w + h * 1.5 * w; if (!Number.isInteger(E) || E > 990) throw new GenFail("x"); const ans = 40 + h;
    const who = rng.pick(["A warehouse worker", "A line cook", "A security guard", "A mechanic"]);
    return {
      stimulus: spin(rng, `${who} is paid ${w} dollars per hour for the first 40 hours in a week and 1.5 times that hourly rate for every hour beyond 40. One week the worker's pay before deductions is ${E} dollars.`),
      question: spin(rng, `[[How many hours did the worker work that week?|What is the total number of hours worked in that week?]]`), correct: ans,
      wrongs: [W(h, "step_missing", "초과 근무 시간만 답했다."), W(Math.round(E / w), "formula_misuse", "모든 시간에 기본 시급을 적용했다."), W(Math.round(40 + (E - 40 * w) / w), "formula_misuse", "초과 시급을 1.5 배로 하지 않았다."), W(Math.round(E / (1.5 * w)), "formula_misuse", "모든 시간에 초과 시급을 적용했다."), W(ans + 1, "other", "계산 실수.")],
      verificationJs: withParams({ w, E }, "let hours=0, pay=0; while(pay<P.E){ hours++; pay+= hours<=40 ? P.w : 1.5*P.w; if(hours>200) throw new Error('끝나지 않음'); }\nif(Math.abs(pay-P.E)>1e-9) throw new Error('정확히 일치하지 않음'); return hours;"),
      trace: [T(`처음 40 시간의 급여는 40 × ${w} = ${40 * w} 달러이다.`, "Regular pay."), T(`초과 시급은 1.5 × ${w} = ${1.5 * w} 달러이다.`, "Overtime rate."), T(`초과 시간을 x 라 하면 ${40 * w} + ${1.5 * w}x = ${E} 이다.`, "Set up the equation."), T(`x = ${(E - 40 * w) / (1.5 * w)} 이다.`, "Solve for the overtime hours."), T(`전체 시간은 40 + ${h} = ${ans} 이다.`, "Add the regular hours.")],
    };
  },
  convert_equal_fahrenheit: (rng) => {
    const b = rng.pick([2, 3]), a = rng.int(0, 31); const num = 5 * (32 - a); if (num % (5 * b - 9) !== 0) throw new GenFail("x"); const C = num / (5 * b - 9); if (C < 5 || C > 150) throw new GenFail("x"); const F = (9 * C) / 5 + 32; if (!Number.isInteger(F) || F > 400) throw new GenFail("x");
    const what = rng.pick(["a lab sample", "a pot of water", "an oven test", "a desert thermometer"]);
    return {
      stimulus: spin(rng, `For ${what}, the Fahrenheit reading is ${a} more than ${b} times the Celsius reading. Temperatures in degrees Fahrenheit and Celsius are related by F = 9C/5 + 32.`),
      question: spin(rng, `[[What is the temperature in degrees Fahrenheit?|What is the Fahrenheit reading?]]`), correct: F,
      wrongs: [W(C, "step_missing", "섭씨 값을 답했다."), W(b * C + a + 1, "other", "계산 실수."), W(Math.round(C * 9 / 5), "step_missing", "32 를 더하지 않았다."), W(Math.round((C - 32) * 5 / 9), "formula_misuse", "변환 방향을 거꾸로 했다."), W(Math.round(a + b * C + 32), "other", "32 를 한 번 더 더했다.")].filter((w) => Number.isInteger(w.v)),
      verificationJs: withParams({ a, b }, "for(let C=-100;C<=400;C++){ const F=9*C/5+32; if(Math.abs(F-(P.b*C+P.a))<1e-9) return F; }\nthrow new Error('없음');"),
      trace: [T(`화씨 F 는 ${b}C + ${a} 이고 F = 9C/5 + 32 이다.`, "Two expressions for F."), T(`${b}C + ${a} = 9C/5 + 32 이다.`, "Set them equal."), T(`${b}C − 9C/5 = ${32 - a} 이므로 ${(5 * b - 9)}C/5 = ${32 - a} 이다.`, "Collect the C terms."), T(`C = ${C} 이다.`, "Solve for C."), T(`F = 9 × ${C}/5 + 32 = ${F} 이다.`, "Convert to Fahrenheit.")],
    };
  },
  mean_missing_difference: (rng) => {
    const nums = [rng.int(60, 98), rng.int(60, 98), rng.int(60, 98), rng.int(60, 98)], mean = rng.int(72, 92); const x = 5 * mean - nums.reduce((a, b) => a + b, 0); if (x < 40 || x > 100 || nums.includes(x) || new Set(nums).size < 4) throw new GenFail("x"); const all = [...nums, x]; const ans = Math.max(...all) - Math.min(...all); if (ans < 8) throw new GenFail("x");
    const ctx = rng.pick(["quiz scores", "daily step counts in hundreds", "lap times in seconds", "game scores"]);
    return {
      stimulus: spin(rng, `Four of five ${ctx} are ${nums[0]}, ${nums[1]}, ${nums[2]}, and ${nums[3]}. The mean of all five values is ${mean}.`),
      question: spin(rng, `[[What is the difference between the greatest and the least of the five values?|What is the range of the five values?]]`), correct: ans,
      wrongs: [W(x, "step_missing", "빠진 값만 답했다."), W(Math.max(...nums) - Math.min(...nums), "step_missing", "빠진 값을 포함하지 않고 범위를 구했다."), W(Math.round(Math.abs(x - mean)), "formula_misuse", "평균과 빠진 값의 차를 답했다."), W(ans + 1, "other", "계산 실수."), W(Math.max(...all), "step_missing", "최댓값을 답했다.")],
      verificationJs: withParams({ a: nums[0], b: nums[1], c: nums[2], d: nums[3], mean }, "let fifth=null; for(let x=0;x<=300;x++){ if((P.a+P.b+P.c+P.d+x)/5===P.mean) fifth=x; }\nif(fifth===null) throw new Error('없음'); const all=[P.a,P.b,P.c,P.d,fifth]; return Math.max(...all)-Math.min(...all);"),
      trace: [T(`평균이 ${mean} 이므로 다섯 값의 합은 5 × ${mean} = ${5 * mean} 이다.`, "Total of five values."), T(`알려진 네 값의 합은 ${nums.reduce((a, b) => a + b, 0)} 이다.`, "Sum of the known values."), T(`빠진 값은 ${5 * mean} − ${nums.reduce((a, b) => a + b, 0)} = ${x} 이다.`, "Find the missing value."), T(`다섯 값은 ${all.join(", ")} 이다.`, "List all values."), T(`최댓값 ${Math.max(...all)} 에서 최솟값 ${Math.min(...all)} 를 뺀 ${ans} 이다.`, "Compute the range.")],
    };
  },
  bill_split_join_original_share: (rng) => {
    const n = rng.int(3, 9), e = rng.int(2, 9); const tot = e * n * (n + 1); const share = e * (n + 1); if (tot > 900) throw new GenFail("x");
    const ev = rng.pick(["a dinner bill", "a cabin rental", "a group gift", "a boat charter"]);
    return {
      stimulus: spin(rng, `${n} friends planned to split the cost of ${ev} equally. Then 1 more friend joined, and the cost was split equally among all ${n + 1} people, which lowered each person's share by ${e} dollars.`),
      question: spin(rng, `[[What was each of the original ${n} friends going to pay, in dollars?|How many dollars was each person's share before the extra friend joined?]]`), correct: share,
      wrongs: [W(tot, "step_missing", "총액을 답했다."), W(share - e, "step_missing", "새 분담액을 답했다."), W(e * n, "formula_misuse", "차이에 원래 인원만 곱했다."), W(share + e, "other", "계산 실수."), W(Math.round(tot / (n + 2)), "other", "인원 수를 잘못 셌다.")],
      verificationJs: withParams({ n, e }, "let ans=-1; for(let T=1;T<=2000;T++){ if(T/P.n-T/(P.n+1)===P.e) ans=T/P.n; }\nif(ans<0) throw new Error('없음'); return ans;"),
      trace: [T(`총액을 T 라 하면 원래 분담액은 T/${n} 이다.`, "Original share."), T(`한 명이 더 오면 분담액은 T/${n + 1} 이다.`, "New share."), T(`T/${n} − T/${n + 1} = ${e} 이다.`, "Equation for the drop in the share."), T(`T = ${e} × ${n} × ${n + 1} = ${tot} 이다.`, "Solve for the total."), T(`원래 분담액은 ${tot} ÷ ${n} = ${share} 달러이다.`, "Original share.")],
    };
  },
  two_speed_total_hours: (rng) => {
    const v = rng.int(35, 55), h1 = rng.int(2, 4), dv = rng.pick([5, 10, 15]), x = rng.int(1, 4); const D = v * h1 + (v + dv) * x; if (D > 990) throw new GenFail("x"); const ans = h1 + x;
    const veh = rng.pick(["a delivery truck", "a rental car", "a charter bus", "a motorcycle"]);
    return {
      stimulus: spin(rng, `${veh[0].toUpperCase() + veh.slice(1)} travels ${h1} hours at ${v} miles per hour, then speeds up by ${dv} miles per hour and keeps that new speed until the whole trip reaches ${D} miles.`),
      question: spin(rng, `[[How many hours does the whole trip take?|What is the total driving time, in hours?]]`), correct: ans,
      wrongs: [W(x, "step_missing", "둘째 구간의 시간만 답했다."), W(Math.round(D / v), "step_missing", "처음 속력으로만 계산했다."), W(Math.round(D / (v + dv)), "step_missing", "나중 속력으로만 계산했다."), W(ans + 1, "other", "계산 실수."), W(Math.round(h1 + (D - v * h1) / v), "formula_misuse", "둘째 구간에도 처음 속력을 썼다.")].filter((w) => Number.isInteger(w.v)),
      verificationJs: withParams({ v, h1, dv, D }, "let ans=-1; for(let x=1;x<=100;x++){ if(P.v*P.h1+(P.v+P.dv)*x===P.D) ans=P.h1+x; }\nif(ans<0) throw new Error('없음'); return ans;"),
      trace: [T(`처음 구간의 거리는 ${v} × ${h1} = ${v * h1} mi 이다.`, "First leg distance."), T(`남은 거리는 ${D} − ${v * h1} = ${D - v * h1} mi 이다.`, "Distance left."), T(`나중 속력은 ${v} + ${dv} = ${v + dv} mph 이다.`, "Second speed."), T(`그 구간의 시간은 ${D - v * h1} ÷ ${v + dv} = ${x} 시간이다.`, "Second leg time."), T(`전체 시간은 ${h1} + ${x} = ${ans} 시간이다.`, "Total time.")],
    };
  },
};

// ───────── compose_kind: 방정식이 기하·백분율·연속수·유속 같은 다른 개념과 합성 ─────────
const COMP: Record<string, VFn> = {
  angle_sum_triangle_largest: (rng) => {
    const x0 = rng.int(5, 30), a1 = rng.int(1, 4), a2 = rng.int(1, 4), a3 = rng.int(1, 4); const s = a1 + a2 + a3; const rest = 180 - s * x0; const b1 = rng.int(-15, 20); const b2 = rng.int(-15, 20); const b3 = rest - b1 - b2; if (Math.abs(b3) > 40 || b1 === 0 || b2 === 0 || b3 === 0 || (a1 === a2 && a2 === a3)) throw new GenFail("x"); const angs = [a1 * x0 + b1, a2 * x0 + b2, a3 * x0 + b3]; if (angs.some((v) => v <= 10)) throw new GenFail("x"); const ans = Math.max(...angs);
    if (angs.filter((v) => v === ans).length > 1) throw new GenFail("x");
    return {
      stimulus: spin(rng, `The three interior angles of a triangle measure ${M(`(${lin(a1, b1)})^\\circ`)}, ${M(`(${lin(a2, b2)})^\\circ`)}, and ${M(`(${lin(a3, b3)})^\\circ`)}.`),
      question: spin(rng, `[[What is the measure, in degrees, of the largest angle?|What is the degree measure of the greatest angle of the triangle?]]`), correct: ans,
      wrongs: [W(x0, "step_missing", "x 의 값만 답했다."), W(Math.min(...angs), "other", "가장 작은 각을 답했다."), W(180 - ans, "other", "나머지 두 각의 합을 답했다."), W(Math.max(a1, a2, a3) * x0, "step_missing", "상수항을 더하지 않았다."), W(ans + x0, "other", "계산 실수.")],
      verificationJs: withParams({ a1, b1, a2, b2, a3, b3 }, "let best=-1; for(let x=1;x<=179;x++){ const A=P.a1*x+P.b1, B=P.a2*x+P.b2, C=P.a3*x+P.b3; if(A+B+C===180 && A>0 && B>0 && C>0) best=Math.max(A,B,C); }\nif(best<0) throw new Error('없음'); return best;"),
      trace: [T("삼각형의 세 내각의 합은 180° 이다.", "Interior angles sum to 180."), T(`${lin(a1, b1)} + ${lin(a2, b2)} + ${lin(a3, b3)} = 180 이다.`, "Set up the equation."), T(`동류항을 모으면 ${s}x + ${b1 + b2 + b3} = 180 이다.`, "Combine like terms."), T(`x = ${x0} 이다.`, "Solve for x."), T(`세 각은 ${angs.join("°, ")}° 이고 가장 큰 각은 ${ans}° 이다.`, "Largest angle.")],
    };
  },
  discount_then_coupon_original: (rng) => {
    const dd = rng.pick([20, 25, 30, 40]), c = rng.int(3, 15), Pr = rng.pick([40, 60, 80, 100, 120, 140, 160, 200, 240]); const F = (Pr * (100 - dd)) / 100 - c; if (!Number.isInteger(F) || F <= 5) throw new GenFail("x");
    const item = rng.pick(["a jacket", "a pair of boots", "a backpack", "a desk lamp", "a tablet case"]);
    return {
      stimulus: spin(rng, `A store takes ${dd}% off the listed price of ${item}. A customer then uses a coupon worth ${c} dollars on the discounted price and pays ${F} dollars in total.`),
      question: spin(rng, `[[What was the listed price, in dollars, before any discount?|What is the original price of ${item}, in dollars?]]`), correct: Pr,
      wrongs: [W(F + c, "step_missing", "할인가를 답했다(비율 할인을 되돌리지 않음)."), W(Math.round(((F + c) * (100 + dd)) / 100), "formula_misuse", "할인율만큼 그대로 더해 되돌렸다."), W(Math.round((F * 100) / (100 - dd)), "step_missing", "쿠폰을 먼저 더하지 않았다."), W(F + c + Math.round(((F + c) * dd) / 100), "formula_misuse", "할인액을 할인가의 비율로 계산했다."), W(Math.round(F / ((100 - dd) / 100)) + c, "sign_error", "쿠폰을 마지막에 더했다.")],
      verificationJs: withParams({ dd, c, F }, "let ans=-1; for(let p=1;p<=600;p++){ const f=p*(100-P.dd)/100-P.c; if(Math.abs(f-P.F)<1e-9) ans=p; }\nif(ans<0) throw new Error('없음'); return ans;"),
      trace: [T(`정가를 p 라 하면 ${dd}% 할인가는 ${(100 - dd) / 100}p 이다.`, "Discounted price."), T(`쿠폰 ${c} 달러를 빼면 ${(100 - dd) / 100}p − ${c} 이다.`, "Apply the coupon."), T(`${(100 - dd) / 100}p − ${c} = ${F} 이다.`, "Set the final price."), T(`${(100 - dd) / 100}p = ${F + c} 이다.`, "Isolate."), T(`p = ${Pr} 달러이다.`, "Solve.")],
    };
  },
  consecutive_multiples_sum_largest: (rng) => {
    const m = rng.pick([4, 6, 7, 9, 12]), mid = rng.int(3, 20) * m; const S = 3 * mid; if (S > 990) throw new GenFail("x"); const ans = mid + m;
    return {
      stimulus: spin(rng, `The sum of three consecutive multiples of ${m} is ${S}.`),
      question: spin(rng, `[[What is the largest of the three multiples?|What is the greatest of these three numbers?]]`), correct: ans,
      wrongs: [W(mid, "other", "가운데 수를 답했다."), W(mid - m, "other", "가장 작은 수를 답했다."), W(Math.round(S / 3) + 1, "formula_misuse", "연속 정수처럼 1 만 더했다."), W(S / 3 + 2 * m, "other", "공차를 두 배로 더했다."), W(Math.round(S / m), "step_missing", "배수 번호를 답했다.")],
      verificationJs: withParams({ m, S }, "let ans=-1; for(let k=1;k<=400;k++){ const a=k*P.m, b=(k+1)*P.m, c=(k+2)*P.m; if(a+b+c===P.S) ans=c; }\nif(ans<0) throw new Error('없음'); return ans;"),
      trace: [T(`가운데 수를 n 이라 하면 세 수는 n − ${m}, n, n + ${m} 이다.`, "Name the three multiples."), T(`합은 3n = ${S} 이다.`, "Their sum."), T(`n = ${S / 3} 이다.`, "Solve for the middle one."), T(`가장 큰 수는 n + ${m} 이다.`, "Largest multiple."), T(`${mid} + ${m} = ${ans} 이다.`, "Compute.")],
    };
  },
  isosceles_perimeter_base: (rng) => {
    const x0 = rng.int(3, 15), a = rng.int(1, 4), b = rng.int(-6, 8), c = rng.int(1, 4), d = rng.int(-6, 10); const Pm = 2 * (a * x0 + b) + (c * x0 + d); const eq = a * x0 + b, base = c * x0 + d; if (eq <= 0 || base <= 0 || b === 0 || d === 0 || base >= 2 * eq || eq === base || Pm > 200) throw new GenFail("x");
    return {
      stimulus: spin(rng, `An isosceles triangle has two equal sides, each ${M(lin(a, b))} centimeters long, and a base that is ${M(lin(c, d))} centimeters long. Its perimeter is ${Pm} centimeters.`),
      question: spin(rng, `[[What is the length of the base, in centimeters?|How long is the base of the triangle, in centimeters?]]`), correct: base,
      wrongs: [W(eq, "other", "같은 변의 길이를 답했다."), W(x0, "step_missing", "x 의 값만 답했다."), W(Pm - 2 * eq, "other", "계산 실수."), W(Pm - eq, "formula_misuse", "같은 변을 한 번만 뺐다."), W(c * x0, "step_missing", "상수항을 더하지 않았다.")].filter((w) => w.v !== base),
      verificationJs: withParams({ a, b, c, d, Pm }, "let ans=-1; for(let x=1;x<=300;x++){ const s=P.a*x+P.b, bs=P.c*x+P.d; if(s>0&&bs>0&&2*s+bs===P.Pm) ans=bs; }\nif(ans<0) throw new Error('없음'); return ans;"),
      trace: [T(`둘레는 같은 변 두 개와 밑변의 합이다.`, "Perimeter is the sum of the sides."), T(`2(${lin(a, b)}) + (${lin(c, d)}) = ${Pm} 이다.`, "Set up the equation."), T(`정리하면 ${2 * a + c}x + ${2 * b + d} = ${Pm} 이다.`, "Simplify."), T(`x = ${x0} 이다.`, "Solve."), T(`밑변은 ${c} × ${x0} + ${d} = ${base} cm 이다.`, "Evaluate the base.")],
    };
  },
  boat_current_distance: (rng) => {
    const c = rng.int(1, 4), t1 = rng.int(2, 5), t2 = t1 + rng.int(1, 3); const s = (c * (t1 + t2)) / (t2 - t1); if (!Number.isInteger(s) || s <= c + 1 || s > 30) throw new GenFail("x"); const ans = (s + c) * t1;
    const [a, b] = rng.pick([["Harbor Point", "Cedar Landing"], ["North Dock", "South Dock"], ["Mill Town", "Reed Bay"], ["Fort Island", "Pine Cove"]]);
    return {
      stimulus: spin(rng, `A river current flows at ${c} miles per hour. A boat that holds a constant speed in still water goes downstream from ${a} to ${b} in ${t1} hours and returns upstream along the same route in ${t2} hours.`),
      question: spin(rng, `[[What is the distance, in miles, between ${a} and ${b}?|How many miles apart are ${a} and ${b}?]]`), correct: ans,
      wrongs: [W(s, "step_missing", "정수 속력만 답했다."), W(s * t1, "formula_misuse", "유속을 더하지 않았다."), W((s - c) * t1, "sign_error", "하류에서 유속을 뺐다."), W(ans + c, "other", "계산 실수."), W(Math.round(((s + c) * t1 + (s - c) * t2) / 2), "formula_misuse", "두 거리를 평균했다.")].filter((w) => w.v !== ans),
      verificationJs: withParams({ c, t1, t2 }, "let ans=-1; for(let s=P.c+1;s<=100;s++){ const d1=(s+P.c)*P.t1, d2=(s-P.c)*P.t2; if(d1===d2) ans=d1; }\nif(ans<0) throw new Error('없음'); return ans;"),
      trace: [T(`배의 정수 속력을 s 라 하면 하류는 s + ${c}, 상류는 s − ${c} 이다.`, "Speeds with and against the current."), T(`거리는 같으므로 (s + ${c}) × ${t1} = (s − ${c}) × ${t2} 이다.`, "Distances are equal."), T(`${t1}s + ${c * t1} = ${t2}s − ${c * t2} 이다.`, "Expand."), T(`s = ${s} mph 이다.`, "Solve for the boat speed."), T(`거리는 (${s} + ${c}) × ${t1} = ${ans} mi 이다.`, "Distance.")],
    };
  },
};

export const LE1_SPR_B_ARCHETYPES = [
  multi({ id: "leb.equation_applications.param_condition", skill: SKILL, kind: KIND, operator: "param_condition", structure: "방정식의 상수·매개변수가 해의 정수성·부호·값·절댓값 해의 합 같은 성질을 정하는 5가지 조건 문제", extraThinking: "해의 성질(정수성·부호·동일성)을 매개변수 조건으로 번역해야 함 — medium 은 상수를 알고 해를 직접 구함", concepts: ["일차방정식", "매개변수 조건", "정수·부호 조건"], mediumSteps: 2, variants: PARAM }),
  multi({ id: "leb.equation_applications.inverse", skill: SKILL, kind: KIND, operator: "inverse", structure: "결과(총합·남은 양·같은 둘레)에서 시작량·개수를 거꾸로 구하는 5가지 방정식 설정", extraThinking: "결과를 주고 시작 수량을 식으로 세워 역산해야 하는 역문제 — medium 은 시작 수량을 알고 결과를 계산", concepts: ["방정식 모델링", "역연산", "단위·구성 해석"], mediumSteps: 2, variants: INV }),
  multi({ id: "leb.equation_applications.chain2", skill: SKILL, kind: KIND, operator: "chain2", structure: "앞 방정식의 해가 뒤 단계 계산의 입력이 되는 5가지 2단계 연쇄(초과근무·온도·평균·분담·구간 속력)", extraThinking: "방정식을 풀어 얻은 값을 다시 다른 양의 계산에 넣는 연쇄 — medium 은 방정식 하나의 해", concepts: ["방정식 풀이", "연쇄 계산", "식 설정"], mediumSteps: 2, variants: CHAIN }),
  multi({ id: "leb.equation_applications.compose_kind", skill: SKILL, kind: KIND, operator: "compose_kind", structure: "일차방정식이 삼각형 각·할인율·연속 배수·이등변 둘레·유속과 합성되는 5가지 장면", extraThinking: "다른 개념의 성질을 식으로 옮겨 일차방정식으로 합성해 푸는 구조 — medium 은 순수한 식 풀이", concepts: ["일차방정식", "도형·백분율·속도 개념", "식 합성"], mediumSteps: 2, variants: COMP }),
];
