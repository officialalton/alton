// systems_linear — SPR 독립 그룹 보강(G10): 연립일차방정식 응용 hard 원형 4개 × 변형 16개(변형 하나 = 유사문항 그룹 하나). 금액은 dollars 로 쓴다.
import { GenFail, T, W, multi, type VFn } from "../spr-groups-b-kit";
import { spin, withParams, M } from "../text";

const SKILL = "systems_linear", KIND = "system_applications";
const gcd2 = (a: number, b: number): number => (b ? gcd2(b, a % b) : a);

// ───────── inverse: 결과(합·차·비·배수)를 주고 원래 수·나이를 역으로 ─────────
const INV: Record<string, VFn> = {
  digit_number_reversal: (rng) => {
    const a = rng.int(2, 9), b = rng.int(1, a - 1); const s = a + b, d = 9 * (a - b), n = 10 * a + b; if (a - b < 2) throw new GenFail("x");
    return {
      stimulus: spin(rng, `A two-digit positive integer has digits that add up to ${s}. When its digits are reversed, the new number is ${d} less than the original number.`),
      question: spin(rng, `[[What is the original number?|What is the two-digit integer?]]`), correct: n,
      wrongs: [W(10 * b + a, "other", "자리를 뒤집은 수를 답했다."), W(a - b, "step_missing", "자릿수의 차만 답했다."), W(s, "step_missing", "자릿수의 합만 답했다."), W(n + 9, "other", "계산 실수."), W(a * b, "formula_misuse", "자릿수의 곱을 답했다.")],
      verificationJs: withParams({ s, d }, "let ans=-1, cnt=0; for(let n=10;n<=99;n++){ const t=Math.floor(n/10), u=n%10; const rev=10*u+t; if(t+u===P.s && n-rev===P.d){ ans=n; cnt++; } }\nif(cnt!==1) throw new Error('유일하지 않음'); return ans;"),
      trace: [T(`십의 자리를 t, 일의 자리를 u 라 하면 t + u = ${s} 이다.`, "Let t and u be the digits."), T(`원래 수는 10t + u, 뒤집은 수는 10u + t 이다.`, "Write both numbers."), T(`차는 (10t + u) − (10u + t) = 9(t − u) = ${d} 이다.`, "Difference of the numbers."), T(`t − u = ${a - b} 이다.`, "Divide by 9."), T(`t = ${a}, u = ${b} 이므로 원래 수는 ${n} 이다.`, "Solve the system.")],
    };
  },
  age_multiple_now_and_later: (rng) => {
    const k = rng.int(3, 6), m2 = rng.int(2, k - 1), y = rng.int(2, 20); const num = y * (m2 - 1), den = k - m2; if (num % den !== 0) throw new GenFail("x"); const S = num / den; if (S < 4 || S > 40) throw new GenFail("x"); const ans = k * S;
    const [p, c] = rng.pick([["Mr. Alvarez", "his daughter"], ["Ms. Chen", "her son"], ["Coach Reyes", "his nephew"], ["Dr. Okafor", "her niece"]]);
    return {
      stimulus: spin(rng, `${p} is ${k} times as old as ${c}. In ${y} years, ${p.startsWith("Mr.") || p.startsWith("Coach") || p.startsWith("Dr.") ? "the older person" : "the older person"} will be ${m2} times as old as ${c} will be then.`),
      question: spin(rng, `[[How old is the older person now?|What is the older person's current age, in years?]]`), correct: ans,
      wrongs: [W(S, "other", "어린 사람의 나이를 답했다."), W(ans + y, "other", `${y} 년 뒤 나이를 답했다.`), W(k * (S + y), "formula_misuse", "미래 나이에 현재 배수를 곱했다."), W(S + ans, "other", "나이의 합을 답했다."), W(m2 * S, "formula_misuse", "배수를 서로 바꿨다.")],
      verificationJs: withParams({ k, m2, y }, "let ans=-1; for(let s=1;s<=100;s++){ const p=P.k*s; if(p+P.y===P.m2*(s+P.y)) ans=p; }\nif(ans<0) throw new Error('없음'); return ans;"),
      trace: [T(`어린 사람의 나이를 s 라 하면 어른은 ${k}s 이다.`, "Name the ages."), T(`${y} 년 뒤 어른은 ${k}s + ${y}, 어린 사람은 s + ${y} 이다.`, "Ages in the future."), T(`${k}s + ${y} = ${m2}(s + ${y}) 이다.`, "Set up the second equation."), T(`${k - m2}s = ${y * (m2 - 1)} 이므로 s = ${S} 이다.`, "Solve for s."), T(`어른의 나이는 ${k} × ${S} = ${ans} 이다.`, "Older person's age.")],
    };
  },
  ratio_and_difference: (rng) => {
    const p = rng.int(2, 7), q = rng.int(p + 1, 9), k = rng.int(2, 12), a = rng.int(2, 6), b = rng.int(1, 5); const c = a * p * k - b * q * k; if (c <= 0 || c > 200 || p === 1 || q % p === 0) throw new GenFail("x"); const ans = (p + q) * k;
    return {
      stimulus: spin(rng, `Two positive numbers x and y are in the ratio ${p} to ${q}, so that x : y = ${p} : ${q}. They also satisfy ${M(`${a}x - ${b}y = ${c}`)}.`),
      question: spin(rng, `[[What is the value of x + y?|What is the sum of the two numbers?]]`), correct: ans,
      wrongs: [W(p * k, "other", "x 의 값만 답했다."), W(q * k, "other", "y 의 값만 답했다."), W(c, "step_missing", "주어진 상수를 답했다."), W(ans + k, "other", "계산 실수."), W(Math.round((c * (p + q)) / (a * p + b * q)), "formula_misuse", "차 대신 합으로 계산했다.")],
      verificationJs: withParams({ p, q, a, b, c }, "let ans=-1; for(let x=1;x<=1000;x++){ for(let y=1;y<=1000;y++){ if(x*P.q===y*P.p && P.a*x-P.b*y===P.c) ans=x+y; } }\nif(ans<0) throw new Error('없음'); return ans;"),
      trace: [T(`비가 ${p} : ${q} 이므로 x = ${p}k, y = ${q}k 로 둔다.`, "Parametrize the ratio."), T(`${a}(${p}k) − ${b}(${q}k) = ${c} 이다.`, "Substitute."), T(`${a * p - b * q}k = ${c} 이다.`, "Simplify."), T(`k = ${k} 이다.`, "Solve for k."), T(`x + y = (${p} + ${q}) × ${k} = ${ans} 이다.`, "Sum.")],
    };
  },
  sum_diff_then_product: (rng) => {
    const x = rng.int(6, 40), y = rng.int(2, x - 2), s = x + y, d = x - y; if (s > 90 || d < 2) throw new GenFail("x"); const ans = x * y;
    return {
      stimulus: spin(rng, `The sum of two positive numbers is ${s}, and the larger number exceeds the smaller number by ${d}.`),
      question: spin(rng, `[[What is the product of the two numbers?|What do you get when the two numbers are multiplied?]]`), correct: ans,
      wrongs: [W(x, "other", "큰 수만 답했다."), W(y, "other", "작은 수만 답했다."), W(Math.round((s * s) / 4), "formula_misuse", "두 수가 같다고 가정했다."), W(x * x - y * y, "formula_misuse", "제곱의 차를 답했다."), W(ans + x, "other", "계산 실수.")],
      verificationJs: withParams({ s, d }, "let ans=-1; for(let a=1;a<=200;a++){ for(let b=1;b<=200;b++){ if(a+b===P.s && a-b===P.d) ans=a*b; } }\nif(ans<0) throw new Error('없음'); return ans;"),
      trace: [T(`큰 수를 a, 작은 수를 b 라 하면 a + b = ${s}, a − b = ${d} 이다.`, "Write the system."), T(`두 식을 더하면 2a = ${s + d} 이다.`, "Add the equations."), T(`a = ${x} 이다.`, "Larger number."), T(`b = ${s} − ${x} = ${y} 이다.`, "Smaller number."), T(`곱은 ${x} × ${y} = ${ans} 이다.`, "Product.")],
    };
  },
};

// ───────── compose_kind: 연립방정식이 기하·속도·평균·이자와 합성 ─────────
const COMP: Record<string, VFn> = {
  triangle_area_from_lines: (rng) => {
    const p = rng.int(2, 9), q = rng.int(2, 8), a1 = rng.pick([1, 2, 3]), b1 = rng.pick([1, 2, 3]), a2 = rng.pick([1, 2, 3, 4]), b2 = rng.pick([-1, -2, -3, 1]); const c1 = a1 * p + b1 * q, c2 = a2 * p + b2 * q; if (c1 % a1 !== 0 || c2 % a2 !== 0 || c2 <= 0 || a1 * b2 === a2 * b1) throw new GenFail("x"); const r1 = c1 / a1, r2 = c2 / a2; const area2 = Math.abs(r1 - r2) * q; if (area2 % 2 !== 0 || r1 === r2) throw new GenFail("x"); const area = area2 / 2; if (area < 3 || area > 150) throw new GenFail("x");
    const eq = (a: number, b: number, c: number) => `${a === 1 ? "" : a}x ${b < 0 ? "-" : "+"} ${Math.abs(b) === 1 ? "" : Math.abs(b)}y = ${c}`;
    return {
      stimulus: spin(rng, `The lines ${M(eq(a1, b1, c1))} and ${M(eq(a2, b2, c2))} intersect at a point above the x-axis. The two lines and the x-axis form a triangle.`),
      question: spin(rng, `[[What is the area of the triangle, in square units?|Find the area of the triangle in square units.]]`), correct: area,
      wrongs: [W(area2, "formula_misuse", "1/2 를 곱하지 않았다."), W(q, "step_missing", "교점의 y 좌표만 답했다."), W(Math.abs(r1 - r2), "step_missing", "밑변의 길이만 답했다."), W(Math.round(((Math.abs(r1 - r2) + q) * 1) / 2) + 1, "other", "계산 실수."), W(Math.round(Math.abs(r1 - r2) * p / 2) || 1, "other", "높이에 x 좌표를 썼다.")],
      verificationJs: withParams({ a1, b1, c1, a2, b2, c2 }, "let pt=null; for(let x=-60;x<=60;x++){ for(let y=1;y<=60;y++){ if(P.a1*x+P.b1*y===P.c1 && P.a2*x+P.b2*y===P.c2) pt=[x,y]; } }\nif(!pt) throw new Error('교점 없음'); const x1=P.c1/P.a1, x2=P.c2/P.a2; return Math.abs(x1-x2)*pt[1]/2;"),
      trace: [T("두 직선의 방정식을 연립해 교점을 구한다.", "Solve the system for the intersection point."), T(`교점은 (${p}, ${q}) 이다.`, "The intersection point."), T(`x 축과의 교점은 y = 0 을 대입해 ${r1} 와 ${r2} 이다.`, "The x-intercepts."), T(`밑변은 |${r1} − ${r2}| = ${Math.abs(r1 - r2)}, 높이는 ${q} 이다.`, "Base and height."), T(`넓이는 ${Math.abs(r1 - r2)} × ${q} ÷ 2 = ${area} 이다.`, "Area.")],
    };
  },
  wind_two_legs_airspeed: (rng) => {
    const s = rng.int(120, 300), c = rng.int(10, 50), t1 = rng.int(2, 4), t2 = rng.int(2, 5); const D1 = (s + c) * t1, D2 = (s - c) * t2; if (D1 > 990 || D2 > 990 || D1 === D2 || t1 === t2) throw new GenFail("x");
    return {
      stimulus: spin(rng, `A small plane flies ${D1} miles with a tailwind in ${t1} hours. On another leg, it flies ${D2} miles directly against the same constant wind in ${t2} hours. The plane's airspeed and the wind speed are both constant.`),
      question: spin(rng, `[[What is the airspeed of the plane, in miles per hour?|What is the plane's speed in still air, in miles per hour?]]`), correct: s,
      wrongs: [W(D1 / t1, "step_missing", "순풍 때의 속력을 답했다."), W(D2 / t2, "step_missing", "맞바람 때의 속력을 답했다."), W(c, "other", "바람의 속력을 답했다."), W(s + 2 * c, "sign_error", "부호를 반대로 적용했다."), W(Math.round((D1 + D2) / (t1 + t2)), "formula_misuse", "전체 거리를 전체 시간으로 나눴다.")],
      verificationJs: withParams({ D1, t1, D2, t2 }, "let ans=-1; for(let s=1;s<=1000;s++){ for(let c=1;c<s;c++){ if((s+c)*P.t1===P.D1 && (s-c)*P.t2===P.D2) ans=s; } }\nif(ans<0) throw new Error('없음'); return ans;"),
      trace: [T(`비행기 속력을 s, 바람 속력을 w 라 하면 순풍은 s + w, 맞바람은 s − w 이다.`, "Speeds with and against the wind."), T(`${D1} ÷ ${t1} = ${D1 / t1} 이므로 s + w = ${D1 / t1} 이다.`, "Tailwind leg."), T(`${D2} ÷ ${t2} = ${D2 / t2} 이므로 s − w = ${D2 / t2} 이다.`, "Headwind leg."), T(`두 식을 더하면 2s = ${D1 / t1 + D2 / t2} 이다.`, "Add the equations."), T(`s = ${s} mph 이다.`, "Airspeed.")],
    };
  },
  weighted_class_average_group_size: (rng) => {
    const a = rng.int(78, 95), b = rng.int(55, a - 8), n = rng.int(20, 40); const nA = rng.int(5, n - 5); const m = (a * nA + b * (n - nA)) / n; if (!Number.isInteger(m)) throw new GenFail("x");
    const grp = rng.pick(["students", "athletes", "applicants", "volunteers"]);
    return {
      stimulus: spin(rng, `A group of ${n} ${grp} is made up of two teams. The first team's mean score is ${a}, the second team's mean score is ${b}, and the mean score of all ${n} ${grp} together is ${m}.`),
      question: spin(rng, `[[How many ${grp} are on the first team?|What is the number of ${grp} on the first team?]]`), correct: nA,
      wrongs: [W(n - nA, "other", "둘째 팀의 인원을 답했다."), W(Math.round(n / 2), "formula_misuse", "두 팀이 같은 크기라고 가정했다."), W(Math.round((n * (m - b)) / (a + b)), "formula_misuse", "평균의 합으로 나눴다."), W(nA + 1, "other", "계산 실수."), W(Math.round((m - b) * n / a), "formula_misuse", "분모에 평균 차가 아닌 값을 썼다.")],
      verificationJs: withParams({ a, b, n, m }, "let ans=-1; for(let k=1;k<P.n;k++){ if(P.a*k+P.b*(P.n-k)===P.m*P.n) ans=k; }\nif(ans<0) throw new Error('없음'); return ans;"),
      trace: [T(`첫 팀 인원을 k 라 하면 둘째 팀은 ${n} − k 이다.`, "Name the team sizes."), T(`전체 점수 합은 ${m} × ${n} = ${m * n} 이다.`, "Total score from the overall mean."), T(`${a}k + ${b}(${n} − k) = ${m * n} 이다.`, "Set up the weighted sum."), T(`${a - b}k = ${m * n - b * n} 이다.`, "Simplify."), T(`k = ${nA} 이다.`, "Solve.")],
    };
  },
  two_rates_investment: (rng) => {
    const Tt = rng.pick([300, 400, 500, 600, 700, 800]), x6 = rng.pick([100, 150, 200, 250, 300, 350, 400]); if (x6 >= Tt) throw new GenFail("x"); const I = ((Tt - x6) * 4 + x6 * 6) / 100; if (!Number.isInteger(I) || I > 90) throw new GenFail("x");
    const [a, b] = rng.pick([["a savings account", "a bond fund"], ["a credit union account", "a certificate of deposit"], ["a youth savings plan", "a money market account"]]);
    return {
      stimulus: spin(rng, `A family invests a total of ${Tt} dollars, putting part in ${a} that pays 4% simple interest per year and the rest in ${b} that pays 6% simple interest per year. After one year, the total interest earned is ${I} dollars.`),
      question: spin(rng, `[[How many dollars were invested at 6%?|What amount, in dollars, was placed in the 6% investment?]]`), correct: x6,
      wrongs: [W(Tt - x6, "other", "4% 에 투자한 금액을 답했다."), W(Math.round(I / 0.06), "step_missing", "모든 이자가 6% 에서 나왔다고 가정했다."), W(Math.round((I - 0.04 * Tt) / 0.06), "formula_misuse", "이자율 차이 대신 6% 로 나눴다."), W(x6 + 50, "other", "계산 실수."), W(Math.round(Tt / 2), "formula_misuse", "절반씩 투자했다고 가정했다.")],
      verificationJs: withParams({ Tt, I }, "let ans=-1; for(let x=0;x<=P.Tt;x++){ const interest=(P.Tt-x)*4/100 + x*6/100; if(Math.abs(interest-P.I)<1e-9) ans=x; }\nif(ans<0) throw new Error('없음'); return ans;"),
      trace: [T(`6% 에 투자한 금액을 x 라 하면 4% 는 ${Tt} − x 이다.`, "Name the amounts."), T(`이자는 0.04(${Tt} − x) + 0.06x = ${I} 이다.`, "Interest equation."), T(`${0.04 * Tt} + 0.02x = ${I} 이다.`, "Simplify."), T(`0.02x = ${I - 0.04 * Tt} 이다.`, "Isolate."), T(`x = ${x6} 달러이다.`, "Solve.")],
    };
  },
};

// ───────── chain2: 앞 연립의 해가 뒤 계산의 입력 ─────────
const CHAIN: Record<string, VFn> = {
  walk_run_time_split: (rng) => {
    const vw = rng.pick([3, 4, 5]), vr = rng.pick([8, 9, 10, 12]), Tt = rng.int(2, 6), r = rng.int(1, Tt - 1); const D = vw * (Tt - r) + vr * r; if (vr <= vw + 2) throw new GenFail("x"); const ans = vr * r;
    const who = rng.pick(["A student", "A hiker", "A park ranger", "A cross-country trainee"]);
    return {
      stimulus: spin(rng, `${who} covers ${D} miles in ${Tt} hours by alternating between walking at ${vw} miles per hour and running at ${vr} miles per hour. The student walks and runs at constant speeds and never stops.`),
      question: spin(rng, `[[How many miles of the trip are covered by running?|What distance, in miles, is run rather than walked?]]`), correct: ans,
      wrongs: [W(r, "step_missing", "달린 시간만 답했다."), W(vw * (Tt - r), "other", "걸은 거리를 답했다."), W(Math.round((D * vr) / (vw + vr)), "formula_misuse", "속력 비율로 거리를 나눴다."), W(ans + vr, "other", "시간을 하나 더 잡았다."), W(Math.round(D / 2), "formula_misuse", "절반씩 달렸다고 가정했다.")],
      verificationJs: withParams({ vw, vr, Tt, D }, "let ans=-1; for(let r=0;r<=P.Tt;r++){ const w=P.Tt-r; if(P.vw*w+P.vr*r===P.D) ans=P.vr*r; }\nif(ans<0) throw new Error('없음'); return ans;"),
      trace: [T(`달린 시간을 r 이라 하면 걸은 시간은 ${Tt} − r 이다.`, "Name the times."), T(`거리 식: ${vw}(${Tt} − r) + ${vr}r = ${D} 이다.`, "Distance equation."), T(`${vr - vw}r = ${D - vw * Tt} 이다.`, "Simplify."), T(`r = ${r} 시간이다.`, "Solve for the running time."), T(`달린 거리는 ${vr} × ${r} = ${ans} mi 이다.`, "Running distance.")],
    };
  },
  resource_two_machines_units: (rng) => {
    const x = rng.int(5, 30), y = rng.int(5, 30), a1 = rng.int(1, 4), a2 = rng.int(1, 4), b1 = rng.int(1, 4), b2 = rng.int(1, 4); if (a1 * b2 === a2 * b1 || x === y) throw new GenFail("x"); const H1 = a1 * x + b1 * y, H2 = a2 * x + b2 * y; if (H1 > 400 || H2 > 400) throw new GenFail("x");
    const [p, q] = rng.pick([["scooters", "bicycles"], ["tables", "chairs"], ["backpacks", "tote bags"], ["drones", "robots"]]);
    return {
      stimulus: spin(rng, `A workshop makes ${p} and ${q}. Each of the ${p} needs ${a1} hours on the cutting machine and ${a2} hours on the welding machine. Each of the ${q} needs ${b1} hours on the cutting machine and ${b2} hours on the welding machine. This week the cutting machine runs exactly ${H1} hours and the welding machine runs exactly ${H2} hours.`),
      question: spin(rng, `[[How many ${p} are made this week?|What is the number of ${p} produced?]]`), correct: x,
      wrongs: [W(y, "other", `${q} 의 수를 답했다.`), W(x + y, "step_missing", "두 제품의 합을 답했다."), W(Math.round(H1 / a1), "step_missing", `절단 시간을 모두 ${p} 에 썼다.`), W(Math.round(H2 / a2), "step_missing", `용접 시간을 모두 ${p} 에 썼다.`), W(x + 1, "other", "계산 실수.")],
      verificationJs: withParams({ a1, a2, b1, b2, H1, H2 }, "let ans=-1, cnt=0; for(let x=0;x<=500;x++){ for(let y=0;y<=500;y++){ if(P.a1*x+P.b1*y===P.H1 && P.a2*x+P.b2*y===P.H2){ ans=x; cnt++; } } }\nif(cnt!==1) throw new Error('유일하지 않음'); return ans;"),
      trace: [T(`${p} 를 x 대, ${q} 를 y 대 만든다고 하자.`, "Name the unknowns."), T(`절단 기계: ${a1}x + ${b1}y = ${H1} 이다.`, "Cutting-machine equation."), T(`용접 기계: ${a2}x + ${b2}y = ${H2} 이다.`, "Welding-machine equation."), T("한 문자를 소거하도록 두 식에 적당한 수를 곱해 뺀다.", "Eliminate one variable."), T(`x = ${x}, y = ${y} 이므로 ${p} 는 ${x} 대이다.`, "Solve.")],
    };
  },
  two_discount_rates_originals: (rng) => {
    const s = rng.int(2, 9) * 10, h = rng.int(2, 9) * 10; if (s === h) throw new GenFail("x"); const [d1, d2] = rng.pick([[20, 10], [25, 10], [30, 20], [50, 10]] as const); const P1 = s + h, P2 = (s * (100 - d1) + h * (100 - d2)) / 100; if (!Number.isInteger(P2)) throw new GenFail("x");
    const [a, b] = rng.pick([["shirt", "cap"], ["lamp", "rug"], ["novel", "poster"], ["mug", "plate"]]);
    return {
      stimulus: spin(rng, `Before a sale, a ${a} and a ${b} together cost ${P1} dollars. During the sale, the ${a} is marked down ${d1}% and the ${b} is marked down ${d2}%, and the two together cost ${P2} dollars.`),
      question: spin(rng, `[[What was the price of the ${a} before the sale, in dollars?|How many dollars did the ${a} cost before the sale?]]`), correct: s,
      wrongs: [W(h, "other", `${b} 의 원래 가격을 답했다.`), W(Math.round((s * (100 - d1)) / 100), "other", `${a} 의 할인 후 가격을 답했다.`), W(Math.round(P1 / 2), "formula_misuse", "두 물건이 같은 가격이라고 가정했다."), W(P1 - P2, "other", "할인 총액을 답했다."), W(s + 10, "other", "계산 실수.")],
      verificationJs: withParams({ P1, P2, d1, d2 }, "let ans=-1; for(let s=1;s<P.P1;s++){ const h=P.P1-s; if(Math.abs(s*(100-P.d1)/100+h*(100-P.d2)/100-P.P2)<1e-9) ans=s; }\nif(ans<0) throw new Error('없음'); return ans;"),
      trace: [T(`${a} 의 원래 가격을 s, ${b} 는 ${P1} − s 라 한다.`, "Name the original prices."), T(`할인 후 가격은 ${(100 - d1) / 100}s 와 ${(100 - d2) / 100}(${P1} − s) 이다.`, "Sale prices."), T(`${(100 - d1) / 100}s + ${(100 - d2) / 100}(${P1} − s) = ${P2} 이다.`, "Set up the equation."), T(`${((d2 - d1) / 100).toFixed(2)}s + ${(P1 * (100 - d2)) / 100} = ${P2} 이다.`, "Simplify."), T(`s = ${s} 달러이다.`, "Solve.")],
    };
  },
  pairwise_sums_largest: (rng) => {
    const x = rng.int(8, 40), y = rng.int(6, 40), z = rng.int(4, 40); if (new Set([x, y, z]).size < 3) throw new GenFail("x"); const a = x + y, b = y + z, c = x + z; const ans = Math.max(x, y, z);
    const [n1, n2, n3] = rng.pick([["Ana", "Ben", "Cy"], ["Kai", "Lia", "Moe"], ["Rae", "Sol", "Tia"]]);
    return {
      stimulus: spin(rng, `Three friends, ${n1}, ${n2}, and ${n3}, each have a different number of trading cards. ${n1} and ${n2} together have ${a} cards, ${n2} and ${n3} together have ${b} cards, and ${n1} and ${n3} together have ${c} cards.`),
      question: spin(rng, `[[How many cards does the friend with the most cards have?|What is the greatest number of cards held by any one friend?]]`), correct: ans,
      wrongs: [W(Math.max(a, b, c), "other", "가장 큰 두 사람의 합을 답했다."), W((a + b + c) / 2, "other", "세 사람의 합을 답했다."), W(Math.min(x, y, z), "other", "가장 적은 사람의 카드 수를 답했다."), W(Math.round(Math.max(a, b, c) / 2), "formula_misuse", "두 사람이 같다고 가정했다."), W(ans + 1, "other", "계산 실수.")].filter((w) => Number.isInteger(w.v)),
      verificationJs: withParams({ a, b, c }, "let best=-1, cnt=0; for(let x=1;x<=200;x++){ for(let y=1;y<=200;y++){ const z=P.c-x; if(z>0 && x+y===P.a && y+z===P.b){ best=Math.max(x,y,z); cnt++; } } }\nif(cnt!==1) throw new Error('유일하지 않음'); return best;"),
      trace: [T(`세 사람의 카드를 p, q, r 로 두면 p + q = ${a}, q + r = ${b}, p + r = ${c} 이다.`, "Write the three equations."), T(`세 식을 모두 더하면 2(p + q + r) = ${a + b + c} 이다.`, "Add all three."), T(`p + q + r = ${(a + b + c) / 2} 이다.`, "Total of all three."), T(`각 식을 빼면 r = ${(a + b + c) / 2 - a}, p = ${(a + b + c) / 2 - b}, q = ${(a + b + c) / 2 - c} 이다.`, "Subtract each pair sum."), T(`가장 많은 카드는 ${ans} 장이다.`, "Largest value.")],
    };
  },
};

// ───────── param_condition: 매개변수가 해의 존재·정수성·개수를 정함 ─────────
const PARAM: Record<string, VFn> = {
  count_k_unique_solution: (rng) => {
    const s = rng.int(2, 7), pairs: [number, number][] = [[s, s], [1, s * s], [s * s, 1]]; const [a, b] = rng.pick(pairs); const R = rng.int(s + 1, s + 9); const e1 = rng.int(3, 20), e2 = rng.int(3, 20); let cnt = 0; for (let k = -R; k <= R; k++) if (k * k - a * b !== 0) cnt++; if (a * b !== s * s) throw new GenFail("x");
    return {
      stimulus: spin(rng, `Consider the system ${M(`kx + ${a}y = ${e1}`)} and ${M(`${b}x + ky = ${e2}`)}, where k is a constant.`),
      question: spin(rng, `[[For how many integer values of k from ${-R} to ${R}, inclusive, does the system have exactly one solution?|How many integers k in the interval from ${-R} to ${R}, inclusive, give the system exactly one solution?]]`), correct: cnt,
      wrongs: [W(2 * R + 1, "condition_ignored", "모든 k 를 셌다."), W(2 * R - 1 + 2, "condition_ignored", "제외할 k 가 없다고 계산했다."), W(2 * R - 2, "other", "제외할 값을 세 개로 계산했다."), W(2, "other", "해가 없는 k 의 개수를 답했다."), W(R, "other", "양의 k 만 셌다.")].filter((w) => w.v !== cnt),
      verificationJs: withParams({ a, b, R }, "let n=0; for(let k=-P.R;k<=P.R;k++){ const det=k*k-P.a*P.b; if(det!==0) n++; }\nreturn n;"),
      trace: [T("연립방정식이 하나의 해만 가질 조건은 두 직선이 평행하지 않은 것이다.", "A unique solution means the lines are not parallel."), T(`계수 행렬의 판별식은 k·k − ${a}·${b} = k² − ${a * b} 이다.`, "The determinant of the coefficients."), T(`k² − ${a * b} = 0 이면 해가 하나가 아니다.`, "When the determinant is zero there is no unique solution."), T(`k = ±${s} 두 값을 제외해야 한다.`, "Exclude those two values."), T(`범위의 정수 ${2 * R + 1} 개에서 2 개를 빼면 ${cnt} 개이다.`, "Count.")],
    };
  },
  order_difference_notebooks_pens: (rng) => {
    const n = rng.int(4, 12), p = rng.int(1, n - 2); const [a, b] = rng.pick([[5, 2], [4, 1], [3, 2], [5, 3], [4, 3]] as const); const T1 = a * n + b * p, T2 = b * n + a * p; const diff = n - p; if (diff < 2 || T1 > 200 || T2 > 200) throw new GenFail("x");
    const [i1, i2] = rng.pick([["notebooks", "pens"], ["muffins", "coffees"], ["tickets", "snack packs"], ["sandwiches", "juices"]]);
    return {
      stimulus: spin(rng, `One order of ${a} ${i1} and ${b} ${i2} costs ${T1} dollars. Another order of ${b} ${i1} and ${a} ${i2} costs ${T2} dollars. All ${i1} cost the same price each, and all ${i2} cost the same price each.`),
      question: spin(rng, `[[How many more dollars does one of the ${i1.replace(/s$/, "")} items cost than one of the ${i2.replace(/s$/, "")} items?|What is the difference, in dollars, between the price of one ${i1.replace(/s$/, "")} and the price of one ${i2.replace(/s$/, "")}?]]`), correct: diff,
      wrongs: [W(n, "other", "첫째 물건의 가격만 답했다."), W(p, "other", "둘째 물건의 가격만 답했다."), W(T1 - T2, "formula_misuse", "주문 금액의 차를 답했다."), W(n + p, "other", "두 가격의 합을 답했다."), W(Math.round((T1 - T2) / (a + b)), "formula_misuse", "계수의 합으로 나눴다.")].filter((w) => Number.isInteger(w.v)),
      verificationJs: withParams({ a, b, T1, T2 }, "let ans=null; for(let x=1;x<=200;x++){ for(let y=1;y<=200;y++){ if(P.a*x+P.b*y===P.T1 && P.b*x+P.a*y===P.T2) ans=x-y; } }\nif(ans===null) throw new Error('없음'); return ans;"),
      trace: [T(`가격을 x, y 라 하면 ${a}x + ${b}y = ${T1}, ${b}x + ${a}y = ${T2} 이다.`, "Write the two orders as equations."), T("두 식을 서로 빼면 계수가 대칭이므로 x − y 만 남는다.", "Subtracting leaves a multiple of x − y by symmetry."), T(`(${a} − ${b})(x − y) = ${T1} − ${T2} 이다.`, "Factor the difference."), T(`${a - b}(x − y) = ${T1 - T2} 이다.`, "Simplify."), T(`x − y = ${diff} 이다.`, "Divide.")],
    };
  },
  fractional_coefficient_system: (rng) => {
    const a = rng.pick([2, 3, 4]), b = rng.pick([2, 3, 5]), d = rng.pick([2, 3, 4, 6]), e = rng.pick([2, 3, 4, 6]); const lx = (a * d) / gcd2(a, d), ly = (b * e) / gcd2(b, e); const x = lx * rng.int(1, Math.max(1, Math.floor(30 / lx))), y = ly * rng.int(1, Math.max(1, Math.floor(30 / ly))); const c1 = x / a + y / b, c2 = x / d - y / e; if (c2 <= 0 || a === d || b === e || x === y || x < 4) throw new GenFail("x");
    const ans = x;
    return {
      stimulus: spin(rng, `The numbers x and y satisfy ${M(`\\frac{x}{${a}} + \\frac{y}{${b}} = ${c1}`)} and ${M(`\\frac{x}{${d}} - \\frac{y}{${e}} = ${c2}`)}.`),
      question: spin(rng, `[[What is the value of x?|Find x.]]`), correct: ans,
      wrongs: [W(y, "other", "y 의 값을 답했다."), W(c1, "step_missing", "첫째 식의 우변을 답했다."), W(x + y, "other", "합을 답했다."), W(Math.round(c1 * a), "formula_misuse", "다른 항을 무시했다."), W(x + 1, "other", "계산 실수.")],
      verificationJs: withParams({ a, b, d, e, c1, c2 }, "let ans=-1, cnt=0; for(let x=1;x<=300;x++){ for(let y=1;y<=300;y++){ if(Math.abs(x/P.a+y/P.b-P.c1)<1e-9 && Math.abs(x/P.d-y/P.e-P.c2)<1e-9){ ans=x; cnt++; } } }\nif(cnt!==1) throw new Error('유일하지 않음'); return ans;"),
      trace: [T(`첫 식에 ${a * b} 를 곱해 분모를 없앤다: ${b}x + ${a}y = ${c1 * a * b} 이다.`, "Clear the denominators of the first equation."), T(`둘째 식에 ${d * e} 를 곱한다: ${e}x − ${d}y = ${c2 * d * e} 이다.`, "Clear the denominators of the second equation."), T("두 식에서 y 를 소거할 수 있도록 적당한 수를 곱한다.", "Scale to eliminate y."), T("식을 더하거나 빼서 x 의 값을 구한다.", "Add or subtract."), T(`x = ${x} 이다.`, "Answer.")],
    };
  },
  integer_solution_k_count: (rng) => {
    const A = rng.pick([12, 24, 30, 36, 48, 60]), B = rng.int(0, 5); const total = A + B; const x0 = rng.int(1, 3); const R = rng.int(6, 30); const sum = total; let cnt = 0; for (let k = 1; k <= R; k++) if (sum % (k + 1) === 0) cnt++; if (cnt < 3 || cnt > 12) throw new GenFail("x");
    return {
      stimulus: spin(rng, `Consider the system ${M(`kx + y = ${A}`)} and ${M(`x - y = ${B}`)}, where k is a positive integer.`),
      question: spin(rng, `[[For how many positive integers k with k ≤ ${R} is the value of x an integer?|How many values of k, with k a positive integer no greater than ${R}, make x an integer?]]`), correct: cnt,
      wrongs: [W(R, "condition_ignored", "모든 k 를 셌다."), W(cnt + 1, "other", "약수를 하나 더 셌다."), W(Math.max(1, cnt - 1), "other", "약수를 하나 빠뜨렸다."), W([...Array(sum + 1).keys()].filter((d) => d > 0 && sum % d === 0).length, "formula_misuse", "범위 조건을 무시하고 모든 약수를 셌다."), W(cnt + x0, "other", "계산 실수.")].filter((w) => w.v !== cnt),
      verificationJs: withParams({ A, B, R }, "let n=0; for(let k=1;k<=P.R;k++){ const x=(P.A+P.B)/(k+1); if(Number.isInteger(x)) n++; }\nreturn n;"),
      trace: [T("두 식을 더하면 y 가 소거된다: (k + 1)x = " + total + " 이다.", "Add the equations to eliminate y."), T(`x = ${total}/(k + 1) 이다.`, "Solve for x."), T(`x 가 정수이려면 k + 1 이 ${total} 의 약수여야 한다.`, "k + 1 must divide the constant."), T(`2 ≤ k + 1 ≤ ${R + 1} 인 약수를 센다.`, "Count divisors in the allowed range."), T(`${cnt} 개이다.`, "Count.")],
    };
  },
};

export const SL_SPR_B_ARCHETYPES = [
  multi({ id: "slb.system_applications.inverse", skill: SKILL, kind: KIND, operator: "inverse", structure: "합·차·비·배수 조건을 연립방정식으로 세워 원래 수·나이·자리수를 역으로 구하는 4가지 장면", extraThinking: "서로 다른 형태의 조건(자리 뒤집기, 시점이 다른 배수, 비와 일차식)을 연립으로 번역해야 함 — medium 은 식이 주어진 연립 풀이", concepts: ["연립방정식 세우기", "조건 번역", "소거·대입"], mediumSteps: 3, variants: INV }),
  multi({ id: "slb.system_applications.compose_kind", skill: SKILL, kind: KIND, operator: "compose_kind", structure: "연립방정식이 도형의 넓이·바람 속력·가중 평균·이자와 합성되는 4가지 장면", extraThinking: "연립 풀이를 다른 개념(기하·평균·이자)의 계산에 합성해야 함 — medium 은 연립방정식 자체의 풀이", concepts: ["연립방정식", "기하·평균·속도·이자 개념", "식 합성"], mediumSteps: 3, variants: COMP }),
  multi({ id: "slb.system_applications.chain2", skill: SKILL, kind: KIND, operator: "chain2", structure: "앞 연립의 해가 뒤 단계(거리·생산량·할인가·최댓값)의 입력이 되는 4가지 2단계 연쇄", extraThinking: "연립을 풀어 얻은 값에서 다시 묻는 양을 계산하는 연쇄 — medium 은 연립 풀이 한 번", concepts: ["연립 풀이", "연쇄 계산", "문장 모델링"], mediumSteps: 3, variants: CHAIN }),
  multi({ id: "slb.system_applications.param_condition", skill: SKILL, kind: KIND, operator: "param_condition", structure: "연립방정식의 매개변수가 해의 유일성·정수성·대칭 구조를 정하는 4가지 조건 문제", extraThinking: "계수 비교·소거의 구조를 읽어 매개변수 조건을 따져야 함 — medium 은 매개변수를 알고 해를 구함", concepts: ["연립방정식", "계수 조건", "정수·유일해 조건"], mediumSteps: 3, variants: PARAM }),
];
