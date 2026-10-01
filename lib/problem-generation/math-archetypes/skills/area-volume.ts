// area_volume hard 원형 24개(세부 패턴 6 × 연산자 4) + easy/medium 원형(lite). 그림 없이 서술만으로 성립하는 문항만 만든다.
import { GenFail, type Archetype } from "../types";
import { finish, spin, withParams } from "../text";
import { paraArch, sem, withOpen, OPEN_GEO, piOpt, forbidExcept, plural, UP, DOWN } from "../c-kit";
import type { Rng } from "../rng";
import type { LiteArchetype, Level } from "../c-lite";
import type { DistractorKind } from "../../review";

const SKILL = "area_volume";
const W = (v: number, kind: DistractorKind, reason: string) => ({ v, kind, reason });
const UNITS = ["meters", "feet", "centimeters", "inches", "yards"] as const;
const SING: Record<string, string> = { meters: "meter", feet: "foot", centimeters: "centimeter", inches: "inch", yards: "yard" };
const sq = (u: string) => `square ${u}`, cu = (u: string) => `cubic ${u}`;
const RECT = [["garden", "A rectangular garden"], ["room", "A rectangular room"], ["courtyard", "A rectangular courtyard"], ["banner", "A rectangular banner"], ["pond", "A rectangular pond"], ["playground", "A rectangular playground"], ["stage", "A rectangular stage"], ["parking lot", "A rectangular parking lot"], ["patio", "A rectangular patio"], ["wooden deck", "A rectangular wooden deck"], ["lawn", "A rectangular lawn"], ["rooftop terrace", "A rectangular rooftop terrace"], ["tennis court", "A rectangular tennis court"], ["basketball court", "A rectangular basketball court"], ["gym floor", "A rectangular gym floor"], ["classroom", "A rectangular classroom"], ["hallway", "A rectangular hallway"], ["practice field", "A rectangular practice field"], ["flower bed", "A rectangular flower bed"], ["vegetable plot", "A rectangular vegetable plot"], ["picnic lawn", "A rectangular picnic lawn"], ["skate park", "A rectangular skate park"], ["dog run", "A rectangular dog run"], ["pool deck", "A rectangular pool deck"], ["billboard", "A rectangular billboard"], ["poster board", "A rectangular poster board"], ["quilt", "A rectangular quilt"], ["bulletin board", "A rectangular bulletin board"], ["dance floor", "A rectangular dance floor"], ["workshop", "A rectangular workshop"]] as const;
const TANKS = [["aquarium", "An aquarium"], ["water tank", "A water tank"], ["storage bin", "A storage bin"], ["shipping crate", "A shipping crate"], ["fish tank", "A fish tank"], ["planter box", "A planter box"], ["toolbox", "A toolbox"], ["cooler", "A cooler"], ["wooden chest", "A wooden chest"], ["display case", "A display case"], ["terrarium", "A terrarium"], ["sandbox", "A sandbox"], ["garden planter", "A garden planter"], ["compost bin", "A compost bin"], ["feed trough", "A feed trough"], ["packing box", "A packing box"], ["gift box", "A gift box"], ["cargo container", "A cargo container"], ["paint tray", "A paint tray"], ["ice chest", "An ice chest"], ["bread box", "A bread box"], ["jewelry box", "A jewelry box"], ["tool chest", "A tool chest"], ["battery case", "A battery case"], ["pet carrier", "A pet carrier"], ["laundry bin", "A laundry bin"], ["seed tray", "A seed tray"], ["moving box", "A moving box"], ["tackle box", "A tackle box"], ["fuel tank", "A fuel tank"]] as const;
const CANS = [["soup can", "A soup can"], ["paint can", "A paint can"], ["oil drum", "An oil drum"], ["water bucket", "A water bucket"], ["trash can", "A trash can"], ["coffee canister", "A coffee canister"], ["grain silo model", "A grain silo model"], ["tomato can", "A tomato can"], ["popcorn tin", "A popcorn tin"], ["flour canister", "A flour canister"], ["juice can", "A juice can"], ["tennis ball tube", "A tennis ball tube"], ["paint bucket", "A paint bucket"], ["rain barrel", "A rain barrel"], ["thermos", "A thermos"], ["candle", "A candle"], ["pencil cup", "A pencil cup"], ["bean can", "A bean can"], ["tea tin", "A tea tin"], ["cookie tin", "A cookie tin"], ["chalk bucket", "A chalk bucket"], ["salt shaker", "A salt shaker"], ["glue jar", "A glue jar"], ["storage jar", "A storage jar"], ["pasta canister", "A pasta canister"], ["candy jar", "A candy jar"], ["sand pail", "A sand pail"], ["battery pack", "A battery pack"], ["vitamin bottle", "A vitamin bottle"], ["propane tank", "A propane tank"]] as const;
const TRIPLES = [[3, 4, 5], [5, 12, 13], [8, 15, 17], [7, 24, 25], [6, 8, 10], [9, 12, 15], [12, 16, 20], [15, 20, 25], [10, 24, 26], [20, 21, 29]] as const;
const divisors = (n: number) => { const d: number[] = []; for (let i = 1; i <= n; i++) if (n % i === 0) d.push(i); return d; };

export const AV_ARCHETYPES: Archetype[] = ([
  // ───────────── rectangle_area ─────────────
  {
    id: "av.rectangle_area.inverse", skill: SKILL, kind: "rectangle_area", operator: "inverse",
    structure: "직사각형의 넓이 A 와 둘레 P 가 주어졌을 때 합 l+w=P/2 와 곱 lw=A 를 만족하는 두 변을 찾아 더 긴 변을 구함",
    extraThinking: "넓이·둘레에서 가로·세로를 역으로 복원(합과 곱으로부터 두 수 찾기) — medium 은 가로·세로로 넓이 계산",
    concepts: ["직사각형 넓이", "직사각형 둘레", "합과 곱으로 두 수 찾기"], mediumSteps: 1,
    generate(rng) {
      const l = rng.int(4, 40), w = rng.int(2, l - 1); const A = l * w, P = 2 * (l + w); if (A > 990 || l - w < 2 || P > 200) throw new GenFail("x");
      const [nm, who] = rng.pick(RECT); const u = rng.pick(UNITS);
      const stimulus = spin(rng, `${who} has an area of ${A} ${sq(u)} and a perimeter of ${P} ${u}.`);
      const out = finish(rng, {
        stimulus: withOpen(rng, OPEN_GEO, stimulus), question: spin(rng, `[[What is the length of the longer side of the ${nm}, in ${u}?|How long is the longer side of the ${nm}, in ${u}?|Find the length of the longer side of the ${nm}, in ${u}.]]`), correct: l,
        wrongs: [W(w, "other", "더 짧은 변을 답했다."), W(P / 2, "step_missing", "둘레의 절반(l+w)을 답했다."), W(Math.round(Math.sqrt(A)), "formula_misuse", "정사각형이라고 보고 넓이의 제곱근을 답했다."), W(P / 4, "formula_misuse", "두 변이 같다고 보고 둘레를 4 로 나눴다."), W(A / (P / 2), "formula_misuse", "넓이를 반둘레로 나눴다.")],
        verificationJs: withParams({ A, P }, "const out=[];\nfor(let a=1;a<=1000;a++) for(let b=a;b<=1000;b++){ if(a*b===P.A && 2*(a+b)===P.P) out.push(b); }\nif(out.length!==1) throw new Error('유일하지 않음');\nreturn out[0];"),
        trace: [
          [`둘레 ${P} = 2(l + w) 이므로 l + w = ${P / 2} 이다.`, "Half the perimeter gives the sum of the sides."],
          [`넓이 l × w = ${A} 이다.`, "The product of the sides is the area."],
          [`곱이 ${A} 인 두 자연수 쌍을 나열한다.`, "List factor pairs of the area."],
          [`합이 ${P / 2} 인 쌍은 ${w} 와 ${l} 이다.`, "Pick the pair with the right sum."],
          [`더 긴 변은 ${l} ${u} 이다.`, "The longer side."],
        ],
        variant: "frame",
      });
      return sem(out, [{ v: A, words: ["area"] }, { v: P, words: ["perimeter"] }], { words: ["longer"], forbid: forbidExcept("length") });
    },
  },
  {
    id: "av.rectangle_area.compose_kind", skill: SKILL, kind: "rectangle_area", operator: "compose_kind",
    structure: "가로를 p% 늘이고 세로를 q% 줄인 새 직사각형의 넓이와 처음 넓이의 차를 구함(퍼센트 변화와 넓이 합성)",
    extraThinking: "변의 퍼센트 변화를 각각 적용해 넓이로 합성하고 넓이끼리 비교(넓이 변화율은 퍼센트의 단순 합이 아님) — medium 은 가로×세로",
    concepts: ["직사각형 넓이", "퍼센트 증감", "넓이 변화량 비교"], mediumSteps: 1,
    generate(rng) {
      const l = rng.pick([20, 25, 30, 40, 50, 60, 80]), w = rng.pick([10, 20, 25, 30, 40, 50]); const p = rng.pick([10, 20, 25, 50]), q = rng.pick([10, 20, 25, 50]);
      const l2 = (l * (100 + p)) / 100, w2 = (w * (100 - q)) / 100; if (!Number.isInteger(l2) || !Number.isInteger(w2) || l2 * w2 <= l * w || l === w) throw new GenFail("x");
      const [nm, who] = rng.pick(RECT); const u = rng.pick(UNITS); const diff = l2 * w2 - l * w;
      const stimulus = spin(rng, `${who} has a length of ${l} ${u} and a width of ${w} ${u}. The length is [[increased|made longer]] by ${p}%, and the width is [[decreased|made shorter]] by ${q}%.`);
      const out = finish(rng, {
        stimulus: withOpen(rng, OPEN_GEO, stimulus), question: spin(rng, `[[By how many ${sq(u)} is the new area greater than the original area?|The new area is greater than the original area by how many ${sq(u)}?|What is the increase in area, in ${sq(u)}?]]`), correct: diff,
        wrongs: [W(l2 * w2, "step_missing", "새 넓이만 구하고 처음 넓이와의 차를 구하지 않았다."), W((l * w * (p - q)) / 100, "formula_misuse", "넓이 변화율을 (p−q)% 로 계산했다."), W(l * w, "step_missing", "처음 넓이를 답했다."), W((l2 - l) * w + (w2 - w) * l, "formula_misuse", "길이 변화와 너비 변화의 효과를 단순히 더했다."), W(l2 * w2 - l * w2, "other", "계산 실수.")],
        verificationJs: withParams({ l, w, p, q }, "const a0=P.l*P.w*10000; const a1=P.l*(100+P.p)*P.w*(100-P.q); return (a1-a0)/10000;"),
        trace: [
          [`처음 넓이는 ${l} × ${w} = ${l * w} 이다.`, "Original area."],
          [`새 길이는 ${l} × ${(100 + p) / 100} = ${l2} 이다.`, "New length."],
          [`새 너비는 ${w} × ${(100 - q) / 100} = ${w2} 이다.`, "New width."],
          [`새 넓이는 ${l2} × ${w2} = ${l2 * w2} 이다.`, "New area."],
          [`넓이의 차는 ${l2 * w2} − ${l * w} = ${diff} 이다.`, "Compare the areas."],
        ],
        variant: "length_up_width_down",
      });
      return sem(out, [{ v: l, words: ["length"] }, { v: w, words: ["width"] }, { v: p, words: [...UP, "longer"], pct: true }, { v: q, words: [...DOWN, "shorter"], pct: true }], { words: ["area"], forbid: forbidExcept("area") });
    },
  },
  {
    id: "av.rectangle_area.repr_shift", skill: SKILL, kind: "rectangle_area", operator: "repr_shift",
    structure: "'길이가 너비보다 k 크다' 와 넓이 A 를 w(w+k)=A 로 식 세우고 양의 근을 골라 둘레를 구함",
    extraThinking: "문장 조건을 이차방정식으로 번역하고 음의 근을 버리는 모델링 — medium 은 가로·세로로 넓이 계산",
    concepts: ["직사각형 넓이", "문장→이차방정식", "직사각형 둘레"], mediumSteps: 1,
    generate(rng) {
      const w = rng.int(3, 24), k = rng.int(2, 9); const l = w + k, A = w * l; if (A > 990) throw new GenFail("x");
      const [nm, who] = rng.pick(RECT); const u = rng.pick(UNITS);
      const stimulus = spin(rng, `${who} has an area of ${A} ${sq(u)}. Its length is ${k} ${u} [[more than|greater than|longer than]] its width.`);
      const out = finish(rng, {
        stimulus: withOpen(rng, OPEN_GEO, stimulus), question: spin(rng, `[[What is the perimeter of the ${nm}, in ${u}?|Find the perimeter of the ${nm}, in ${u}.|How many ${u} of fencing go around the ${nm}?]]`), correct: 2 * (w + l),
        wrongs: [W(w + l, "step_missing", "반둘레(l+w)를 답했다."), W(2 * (2 * w + k + k), "other", "계산 실수."), W(4 * Math.round(Math.sqrt(A)), "formula_misuse", "정사각형이라고 보고 둘레를 계산했다."), W(2 * l * w, "formula_misuse", "넓이의 2 배를 둘레로 답했다."), W(A, "geometry_misapplied", "넓이를 둘레로 답했다.")],
        verificationJs: withParams({ A, k }, "const out=[];\nfor(let w=1;w<=200;w++){ const l=w+P.k; if(w*l===P.A) out.push(2*(w+l)); }\nif(out.length!==1) throw new Error('유일하지 않음');\nreturn out[0];"),
        trace: [
          [`너비를 w 라 하면 길이는 w + ${k} 이다.`, "Name the unknowns."],
          [`넓이 조건: w(w + ${k}) = ${A} 이다.`, "Set up the area equation."],
          [`w² + ${k}w − ${A} = 0 을 풀면 w = ${w} 또는 w = ${-(w + k)} 이다.`, "Solve the quadratic."],
          [`길이는 양수여야 하므로 w = ${w} 이고 길이는 ${l} 이다.`, "Discard the negative root."],
          [`둘레 = 2(${w} + ${l}) = ${2 * (w + l)} 이다.`, "Perimeter."],
        ],
        variant: "length_more_than_width",
      });
      return sem(out, [{ v: A, words: ["area"] }, { v: k, words: ["length", "width", "more", "longer"] }], { words: ["perimeter", "fencing"], forbid: forbidExcept("perimeter") });
    },
  },
  {
    id: "av.rectangle_area.compare_scenarios", skill: SKILL, kind: "rectangle_area", operator: "compare_scenarios",
    structure: "a×b 직사각형과 둘레가 같은 정사각형의 한 변을 둘레/4 로 구해 두 넓이의 차를 비교",
    extraThinking: "둘레가 같은 두 도형의 넓이를 각각 세워 비교(둘레가 같아도 넓이가 다름) — medium 은 직사각형 하나의 넓이",
    concepts: ["직사각형 넓이", "정사각형", "둘레 동일 조건 비교"], mediumSteps: 1,
    generate(rng) {
      const a = rng.int(4, 40), b = rng.int(2, a - 2); if ((a + b) % 2 !== 0 || (a - b) < 2) throw new GenFail("x");
      const s = (a + b) / 2, diff = s * s - a * b; if (diff < 2 || a * b > 990) throw new GenFail("x");
      const [x, y] = rng.pick([["garden", "patio"], ["field", "pen"], ["poster", "mat"], ["pool", "deck"], ["lot", "plaza"], ["rug", "tile pad"]]); const u = rng.pick(UNITS);
      const stimulus = spin(rng, `A ${x} is a rectangle measuring ${a} ${u} by ${b} ${u}. A ${y} is a square with the same perimeter as the ${x}.`);
      const out = finish(rng, {
        stimulus: withOpen(rng, OPEN_GEO, stimulus), question: spin(rng, `[[How many ${sq(u)} greater is the area of the ${y} than the area of the ${x}?|By how many ${sq(u)} does the area of the ${y} exceed the area of the ${x}?|What is the difference, in ${sq(u)}, between the area of the ${y} and the area of the ${x}?]]`), correct: diff,
        wrongs: [W(a - b, "formula_misuse", "두 변의 길이 차를 답했다."), W(s, "step_missing", "정사각형의 한 변을 답했다."), W(s * s, "step_missing", "정사각형의 넓이만 답했다."), W(a * b, "step_missing", "직사각형의 넓이만 답했다."), W(((a - b) * (a - b)) / 2, "formula_misuse", "차이 공식을 잘못 썼다.")],
        verificationJs: withParams({ a, b }, "const per=2*(P.a+P.b); const side=per/4; if(!Number.isInteger(side)) throw new Error('정수 아님'); return side*side-P.a*P.b;"),
        trace: [
          [`직사각형의 둘레는 2(${a} + ${b}) = ${2 * (a + b)} 이다.`, "Perimeter of the rectangle."],
          [`정사각형은 네 변이 같으므로 한 변은 ${2 * (a + b)} ÷ 4 = ${s} 이다.`, "Side of the square."],
          [`정사각형의 넓이는 ${s}² = ${s * s} 이다.`, "Area of the square."],
          [`직사각형의 넓이는 ${a} × ${b} = ${a * b} 이다.`, "Area of the rectangle."],
          [`차이는 ${s * s} − ${a * b} = ${diff} 이다.`, "Difference."],
        ],
        variant: "frame",
      });
      return sem(out, [], { words: ["area"], forbid: forbidExcept("area") });
    },
  },
  // ───────────── triangle_area ─────────────
  {
    id: "av.triangle_area.inverse", skill: SKILL, kind: "triangle_area", operator: "inverse",
    structure: "넓이 A 와 '밑변은 높이의 k 배' 로부터 (1/2)(kh)h=A 를 풀어 높이를 구한 뒤 밑변을 계산",
    extraThinking: "넓이에서 거꾸로 높이를 구하는 이차 구조(h² = 2A/k)와 관계식 활용 — medium 은 밑변·높이로 넓이 계산",
    concepts: ["삼각형 넓이", "비례 관계(밑변=k·높이)", "제곱근"], mediumSteps: 1,
    generate(rng) {
      const h = rng.int(2, 14), k = rng.int(2, 6); const A = (k * h * h) / 2; if (!Number.isInteger(A) || A > 990) throw new GenFail("x");
      const [nm, who] = rng.pick([["sail", "A triangular sail"], ["banner", "A triangular banner"], ["flag", "A triangular flag"], ["garden bed", "A triangular garden bed"], ["roof panel", "A triangular roof panel"], ["tent flap", "A triangular tent flap"]]); const u = rng.pick(UNITS);
      const stimulus = spin(rng, `${who} has an area of ${A} ${sq(u)}. Its base is ${k} times its height.`);
      const out = finish(rng, {
        stimulus: withOpen(rng, OPEN_GEO, stimulus), question: spin(rng, `[[What is the length of the base of the ${nm}, in ${u}?|Find the length of the base of the ${nm}, in ${u}.|How long is the base of the ${nm}, in ${u}?]]`), correct: k * h,
        wrongs: [W(h, "other", "높이를 답했다."), W(2 * A / k, "step_missing", "h² 를 구하고 제곱근과 밑변 계산을 하지 않았다."), W(Math.round(Math.sqrt(2 * A)), "formula_misuse", "밑변과 높이가 같다고 보고 풀었다."), W((2 * A) / h / k, "other", "계산 실수."), W(2 * A, "formula_misuse", "넓이의 2 배를 밑변으로 답했다.")],
        verificationJs: withParams({ A, k }, "const out=[];\nfor(let h=1;h<=200;h++){ if(P.k*h*h===2*P.A) out.push(P.k*h); }\nif(out.length!==1) throw new Error('유일하지 않음');\nreturn out[0];"),
        trace: [
          [`높이를 h 라 하면 밑변은 ${k}h 이다.`, "Name the height."],
          [`넓이 = (1/2) × ${k}h × h = ${A} 이다.`, "Area equation."],
          [`h² = ${(2 * A) / k} 이다.`, "Isolate h squared."],
          [`h > 0 이므로 h = ${h} 이다.`, "Take the positive root."],
          [`밑변 = ${k} × ${h} = ${k * h} 이다.`, "Compute the base."],
        ],
        variant: "frame",
      });
      return sem(out, [{ v: A, words: ["area"] }, { v: k, words: ["times"] }], { words: ["base"], forbid: forbidExcept("length") });
    },
  },
  {
    id: "av.triangle_area.compose_kind", skill: SKILL, kind: "triangle_area", operator: "compose_kind",
    structure: "이등변삼각형의 같은 두 변 L 과 밑변 2a 로부터 높이를 피타고라스(h²=L²−a²)로 구해 넓이 a·h 를 계산",
    extraThinking: "삼각형 넓이를 피타고라스 정리와 합성(높이가 주어지지 않음) — medium 은 밑변·높이로 넓이 계산",
    concepts: ["삼각형 넓이", "피타고라스 정리", "이등변삼각형의 높이"], mediumSteps: 1,
    generate(rng) {
      const [a, h, L] = rng.pick(TRIPLES); const b = 2 * a; if (L > 40 || a * h > 990 || b === L) throw new GenFail("x");
      const [nm, who] = rng.pick([["pennant", "A triangular pennant"], ["road sign", "A triangular road sign"], ["gable", "The triangular gable of a barn"], ["window", "A triangular window"], ["sail", "A triangular sail"], ["trellis", "A triangular trellis panel"]]); const u = rng.pick(UNITS);
      const stimulus = spin(rng, `${who} is an isosceles triangle. Its two equal sides are each ${L} ${u} long, and its base is ${b} ${u} long.`);
      const out = finish(rng, {
        stimulus: withOpen(rng, OPEN_GEO, stimulus), question: spin(rng, `[[What is the area of the ${nm}, in ${sq(u)}?|Find the area of the ${nm}, in ${sq(u)}.|How many ${sq(u)} does the ${nm} cover?]]`), correct: a * h,
        wrongs: [W((L * b) / 2, "geometry_misapplied", "같은 변의 길이를 높이로 썼다."), W(b * h, "formula_misuse", "÷2 를 빼먹었다."), W(a * L, "geometry_misapplied", "반 밑변과 빗변을 곱했다."), W(h, "step_missing", "높이만 답했다."), W((L * L) / 2, "formula_misuse", "정삼각형 공식처럼 계산했다.")],
        verificationJs: withParams({ L, b }, "const half=P.b/2; let h=null; for(let x=1;x<=500;x++){ if(x*x+half*half===P.L*P.L) h=x; }\nif(h===null) throw new Error('높이 없음');\nreturn P.b*h/2;"),
        trace: [
          ["높이는 밑변의 중점으로 내린 수선이며 삼각형을 합동인 직각삼각형 둘로 나눈다.", "The altitude splits the isosceles triangle."],
          [`반 밑변은 ${b} ÷ 2 = ${a} 이다.`, "Half the base."],
          [`피타고라스: h² = ${L}² − ${a}² = ${L * L - a * a} 이다.`, "Pythagorean theorem."],
          [`h = ${h} 이다.`, "Height."],
          [`넓이 = (1/2) × ${b} × ${h} = ${a * h} 이다.`, "Area."],
        ],
        variant: "frame",
      });
      return sem(out, [{ v: L, words: ["sides"] }, { v: b, words: ["base"] }], { words: ["area", "cover"], forbid: forbidExcept("area") });
    },
  },
  {
    id: "av.triangle_area.repr_shift", skill: SKILL, kind: "triangle_area", operator: "repr_shift",
    structure: "좌표평면의 세 꼭짓점으로 주어진 삼각형의 넓이를 신발끈 공식(또는 둘러싼 직사각형 빼기)으로 구함",
    extraThinking: "좌표 표현을 넓이 공식으로 옮기는 표현 변환(밑변·높이가 축에 평행하지 않음) — medium 은 밑변·높이가 직접 주어짐",
    concepts: ["삼각형 넓이", "좌표평면", "행렬식(신발끈) 계산"], mediumSteps: 1,
    generate(rng) {
      const pts = [0, 1, 2].map(() => [rng.int(0, 9), rng.int(0, 9)]); const [[x1, y1], [x2, y2], [x3, y3]] = pts;
      const det = x1 * (y2 - y3) + x2 * (y3 - y1) + x3 * (y1 - y2); const A = Math.abs(det) / 2;
      const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]); const box = (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys));
      if (A < 4 || (x1 === x2 && y1 === y2) || new Set(pts.map((p) => p.join())).size < 3 || x1 === x2 || x2 === x3 || x1 === x3 || y1 === y2 || y2 === y3 || y1 === y3) throw new GenFail("x");
      const stimulus = spin(rng, `[[In the xy-plane, a triangle has vertices at|A triangle in the coordinate plane has its three corners at|The vertices of a triangle drawn in the xy-plane are]] $(${x1}, ${y1})$, $(${x2}, ${y2})$, and $(${x3}, ${y3})$. [[Each unit on both axes represents one centimeter.|Both axes are marked in centimeters.|The scale on each axis is one centimeter per unit.]]`);
      return finish(rng, {
        stimulus: withOpen(rng, OPEN_GEO, stimulus), question: spin(rng, "[[What is the area of the triangle, in square centimeters?|Find the area of the triangle, in square centimeters.|How many square centimeters does the triangle cover?|Determine the area enclosed by the triangle, in square centimeters.]]"), correct: A,
        wrongs: [W(Math.abs(det), "formula_misuse", "÷2 를 빼먹었다."), W(box, "geometry_misapplied", "둘러싼 직사각형의 넓이를 답했다."), W(box / 2, "geometry_misapplied", "둘러싼 직사각형의 절반을 답했다."), W(A + 1, "other", "계산 실수."), W(Math.max(A - 1, 0.5), "other", "계산 실수."), W(Math.abs(x1 * y2 + x2 * y3 + x3 * y1) / 2, "formula_misuse", "신발끈 공식의 한 방향 합만 썼다.")],
        verificationJs: withParams({ x1, y1, x2, y2, x3, y3 }, "const X=[P.x1,P.x2,P.x3], Y=[P.y1,P.y2,P.y3];\nconst g=(a,b)=>{a=Math.abs(a);b=Math.abs(b);while(b){[a,b]=[b,a%b];}return a;};\nlet B=0; for(let i=0;i<3;i++){ const j=(i+1)%3; B+=g(X[i]-X[j],Y[i]-Y[j]); }\nconst area2=(x,y)=>Math.abs((X[1]-X[0])*(y-Y[0])-(Y[1]-Y[0])*(x-X[0]));\nconst sgn=(px,py,ax,ay,bx,by)=>(bx-ax)*(py-ay)-(by-ay)*(px-ax);\nlet I=0; for(let x=0;x<=9;x++) for(let y=0;y<=9;y++){ const d1=sgn(x,y,X[0],Y[0],X[1],Y[1]), d2=sgn(x,y,X[1],Y[1],X[2],Y[2]), d3=sgn(x,y,X[2],Y[2],X[0],Y[0]); const neg=d1<0||d2<0||d3<0, pos=d1>0||d2>0||d3>0; if(!(neg&&pos) && d1!==0 && d2!==0 && d3!==0) I++; }\nreturn I+B/2-1;"),
        trace: [
          [`세 꼭짓점의 좌표를 $(x_1,y_1)=(${x1},${y1})$, $(x_2,y_2)=(${x2},${y2})$, $(x_3,y_3)=(${x3},${y3})$ 로 놓는다.`, "Name the coordinates."],
          [`${x1}(${y2} − ${y3}) = ${x1 * (y2 - y3)} 를 계산한다.`, "First term."],
          [`${x2}(${y3} − ${y1}) = ${x2 * (y3 - y1)} 를 계산한다.`, "Second term."],
          [`${x3}(${y1} − ${y2}) = ${x3 * (y1 - y2)} 를 계산한다.`, "Third term."],
          [`세 항의 합은 ${det} 이고 절댓값은 ${Math.abs(det)} 이다.`, "Sum and absolute value."],
          [`넓이는 ${Math.abs(det)} ÷ 2 = ${A} 이다.`, "Halve it."],
        ],
        variant: "coordinates",
      });
    },
  },
  {
    id: "av.triangle_area.constraint_select", skill: SKILL, kind: "triangle_area", operator: "constraint_select",
    structure: "넓이 A 인 삼각형의 밑변·높이가 정수이고 '밑변 ≥ k·높이' 일 때 곱 bh=2A 의 약수쌍 중 조건을 만족하는 쌍의 개수",
    extraThinking: "넓이 조건을 정수 약수쌍으로 바꾸고 부등 제약으로 후보를 걸러 세는 추론 — medium 은 밑변·높이로 넓이 계산",
    concepts: ["삼각형 넓이", "약수쌍 열거", "제약 조건 적용"], mediumSteps: 1,
    generate(rng) {
      const A = rng.pick([12, 18, 20, 24, 30, 36, 40, 42, 48, 60, 72, 90]), k = rng.pick([2, 3, 4]); const pairs: [number, number][] = [];
      for (let h = 1; h <= 2 * A; h++) if ((2 * A) % h === 0) pairs.push([(2 * A) / h, h]); const ok = pairs.filter(([b, h]) => b >= k * h); const T = pairs.length;
      if (ok.length < 2 || ok.length === T) throw new GenFail("x");
      const [nm, who] = rng.pick([["sail", "A triangular sail"], ["pennant", "A triangular pennant"], ["garden bed", "A triangular garden bed"], ["sign", "A triangular sign"], ["panel", "A triangular panel"]]); const u = rng.pick(UNITS);
      const stimulus = spin(rng, `${who} has an area of ${A} ${sq(u)}. Its base and its height are both whole numbers of ${u}, and the base is at least ${k} times the height.`);
      const out = finish(rng, {
        stimulus: withOpen(rng, OPEN_GEO, stimulus), question: spin(rng, `[[How many different pairs of whole-number base and height are possible for the ${nm}?|For the ${nm}, how many different (base, height) pairs of whole numbers satisfy these conditions?|Find the number of possible pairs of whole-number base and height for the ${nm}.]]`), correct: ok.length,
        wrongs: [W(T, "condition_ignored", "'밑변이 높이의 k 배 이상' 조건을 적용하지 않고 모든 쌍을 셌다."), W(ok.length + 1, "other", "경계(같은 경우)를 잘못 포함했다."), W(Math.max(ok.length - 1, 0), "other", "경계 경우를 빠뜨렸다."), W(T - ok.length, "opposite", "조건을 만족하지 않는 쌍의 개수를 답했다."), W(Math.ceil(T / 2), "formula_misuse", "쌍의 절반이라고 어림했다.")],
        verificationJs: withParams({ A, k }, "let c=0;\nfor(let b=1;b<=400;b++) for(let h=1;h<=400;h++){ if(b*h===2*P.A && b>=P.k*h) c++; }\nreturn c;"),
        trace: [
          [`넓이 = (1/2)bh = ${A} 이므로 bh = ${2 * A} 이다.`, "Turn the area into a product."],
          [`${2 * A} 의 약수쌍 (b, h) 를 모두 나열한다: ${pairs.map(([b, h]) => `(${b},${h})`).join(" ")} 이다.`, "List all factor pairs."],
          [`밑변이 높이의 ${k} 배 이상이어야 하므로 b ≥ ${k}h 를 확인한다.`, "Apply the constraint."],
          [`조건을 만족하는 쌍: ${ok.map(([b, h]) => `(${b},${h})`).join(" ")} 이다.`, "Keep the valid pairs."],
          [`따라서 ${ok.length} 가지이다.`, "Count."],
        ],
        variant: "frame",
      });
      return sem(out, [{ v: A, words: ["area"] }, { v: k, words: ["times"] }], { words: ["pairs", "pair"] });
    },
  },
  // ───────────── prism_volume ─────────────
  {
    id: "av.prism_volume.inverse", skill: SKILL, kind: "prism_volume", operator: "inverse",
    structure: "세 치수가 연속한 자연수 n,n+1,n+2 이고 부피가 V 일 때 n 을 찾아 겉넓이 2(lw+lh+wh) 를 구함",
    extraThinking: "부피 조건에서 치수를 역으로 찾고 다른 양(겉넓이)으로 다시 계산 — medium 은 세 치수로 부피 계산",
    concepts: ["직육면체 부피", "연속한 정수", "겉넓이"], mediumSteps: 1,
    generate(rng) {
      const n = rng.int(2, 9), V = n * (n + 1) * (n + 2); const l = n + 2, w = n + 1, h = n; const S = 2 * (l * w + l * h + w * h);
      const [nm, who] = rng.pick(TANKS); const u = rng.pick(UNITS);
      const stimulus = spin(rng, `${who} is a rectangular box with a volume of ${V} ${cu(u)}. Its length, width, and height are three consecutive whole numbers of ${u}.`);
      const out = finish(rng, {
        stimulus: withOpen(rng, OPEN_GEO, stimulus), question: spin(rng, `[[What is the total surface area of the ${nm}, in ${sq(u)}?|Find the total surface area of the ${nm}, in ${sq(u)}.|Determine the total surface area of the ${nm}, in ${sq(u)}.]]`), correct: S,
        wrongs: [W(V, "geometry_misapplied", "부피를 답했다."), W(l * w + l * h + w * h, "formula_misuse", "겉넓이 공식의 2 를 빼먹었다."), W(4 * (l + w + h), "geometry_misapplied", "모서리 길이의 합을 답했다."), W(2 * l * w, "step_missing", "한 쌍의 면만 구했다."), W(6 * w * w, "formula_misuse", "정육면체 공식을 썼다.")],
        verificationJs: withParams({ V }, "const out=[];\nfor(let n=1;n<=60;n++){ if(n*(n+1)*(n+2)===P.V){ const l=n+2,w=n+1,h=n; out.push(2*(l*w+l*h+w*h)); } }\nif(out.length!==1) throw new Error('유일하지 않음');\nreturn out[0];"),
        trace: [
          ["세 치수를 n, n+1, n+2 로 놓는다.", "Name the dimensions."],
          [`부피 n(n+1)(n+2) = ${V} 이다.`, "Volume equation."],
          [`n = ${n} 이면 ${n} × ${n + 1} × ${n + 2} = ${V} 이므로 만족한다.`, "Find n by testing consecutive products."],
          [`치수는 ${n}, ${n + 1}, ${n + 2} 이다.`, "The dimensions."],
          [`겉넓이 = 2(${l}·${w} + ${l}·${h} + ${w}·${h}) = ${S} 이다.`, "Surface area."],
        ],
        variant: "frame",
      });
      return sem(out, [{ v: V, words: ["volume"] }], { words: ["surface area"], forbid: forbidExcept("area", "surface") });
    },
  },
  {
    id: "av.prism_volume.unit_ratio", skill: SKILL, kind: "prism_volume", operator: "unit_ratio",
    structure: "cm 단위 세 치수로 부피(cm³)를 구해 리터(1 L = 1000 cm³)로 환산하고 분당 주입량으로 나눠 가득 채우는 시간을 구함",
    extraThinking: "부피 단위 환산(cm³→L)과 비율(L/분) 결합 — medium 은 세 치수로 부피 계산",
    concepts: ["직육면체 부피", "부피 단위 환산", "속도(비율)"], mediumSteps: 1,
    generate(rng) {
      const l = rng.int(2, 10) * 10, w = rng.int(2, 10) * 10, h = rng.int(2, 10) * 10; const V = l * w * h, L = V / 1000; if (!Number.isInteger(L)) throw new GenFail("x");
      const rs = divisors(L).filter((r) => r >= 2 && L / r >= 2 && L / r <= 90 && r <= 30); if (!rs.length) throw new GenFail("x"); const r = rng.pick(rs), m = L / r;
      const [nm, who] = rng.pick(TANKS);
      const stimulus = spin(rng, `${who} has a length of ${l} centimeters, a width of ${w} centimeters, and a height of ${h} centimeters. Water flows into the empty ${nm} at a constant rate of ${r} liters per minute. [[There are 1000 cubic centimeters in 1 liter.|Recall that 1 liter equals 1000 cubic centimeters.]]`);
      const out = finish(rng, {
        stimulus: withOpen(rng, OPEN_GEO, stimulus), question: spin(rng, `[[How many minutes will it take to fill the ${nm} completely?|How long, in minutes, until the ${nm} is completely full?|Find the number of minutes needed to fill the ${nm} completely.]]`), correct: m,
        wrongs: [W(L, "step_missing", "리터 단위의 용량을 답했다(유량으로 나누지 않음)."), W(V / r, "unit_error", "cm³ 를 리터로 환산하지 않고 유량으로 나눴다."), W(V / 1000 / r / 10, "unit_error", "환산 계수를 100 으로 잘못 적용했다."), W(L * r, "formula_misuse", "용량에 유량을 곱했다."), W(m + r, "other", "계산 실수.")],
        verificationJs: withParams({ l, w, h, r }, "let cells=0; const V=P.l*P.w*P.h; const liters=V/1000;\nfor(let t=1;t<=2000;t++){ if(t*P.r>=liters){ if(t*P.r!==liters) throw new Error('딱 맞지 않음'); return t; } }\nthrow new Error('없음');"),
        trace: [
          [`부피 = ${l} × ${w} × ${h} = ${V} cm³ 이다.`, "Volume in cubic centimeters."],
          ["1 L = 1000 cm³ 이므로 리터로 바꾼다.", "Recall the conversion."],
          [`${V} ÷ 1000 = ${L} L 이다.`, "Convert to liters."],
          [`유량이 분당 ${r} L 이므로 시간은 ${L} ÷ ${r} 이다.`, "Divide by the rate."],
          [`${m} 분이 걸린다.`, "Minutes needed."],
        ],
        variant: "frame",
      });
      return sem(out, [{ v: l, words: ["length"] }, { v: w, words: ["width"] }, { v: h, words: ["height"] }], { words: ["minutes", "long"], forbid: forbidExcept() });
    },
  },
  {
    id: "av.prism_volume.compose_kind", skill: SKILL, kind: "prism_volume", operator: "compose_kind",
    structure: "직육면체와 부피가 같은 정육면체의 한 모서리를 세제곱근으로 구하고 정육면체의 겉넓이 6e² 를 구함",
    extraThinking: "부피 보존으로 다른 입체(정육면체)를 정하고 겉넓이로 합성 — medium 은 세 치수로 부피 계산",
    concepts: ["직육면체 부피", "정육면체(세제곱근)", "겉넓이"], mediumSteps: 1,
    generate(rng) {
      const e = rng.int(4, 9), cube = e ** 3; const ds = divisors(cube).filter((d) => d >= 2 && d !== e); const l = rng.pick(ds); const ds2 = divisors(cube / l).filter((d) => d >= 2); if (!ds2.length) throw new GenFail("x"); const w = rng.pick(ds2), h = cube / l / w;
      if (h < 2 || (l === w && w === h) || new Set([l, w, h]).size < 3 || Math.max(l, w, h) > 99) throw new GenFail("x");
      const [nm, who] = rng.pick([["gift box", "A gift box"], ["clay block", "A block of clay"], ["wax brick", "A wax brick"], ["foam block", "A foam block"], ["ice block", "A block of ice"], ["soap bar", "A bar of soap"]]); const u = rng.pick(UNITS);
      const S = 6 * e * e;
      const stimulus = spin(rng, `${who} measures ${l} ${u} by ${w} ${u} by ${h} ${u}. It is reshaped, without any loss of material, into a solid cube.`);
      const out = finish(rng, {
        stimulus: withOpen(rng, OPEN_GEO, stimulus), question: spin(rng, `[[What is the surface area of the cube, in ${sq(u)}?|Find the surface area of the cube, in ${sq(u)}.|After reshaping, how many ${sq(u)} is the total surface area of the cube?]]`), correct: S,
        wrongs: [W(cube, "geometry_misapplied", "부피를 답했다."), W(e * e, "step_missing", "한 면의 넓이만 답했다."), W(2 * (l * w + l * h + w * h), "geometry_misapplied", "처음 직육면체의 겉넓이를 답했다."), W(4 * e * e, "formula_misuse", "정육면체 겉넓이를 4e² 로 계산했다."), W(6 * e, "formula_misuse", "6 에 모서리 길이를 곱했다.")],
        verificationJs: withParams({ l, w, h }, "const V=P.l*P.w*P.h; let e=null; for(let x=1;x<=100;x++){ if(x*x*x===V) e=x; }\nif(e===null) throw new Error('세제곱 아님');\nreturn 6*e*e;"),
        trace: [
          [`직육면체의 부피는 ${l} × ${w} × ${h} = ${cube} 이다.`, "Volume of the box."],
          ["재료의 손실이 없으므로 정육면체의 부피도 같다.", "Volume is conserved."],
          [`정육면체의 한 모서리 e 는 e³ = ${cube} 이므로 e = ${e} 이다.`, "Cube root."],
          [`한 면의 넓이는 ${e}² = ${e * e} 이다.`, "Area of one face."],
          [`정육면체는 면이 6 개이므로 겉넓이는 6 × ${e * e} = ${S} 이다.`, "Total surface area."],
        ],
        variant: "frame",
      });
      return sem(out, [], { words: ["surface area"], forbid: forbidExcept("area", "surface") });
    },
  },
  {
    id: "av.prism_volume.compare_scenarios", skill: SKILL, kind: "prism_volume", operator: "compare_scenarios",
    structure: "수조 A 의 물 전부를 수조 B 로 옮길 때 B 의 기존 수위 f 에 (A 의 물 부피 ÷ B 의 밑넓이)를 더해 새 수위를 구함",
    extraThinking: "두 수조의 물 부피 보존과 밑넓이 비교로 수위 변화를 계산 — medium 은 한 상자의 부피 계산",
    concepts: ["직육면체 부피", "부피 보존", "수위(높이) 변화"], mediumSteps: 1,
    generate(rng) {
      const a = rng.pick([10, 12, 15, 20, 24, 30]), b = rng.pick([10, 15, 20, 25, 30]), d = rng.int(4, 20); const V = a * b * d;
      const c = rng.pick([6, 8, 10, 12, 15, 16, 20, 25]), e = rng.pick([6, 8, 10, 12, 15, 20, 25, 30]); if ((V % (c * e)) !== 0) throw new GenFail("x");
      const add = V / (c * e), f = rng.int(2, 20); const fin = f + add; if (add < 1 || add > 60 || fin > 99 || (a === c && b === e)) throw new GenFail("x");
      const [T1, t2] = rng.pick([["Tank A", "tank B"], ["Aquarium A", "aquarium B"], ["Basin A", "basin B"], ["Container A", "container B"], ["Trough A", "trough B"]]); const t1 = T1[0].toLowerCase() + T1.slice(1);
      const stimulus = spin(rng, `[[${T1} has a rectangular base measuring ${a} centimeters by ${b} centimeters and holds water to a depth of ${d} centimeters.|${T1} sits on a rectangular base that is ${a} centimeters by ${b} centimeters. The water in it has a depth of ${d} centimeters.|The base of ${t1} measures ${a} centimeters by ${b} centimeters. Its water has a depth of ${d} centimeters.]] [[${t2[0].toUpperCase() + t2.slice(1)} has a rectangular base measuring ${c} centimeters by ${e} centimeters and holds water to a depth of ${f} centimeters.|${t2[0].toUpperCase() + t2.slice(1)} sits on a rectangular base that is ${c} centimeters by ${e} centimeters. The water in it has a depth of ${f} centimeters.|The base of ${t2} measures ${c} centimeters by ${e} centimeters. Its water has a depth of ${f} centimeters.]] [[All the water from ${t1} is poured into ${t2}, and none spills.|Every drop of water in ${t1} is transferred into ${t2} with nothing lost.|${T1} is emptied completely into ${t2} without any spilling.]]`);
      const out = finish(rng, {
        stimulus: withOpen(rng, OPEN_GEO, stimulus), question: spin(rng, `[[What is the depth of the water in ${t2} after pouring, in centimeters?|How deep is the water in ${t2} afterward, in centimeters?|Find the new depth of the water in ${t2}, in centimeters.|After the transfer, what is the depth of the water in ${t2}, in centimeters?]]`), correct: fin,
        wrongs: [W(add, "step_missing", "B 에 더해진 수위만 구하고 기존 수위를 더하지 않았다."), W(d + f, "formula_misuse", "두 수위를 그대로 더했다."), W((a * b * d) / (c * e) + d, "other", "A 의 수위를 더했다."), W(V / (c * e + 0) + f + 1, "other", "계산 실수."), W((a * b * (d + f)) / (c * e), "formula_misuse", "기존 B 의 수위를 A 의 밑넓이 기준으로 환산했다.")],
        verificationJs: withParams({ a, b, d, c, e, f }, "const vA=P.a*P.b*P.d, vB=P.c*P.e*P.f; const total=vA+vB; const base=P.c*P.e; if(total%base!==0) throw new Error('정수 아님'); return total/base;"),
        trace: [
          [`A 의 물의 부피는 ${a} × ${b} × ${d} = ${V} cm³ 이다.`, "Volume of water in A."],
          [`B 의 밑넓이는 ${c} × ${e} = ${c * e} cm² 이다.`, "Base area of B."],
          [`A 의 물이 B 에서 더하는 수위는 ${V} ÷ ${c * e} = ${add} cm 이다.`, "Added depth."],
          [`B 에는 이미 ${f} cm 의 물이 있다.`, "Existing depth."],
          [`새 수위는 ${f} + ${add} = ${fin} cm 이다.`, "New depth."],
        ],
        variant: "pour_into_second",
      });
      return sem(out, [{ v: d, words: ["depth"] }, { v: f, words: ["depth"] }, { v: a, words: ["base"] }, { v: b, words: ["base"] }, { v: c, words: ["base"] }, { v: e, words: ["base"] }], { words: ["depth", "deep"] });
    },
  },
  // ───────────── prism_missing_dimension ─────────────
  {
    id: "av.prism_missing_dimension.inverse", skill: SKILL, kind: "prism_missing_dimension", operator: "inverse",
    structure: "한 꼭짓점에서 만나는 세 면의 넓이 lw, lh, wh 의 곱이 (lwh)² 임을 이용해 부피를 구하고 각 모서리를 구해 가장 긴 모서리를 찾음",
    extraThinking: "세 면의 넓이에서 거꾸로 세 치수를 복원(곱의 제곱근으로 부피 → 모서리) — medium 은 두 치수와 부피로 나머지 치수",
    concepts: ["직육면체 면의 넓이", "부피=세 면 넓이 곱의 제곱근", "모서리 복원"], mediumSteps: 1,
    generate(rng) {
      const l = rng.int(2, 14), w = rng.int(2, 14), h = rng.int(2, 14); if (new Set([l, w, h]).size < 3 || Math.max(l, w, h) < 6) throw new GenFail("x");
      const a1 = l * w, a2 = l * h, a3 = w * h; if (Math.max(a1, a2, a3) > 990) throw new GenFail("x"); const V = l * w * h; const longest = Math.max(l, w, h);
      const [nm, who] = rng.pick(TANKS); const u = rng.pick(UNITS); const arr = rng.shuffle([a1, a2, a3]);
      const stimulus = spin(rng, `${who} is a rectangular box. The three faces that meet at one corner of the ${nm} have areas of ${arr[0]} ${sq(u)}, ${arr[1]} ${sq(u)}, and ${arr[2]} ${sq(u)}.`);
      const out = finish(rng, {
        stimulus: withOpen(rng, OPEN_GEO, stimulus), question: spin(rng, `[[What is the length of the longest edge of the ${nm}, in ${u}?|Find the length of the longest edge of the ${nm}, in ${u}.|How long is the longest edge of the ${nm}, in ${u}?]]`), correct: longest,
        wrongs: [W(Math.min(l, w, h), "other", "가장 짧은 모서리를 답했다."), W(V, "geometry_misapplied", "부피를 답했다."), W(Math.max(a1, a2, a3), "geometry_misapplied", "가장 큰 면의 넓이를 답했다."), W(l + w + h - longest - Math.min(l, w, h), "other", "중간 길이의 모서리를 답했다."), W(Math.round(Math.sqrt(Math.max(a1, a2, a3))), "formula_misuse", "가장 큰 면이 정사각형이라고 보고 제곱근을 답했다.")],
        verificationJs: withParams({ a1: arr[0], a2: arr[1], a3: arr[2] }, "const out=[];\nfor(let l=1;l<=30;l++) for(let w=1;w<=30;w++) for(let h=1;h<=30;h++){ const f=[l*w,l*h,w*h].sort((x,y)=>x-y); const g=[P.a1,P.a2,P.a3].sort((x,y)=>x-y); if(f[0]===g[0]&&f[1]===g[1]&&f[2]===g[2]) out.push(Math.max(l,w,h)); }\nif(out.length<1) throw new Error('없음');\nreturn out[0];"),
        trace: [
          ["세 치수를 l, w, h 라 하면 세 면의 넓이는 lw, lh, wh 이다.", "Name the dimensions."],
          [`세 넓이를 곱하면 (lwh)² = ${a1} × ${a2} × ${a3} 이다.`, "Multiply the three areas."],
          [`부피 lwh = ${V} 이다(제곱근).`, "Take the square root for the volume."],
          [`각 모서리는 부피를 그 모서리를 포함하지 않는 면의 넓이로 나눈 값이다: ${V}÷${a3}=${l}, ${V}÷${a2}=${w}, ${V}÷${a1}=${h}.`, "Divide the volume by each opposite face area."],
          [`세 모서리는 ${l}, ${w}, ${h} 이므로 가장 긴 것은 ${longest} 이다.`, "Pick the longest."],
        ],
        variant: "frame",
      });
      return sem(out, [{ v: a1, words: ["areas"] }, { v: a2, words: ["areas"] }, { v: a3, words: ["areas"] }], { words: ["longest"], forbid: forbidExcept("length") });
    },
  },
  {
    id: "av.prism_missing_dimension.chain2", skill: SKILL, kind: "prism_missing_dimension", operator: "chain2",
    structure: "상자 A 의 부피와 밑면으로 높이를 구하고, 같은 높이이고 밑면이 다른 상자 B 의 부피를 계산",
    extraThinking: "앞 단계에서 구한 미지 치수가 뒤 단계의 조건이 되는 2단계 연쇄 — medium 은 한 상자의 미지 치수 하나",
    concepts: ["직육면체 부피", "미지 치수 역산", "2단계 연쇄"], mediumSteps: 1,
    generate(rng) {
      const l1 = rng.int(3, 15), w1 = rng.int(3, 15), h = rng.int(3, 15), l2 = rng.int(3, 15), w2 = rng.int(3, 15); const V1 = l1 * w1 * h, V2 = l2 * w2 * h;
      if (V1 > 990 || V2 > 990 || l1 * w1 === l2 * w2 || V1 === V2) throw new GenFail("x"); const u = rng.pick(UNITS);
      const [nm1, nm2] = rng.pick([["Box A", "box B"], ["Crate X", "crate Y"], ["Bin P", "bin Q"], ["Container M", "container N"]]);
      const stimulus = spin(rng, `${nm1} is a rectangular prism with a volume of ${V1} ${cu(u)} and a base measuring ${l1} ${u} by ${w1} ${u}. ${nm2[0].toUpperCase() + nm2.slice(1)} is a rectangular prism with the same height as ${nm1} and a base measuring ${l2} ${u} by ${w2} ${u}.`);
      const out = finish(rng, {
        stimulus: withOpen(rng, OPEN_GEO, stimulus), question: spin(rng, `[[What is the volume of ${nm2}, in ${cu(u)}?|Find the volume of ${nm2}, in ${cu(u)}.|How many ${cu(u)} does ${nm2} hold?]]`), correct: V2,
        wrongs: [W(h, "step_missing", "높이만 구했다."), W(V1 + V2, "formula_misuse", "두 부피를 더했다."), W(l2 * w2, "geometry_misapplied", "B 의 밑넓이를 답했다."), W((V1 * l2 * w2) / (l1 * w1) + 1, "other", "계산 실수."), W(l2 * w2 * l1, "formula_misuse", "A 의 한 치수를 높이로 썼다.")],
        verificationJs: withParams({ V1, l1, w1, l2, w2 }, "const out=[];\nfor(let h=1;h<=500;h++){ if(P.l1*P.w1*h===P.V1) out.push(P.l2*P.w2*h); }\nif(out.length!==1) throw new Error('유일하지 않음');\nreturn out[0];"),
        trace: [
          [`${nm1} 의 밑넓이는 ${l1} × ${w1} = ${l1 * w1} 이다.`, "Base area of the first prism."],
          [`부피 = 밑넓이 × 높이 이므로 높이 = ${V1} ÷ ${l1 * w1} = ${h} 이다.`, "Solve for the height."],
          [`${nm2} 은(는) 같은 높이 ${h} 를 가진다.`, "The second prism has the same height."],
          [`${nm2} 의 밑넓이는 ${l2} × ${w2} = ${l2 * w2} 이다.`, "Base area of the second prism."],
          [`부피 = ${l2 * w2} × ${h} = ${V2} 이다.`, "Volume of the second prism."],
        ],
        variant: "frame",
      });
      return sem(out, [{ v: V1, words: ["volume"] }, { v: l1, words: ["base"] }, { v: w1, words: ["base"] }, { v: l2, words: ["base"] }, { v: w2, words: ["base"] }], { words: ["volume", "hold"], forbid: forbidExcept("volume") });
    },
  },
  {
    id: "av.prism_missing_dimension.unit_ratio", skill: SKILL, kind: "prism_missing_dimension", operator: "unit_ratio",
    structure: "리터 단위 용량을 cm³ 로 환산해 밑넓이로 나눠 높이(cm)를 구함",
    extraThinking: "용량(L)→부피(cm³) 환산 후 밑넓이로 나누는 미지 치수 계산 — medium 은 cm³ 부피로 직접 나눔",
    concepts: ["직육면체 부피", "부피 단위 환산", "미지 치수 역산"], mediumSteps: 1,
    generate(rng) {
      const l = rng.int(2, 10) * 10, w = rng.int(2, 10) * 10, h = rng.int(1, 9) * 10; const V = l * w * h; if (V % 1000 !== 0 || l === w) throw new GenFail("x"); const L = V / 1000; if (L > 990) throw new GenFail("x");
      const [nm, who] = rng.pick(TANKS);
      const stimulus = spin(rng, `${who} with a rectangular base measuring ${l} centimeters by ${w} centimeters holds exactly ${L} liters of water when it is full. [[There are 1000 cubic centimeters in 1 liter.|Recall that 1 liter equals 1000 cubic centimeters.]]`);
      const out = finish(rng, {
        stimulus: withOpen(rng, OPEN_GEO, stimulus), question: spin(rng, `[[What is the height of the ${nm}, in centimeters?|Find the height of the ${nm}, in centimeters.|How tall is the ${nm}, in centimeters?]]`), correct: h,
        wrongs: [W(h * 10, "unit_error", "환산 계수를 10 배 틀렸다."), W(h / 10, "unit_error", "환산 계수를 10 배 작게 썼다."), W(L, "step_missing", "리터 값을 그대로 높이로 답했다."), W(h * 100, "unit_error", "리터를 cm³ 로 환산하지 않고(×1000 대신 ×10) 계산했다."), W(h + 10, "other", "계산 실수.")],
        verificationJs: withParams({ l, w, L }, "const out=[];\nfor(let h=1;h<=1000;h++){ if(P.l*P.w*h===P.L*1000) out.push(h); }\nif(out.length!==1) throw new Error('유일하지 않음');\nreturn out[0];"),
        trace: [
          ["1 L = 1000 cm³ 이므로 용량을 cm³ 로 바꾼다.", "Convert liters to cubic centimeters."],
          [`${L} L = ${L * 1000} cm³ 이다.`, "Volume in cm³."],
          [`밑넓이는 ${l} × ${w} = ${l * w} cm² 이다.`, "Base area."],
          ["부피 = 밑넓이 × 높이 이므로 높이 = 부피 ÷ 밑넓이 이다.", "Solve for the height."],
          [`높이 = ${L * 1000} ÷ ${l * w} = ${h} cm 이다.`, "Height."],
        ],
        variant: "frame",
      });
      return sem(out, [{ v: l, words: ["base"] }, { v: w, words: ["base"] }], { words: ["height", "tall"], forbid: forbidExcept("height") });
    },
  },
  {
    id: "av.prism_missing_dimension.constraint_select", skill: SKILL, kind: "prism_missing_dimension", operator: "constraint_select",
    structure: "부피 V 이고 모서리가 모두 1 보다 큰 정수인 직육면체의 가능한 (l,w,h) 를 나열해 겉넓이가 최소인 값을 구함",
    extraThinking: "정수 제약 아래 가능한 치수를 모두 나열하고 목표 함수(겉넓이)로 비교·선택 — medium 은 두 치수와 부피로 나머지 치수 하나",
    concepts: ["직육면체 부피", "약수 삼쌍 열거", "겉넓이 최소 비교"], mediumSteps: 1,
    generate(rng) {
      const V = rng.pick([48, 60, 72, 90, 96, 120, 144, 180]); const trip: [number, number, number][] = [];
      for (let a = 2; a <= V; a++) for (let b = a; a * b <= V; b++) if (V % (a * b) === 0 && V / (a * b) >= b) trip.push([a, b, V / (a * b)]);
      const SA = trip.map(([a, b, c]) => 2 * (a * b + a * c + b * c)); const best = Math.min(...SA); if (trip.length < 3 || new Set(SA).size < 3) throw new GenFail("x");
      const bi = SA.indexOf(best); const [nm, who] = rng.pick(TANKS); const u = rng.pick(UNITS);
      const stimulus = spin(rng, `${who} is a rectangular box with a volume of ${V} ${cu(u)}. Each of its edge lengths is a whole number of ${u} greater than 1.`);
      const sorted = [...SA].sort((x, y) => x - y);
      const out = finish(rng, {
        stimulus: withOpen(rng, OPEN_GEO, stimulus), question: spin(rng, `[[What is the least possible surface area of the ${nm}, in ${sq(u)}?|Find the smallest possible surface area of the ${nm}, in ${sq(u)}.|Among all such boxes, what is the minimum surface area, in ${sq(u)}?]]`), correct: best,
        wrongs: [W(sorted[sorted.length - 1], "opposite", "가장 큰 겉넓이를 답했다."), W(sorted[1], "other", "두 번째로 작은 겉넓이를 답했다."), W(V, "geometry_misapplied", "부피를 답했다."), W(2 * (3 * Math.round(Math.cbrt(V)) ** 2), "formula_misuse", "정육면체라고 보고 어림했다."), W(sorted[2], "other", "세 번째로 작은 겉넓이를 답했다.")],
        verificationJs: withParams({ V }, "let best=Infinity;\nfor(let a=2;a<=P.V;a++){ if(P.V%a) continue; for(let b=2;b<=P.V/a;b++){ if((P.V/a)%b) continue; const c=P.V/a/b; if(c<2) continue; const s=2*(a*b+a*c+b*c); if(s<best) best=s; } }\nreturn best;"),
        trace: [
          [`부피 lwh = ${V} 이고 각 모서리는 2 이상의 정수이다.`, "State the constraints."],
          [`가능한 (l, w, h) 를 나열한다: ${trip.map(([a, b, c]) => `(${a},${b},${c})`).join(" ")}.`, "List the possible dimension triples."],
          ["각각의 겉넓이 2(lw + lh + wh) 를 계산한다.", "Compute each surface area."],
          [trip.map(([a, b, c], i) => `(${a},${b},${c}) → ${SA[i]}`).join(", ") + " 이다.", "Tabulate."],
          [`가장 작은 값은 (${trip[bi].join(",")}) 의 ${best} 이다.`, "Choose the minimum."],
        ],
        variant: "frame",
      });
      return sem(out, [{ v: V, words: ["volume"] }], { words: ["surface area"], forbid: forbidExcept("area", "surface") });
    },
  },
  // ───────────── cylinder_volume_radius ─────────────
  {
    id: "av.cylinder_volume_radius.inverse", skill: SKILL, kind: "cylinder_volume_radius", operator: "inverse",
    structure: "원기둥의 부피 kπ 와 높이 h 로 π r² h = kπ 에서 r 을 구하고 밑면의 둘레 2πr 를 구함",
    extraThinking: "부피에서 반지름을 역으로 구하고(r²=k/h) 다른 양(밑면 둘레)으로 다시 계산 — medium 은 반지름·높이로 부피 계산",
    concepts: ["원기둥 부피", "제곱근", "원의 둘레"], mediumSteps: 1,
    generate(rng) {
      const r = rng.int(2, 12), h = rng.int(2, 12); const k = r * r * h; if (k > 990 || r === h) throw new GenFail("x");
      const [nm, who] = rng.pick(CANS); const u = rng.pick(["centimeters", "inches", "meters", "feet"] as const);
      const stimulus = spin(rng, `${who} is a right circular cylinder with a volume of $${k}\\pi$ ${cu(u)} and a height of ${h} ${u}.`);
      const out = finish(rng, {
        stimulus: withOpen(rng, OPEN_GEO, stimulus), question: spin(rng, `[[What is the circumference of the circular base of the ${nm}, in ${u}?|Find the circumference of the base of the ${nm}, in ${u}.|How long is the circumference of the circular base, in ${u}?]]`), correct: 2 * r, fmt: piOpt,
        wrongs: [W(r, "formula_misuse", "반지름을 답했다(둘레 2πr 의 2 를 빼먹음)."), W(r * r, "geometry_misapplied", "밑면의 넓이 계수를 답했다."), W(4 * r, "formula_misuse", "둘레를 4πr 로 계산했다."), W(k / h, "step_missing", "r² 만 구했다."), W(2 * r * h, "geometry_misapplied", "옆넓이 계수를 답했다.")],
        verificationJs: withParams({ k, h }, "const out=[];\nfor(let r=1;r<=100;r++){ if(r*r*P.h===P.k) out.push(2*r); }\nif(out.length!==1) throw new Error('유일하지 않음');\nreturn out[0];"),
        trace: [
          ["원기둥의 부피 공식은 V = πr²h 이다.", "Volume formula."],
          [`πr² × ${h} = ${k}π 이다.`, "Substitute."],
          [`양변을 π 와 ${h} 로 나누면 r² = ${k / h} 이다.`, "Isolate r squared."],
          [`r > 0 이므로 r = ${r} 이다.`, "Take the positive root."],
          [`밑면의 둘레는 2πr = ${2 * r}π 이다.`, "Circumference."],
        ],
        variant: "frame",
      });
      return sem(out, [{ v: k, words: ["volume"] }, { v: h, words: ["height"] }], { words: ["circumference"], forbid: forbidExcept("circumference") });
    },
  },
  {
    id: "av.cylinder_volume_radius.compose_kind", skill: SKILL, kind: "cylinder_volume_radius", operator: "compose_kind",
    structure: "반지름을 p% 늘리고 높이는 그대로일 때 부피 증가량 π h (r'² − r²) 를 구함(퍼센트 변화와 부피 합성)",
    extraThinking: "길이의 퍼센트 변화가 부피에는 제곱으로 작용함을 반영해 두 부피를 비교 — medium 은 반지름·높이로 부피 계산",
    concepts: ["원기둥 부피", "퍼센트 증가", "부피 변화량"], mediumSteps: 1,
    generate(rng) {
      const r = rng.pick([4, 5, 8, 10, 12, 15, 20]), p = rng.pick([10, 20, 25, 50]), h = rng.int(2, 9); const r2 = (r * (100 + p)) / 100; if (!Number.isInteger(r2)) throw new GenFail("x");
      const d = h * (r2 * r2 - r * r); if (d > 9000) throw new GenFail("x"); const [nm, who] = rng.pick(CANS);
      const stimulus = spin(rng, `[[${who} is a right circular cylinder with a radius of ${r} centimeters and a height of ${h} centimeters.|${who} is a right circular cylinder whose height is ${h} centimeters and whose radius is ${r} centimeters.|For ${who.charAt(0).toLowerCase() + who.slice(1)}, a right circular cylinder, the radius is ${r} centimeters and the height is ${h} centimeters.]] [[Its radius is increased by ${p}%, while its height stays the same.|The radius is made ${p}% larger, and the height is unchanged.|A redesign applies a ${p}% increase to the radius and keeps the height the same.]]`);
      const out = finish(rng, {
        stimulus: withOpen(rng, OPEN_GEO, stimulus), question: spin(rng, `[[By how many cubic centimeters does the volume of the ${nm} increase, in terms of π?|What is the increase in volume, in cubic centimeters, in terms of π?|The volume increases by how many cubic centimeters, in terms of π?|How much greater, in cubic centimeters, is the new volume than the old one? Give the answer in terms of π.]]`), correct: d, fmt: piOpt,
        wrongs: [W(h * r2 * r2, "step_missing", "새 부피만 구하고 처음 부피를 빼지 않았다."), W((h * r * r * p) / 100, "formula_misuse", "부피가 반지름과 같은 비율(p%)로 늘어난다고 보았다."), W(h * r * r, "step_missing", "처음 부피를 답했다."), W(h * (r2 - r) * (r2 - r), "formula_misuse", "반지름 변화량만 제곱했다."), W(h * (r2 - r) * 2 * r, "formula_misuse", "선형 근사로 계산했다.")],
        verificationJs: withParams({ r, p, h }, "const v0=P.r*P.r*P.h*10000; const v1=P.r*(100+P.p)*P.r*(100+P.p)*P.h; return (v1-v0)/10000;"),
        trace: [
          [`처음 부피는 π × ${r}² × ${h} = ${r * r * h}π 이다.`, "Original volume."],
          [`새 반지름은 ${r} × ${(100 + p) / 100} = ${r2} 이다.`, "New radius."],
          [`새 부피는 π × ${r2}² × ${h} = ${r2 * r2 * h}π 이다.`, "New volume."],
          ["반지름이 커져도 높이는 그대로이므로 두 부피를 그대로 비교한다.", "Height is unchanged."],
          [`증가량은 ${r2 * r2 * h}π − ${r * r * h}π = ${d}π 이다.`, "Increase."],
        ],
        variant: "frame",
      });
      return sem(out, [{ v: r, words: ["radius"] }, { v: h, words: ["height"] }, { v: p, words: [...UP, "larger"], pct: true }], { words: ["volume"], forbid: forbidExcept("volume") });
    },
  },
  {
    id: "av.cylinder_volume_radius.unit_ratio", skill: SKILL, kind: "cylinder_volume_radius", operator: "unit_ratio",
    structure: "cm 단위 반지름·높이로 π r² h (cm³) 를 구해 리터(1 L = 1000 cm³)로 환산한 계수를 π 로 표현",
    extraThinking: "원기둥 부피에 부피 단위 환산(cm³→L)을 결합 — medium 은 반지름·높이로 부피(cm³) 계산",
    concepts: ["원기둥 부피", "부피 단위 환산", "π 로 나타낸 식"], mediumSteps: 1,
    generate(rng) {
      const r = rng.pick([5, 10, 15, 20, 25, 30]), h = rng.int(2, 90); const coef = (r * r * h) / 1000; if (!Number.isInteger(coef) || coef < 1 || coef > 900 || r === h) throw new GenFail("x");
      const [nm, who] = rng.pick([["water tank", "A cylindrical water tank"], ["fish tank", "A cylindrical fish tank"], ["rain barrel", "A cylindrical rain barrel"], ["storage drum", "A cylindrical storage drum"], ["juice dispenser", "A cylindrical juice dispenser"]]);
      const stimulus = spin(rng, `${who} has a radius of ${r} centimeters and a height of ${h} centimeters. [[There are 1000 cubic centimeters in 1 liter.|Recall that 1 liter equals 1000 cubic centimeters.]]`);
      const out = finish(rng, {
        stimulus: withOpen(rng, OPEN_GEO, stimulus), question: spin(rng, `[[How many liters does the ${nm} hold when full, in terms of π?|What is the capacity of the ${nm}, in liters, in terms of π?|Find the number of liters the ${nm} holds, in terms of π.]]`), correct: coef, fmt: piOpt,
        wrongs: [W(coef * 1000, "unit_error", "cm³ 를 리터로 환산하지 않았다."), W(coef * 10, "unit_error", "환산 계수를 100 으로 썼다."), W(coef * 4, "geometry_misapplied", "반지름 대신 지름을 제곱해 계산했다."), W(coef * 2, "formula_misuse", "πr²h 대신 2πrh 의 구조로 계산했다."), W(r * r * h, "step_missing", "cm³ 부피를 답했다."), W(coef * 100, "unit_error", "환산 계수를 10 으로 썼다.")],
        verificationJs: withParams({ r, h }, "const v=P.r*P.r*P.h; if(v%1000!==0) throw new Error('정수 아님'); return v/1000;"),
        trace: [
          [`밑면의 넓이는 π × ${r}² = ${r * r}π cm² 이다.`, "Base area."],
          [`부피 = ${r * r}π × ${h} = ${r * r * h}π cm³ 이다.`, "Volume in cm³."],
          ["1 L = 1000 cm³ 이므로 1000 으로 나눈다.", "Convert to liters."],
          [`${r * r * h}π ÷ 1000 = ${coef}π L 이다.`, "Capacity in liters."],
          [`용량은 ${coef}π 리터이다.`, "Answer."],
        ],
        variant: "frame",
      });
      return sem(out, [{ v: r, words: ["radius"] }, { v: h, words: ["height"] }], { words: ["liters"], forbid: forbidExcept() });
    },
  },
  {
    id: "av.cylinder_volume_radius.compare_scenarios", skill: SKILL, kind: "cylinder_volume_radius", operator: "compare_scenarios",
    structure: "반지름이 다른 두 원기둥이 같은 부피일 때 π 가 약분됨을 이용해 r_A² h_A = r_B² h_B 로 B 의 높이를 구함",
    extraThinking: "두 원기둥의 같은 부피 조건에서 반지름 제곱비로 높이를 비교(높이는 반비례 제곱) — medium 은 한 원기둥의 부피 계산",
    concepts: ["원기둥 부피", "부피 동일 조건 비교", "제곱 반비례"], mediumSteps: 1,
    generate(rng) {
      const rA = rng.int(2, 12), hA = rng.int(2, 18), rB = rng.int(2, 12); if (rA === rB || (rA * rA * hA) % (rB * rB) !== 0) throw new GenFail("x"); const hB = (rA * rA * hA) / (rB * rB);
      if (hB === hA || hB > 99 || hB < 1) throw new GenFail("x"); const [nm] = rng.pick(CANS); const [C1, c2, cs] = rng.pick([["Can A", "can B", "cans"], ["Jar A", "jar B", "jars"], ["Drum A", "drum B", "drums"], ["Tank A", "tank B", "tanks"], ["Cup A", "cup B", "cups"]] as const);
      const stimulus = spin(rng, `[[${C1} is a cylinder with a radius of ${rA} centimeters and a height of ${hA} centimeters.|${C1} is a cylinder whose height is ${hA} centimeters and whose radius is ${rA} centimeters.|The cylinder ${C1} has a radius of ${rA} centimeters, and its height is ${hA} centimeters.]] [[${c2[0].toUpperCase() + c2.slice(1)} is a cylinder with a radius of ${rB} centimeters.|The radius of ${c2}, also a cylinder, is ${rB} centimeters.|${c2[0].toUpperCase() + c2.slice(1)} is another cylinder, and its radius is ${rB} centimeters.]] [[The two ${cs} hold exactly the same volume.|Both ${cs} can hold precisely the same volume of liquid.|The volume that ${C1} holds equals the volume that ${c2} holds.]]`);
      const out = finish(rng, {
        stimulus: withOpen(rng, OPEN_GEO, stimulus), question: spin(rng, `[[What is the height of ${c2}, in centimeters?|Find the height of ${c2}, in centimeters.|How tall is ${c2}, in centimeters?|Determine the height of ${c2} in centimeters.]]`), correct: hB,
        wrongs: [W((rA * hA) / rB, "formula_misuse", "높이가 반지름에 반비례한다고 보았다(제곱이 아님)."), W(hA, "step_missing", "같은 높이라고 답했다."), W((rB * rB * hA) / (rA * rA), "formula_misuse", "비를 거꾸로 적용했다."), W(rA * rA * hA, "step_missing", "A 의 부피 계수를 답했다."), W(hA + (rA - rB), "other", "반지름 차이만큼 더했다.")],
        verificationJs: withParams({ rA, hA, rB }, "const out=[];\nfor(let h=1;h<=2000;h++){ if(P.rB*P.rB*h===P.rA*P.rA*P.hA) out.push(h); }\nif(out.length!==1) throw new Error('유일하지 않음');\nreturn out[0];"),
        trace: [
          [`A 의 부피는 π × ${rA}² × ${hA} = ${rA * rA * hA}π 이다.`, "Volume of A."],
          [`B 의 높이를 h 라 하면 부피는 π × ${rB}² × h = ${rB * rB}πh 이다.`, "Volume of B."],
          ["두 부피가 같으므로 π 는 양변에서 약분된다.", "Set the volumes equal."],
          [`${rB * rB}h = ${rA * rA * hA} 이다.`, "Equation."],
          [`h = ${hB} 이다.`, "Solve."],
        ],
        variant: "frame",
      });
      return sem(out, [{ v: rA, words: ["radius"] }, { v: rB, words: ["radius"] }, { v: hA, words: ["height"] }], { words: ["height", "tall"], forbid: forbidExcept("height") });
    },
  },
  // ───────────── cylinder_volume_diameter ─────────────
  {
    id: "av.cylinder_volume_diameter.inverse", skill: SKILL, kind: "cylinder_volume_diameter", operator: "inverse",
    structure: "높이가 지름과 같은 원기둥의 부피 kπ 에서 V=πd³/4 → d³=4k 를 풀어 지름을 구하고 반지름 d/2 를 답함",
    extraThinking: "관계(h=d)와 부피로 지름을 역산하고 반지름으로 되돌리는 지름·반지름 구분 — medium 은 지름·높이로 부피 계산",
    concepts: ["원기둥 부피", "지름과 반지름", "세제곱근"], mediumSteps: 2,
    generate(rng) {
      const d = rng.pick([2, 4, 6, 8, 10, 12]), k = (d ** 3) / 4; const [nm, who] = rng.pick(CANS); const u = rng.pick(["centimeters", "inches", "meters", "feet"] as const);
      const stimulus = spin(rng, `${who} is a right circular cylinder with a volume of $${k}\\pi$ ${cu(u)}. Its height is equal to the diameter of its circular base.`);
      const out = finish(rng, {
        stimulus: withOpen(rng, OPEN_GEO, stimulus), question: spin(rng, `[[What is the radius of the ${nm}, in ${u}?|Find the radius of the circular base of the ${nm}, in ${u}.|How long is the radius of the base, in ${u}?]]`), correct: d / 2,
        wrongs: [W(d, "other", "지름을 답했다."), W(Math.round(Math.cbrt(k)), "formula_misuse", "V = πd³ 로 가정해 세제곱근을 취했다."), W(d * 2, "formula_misuse", "지름의 두 배를 답했다."), W(Math.round(Math.sqrt(k)), "formula_misuse", "제곱근을 취했다."), W(d / 4, "other", "반지름을 한 번 더 반으로 나눴다.")],
        verificationJs: withParams({ k }, "const out=[];\nfor(let d=1;d<=100;d++){ if(d*d*d===4*P.k) out.push(d/2); }\nif(out.length!==1) throw new Error('유일하지 않음');\nreturn out[0];"),
        trace: [
          ["지름을 d 라 하면 반지름은 d/2, 높이는 d 이다.", "Name the diameter."],
          ["부피 V = π(d/2)²·d = πd³/4 이다.", "Write the volume in d."],
          [`πd³/4 = ${k}π 에서 d³ = ${4 * k} 이다.`, "Equate."],
          [`d = ${d} 이다(세제곱근).`, "Take the cube root."],
          [`반지름은 ${d} ÷ 2 = ${d / 2} 이다.`, "Radius is half the diameter."],
        ],
        variant: "frame",
      });
      return sem(out, [{ v: k, words: ["volume"] }], { words: ["radius"], forbid: forbidExcept("radius") });
    },
  },
  {
    id: "av.cylinder_volume_diameter.chain2", skill: SKILL, kind: "cylinder_volume_diameter", operator: "chain2",
    structure: "밑면의 둘레 Cπ 에서 지름 d=C, 반지름 C/2, 높이 m·d 를 차례로 구해 부피 π r² h 를 계산",
    extraThinking: "둘레→지름→반지름→높이로 앞 결과가 다음 조건이 되는 연쇄(지름·반지름 변환 포함) — medium 은 지름으로 반지름 하나 구하고 부피 계산",
    concepts: ["원의 둘레", "지름과 반지름", "원기둥 부피"], mediumSteps: 2,
    generate(rng) {
      const C = rng.pick([2, 4, 6, 8, 10]), m = rng.int(2, 3); const coef = (m * C ** 3) / 4; if (!Number.isInteger(coef) || coef > 900) throw new GenFail("x");
      const [nm, who] = rng.pick(CANS); const u = rng.pick(["centimeters", "inches", "meters", "feet"] as const);
      const stimulus = spin(rng, `${who} is a right circular cylinder. Its circular base has a circumference of $${C}\\pi$ ${u}, and its height is ${m} times the diameter of the base.`);
      const out = finish(rng, {
        stimulus: withOpen(rng, OPEN_GEO, stimulus), question: spin(rng, `[[What is the volume of the ${nm}, in ${cu(u)}, in terms of π?|Find the volume of the ${nm}, in ${cu(u)}, in terms of π.|How many ${cu(u)} does the ${nm} hold, in terms of π?]]`), correct: coef, fmt: piOpt,
        wrongs: [W(m * C ** 3, "formula_misuse", "둘레의 값을 반지름으로 착각해 부피를 계산했다."), W(coef * 2, "formula_misuse", "높이를 반지름의 비로 계산했다."), W(coef / m, "step_missing", "높이의 배수를 곱하지 않았다."), W((m * C ** 3) / 2, "formula_misuse", "반지름을 한 번만 반으로 나눴다."), W((C * C * m) / 4, "other", "높이를 잘못 계산했다.")],
        verificationJs: withParams({ C, m }, "const d=P.C; const r2x4=d*d; const h=P.m*d; const v=r2x4*h; if(v%4!==0) throw new Error('정수 아님'); return v/4;"),
        trace: [
          [`밑면의 둘레는 πd = ${C}π 이므로 지름 d = ${C} 이다.`, "Diameter from circumference."],
          [`반지름은 ${C} ÷ 2 = ${C / 2} 이다.`, "Radius."],
          [`높이는 지름의 ${m} 배이므로 ${m} × ${C} = ${m * C} 이다.`, "Height."],
          [`부피 = π × ${C / 2}² × ${m * C} 이다.`, "Substitute into the volume formula."],
          [`${(C * C) / 4} × ${m * C} = ${coef} 이므로 부피는 ${coef}π 이다.`, "Compute."],
        ],
        variant: "frame",
      });
      return sem(out, [{ v: C, words: ["circumference"] }, { v: m, words: ["times", "diameter", "height"] }], { words: ["volume", "hold"], forbid: forbidExcept("volume") });
    },
  },
  {
    id: "av.cylinder_volume_diameter.unit_ratio", skill: SKILL, kind: "cylinder_volume_diameter", operator: "unit_ratio",
    structure: "cm 단위 지름·높이에서 반지름을 구해 π r² h (cm³) 를 리터로 환산한 계수를 π 로 나타냄",
    extraThinking: "지름→반지름 변환과 부피 단위 환산(cm³→L)을 함께 처리 — medium 은 지름·높이로 부피(cm³) 계산",
    concepts: ["원기둥 부피", "지름→반지름", "부피 단위 환산"], mediumSteps: 2,
    generate(rng) {
      const d = rng.pick([10, 20, 30, 40, 50, 60]), h = rng.int(2, 90); const r = d / 2; const coef = (r * r * h) / 1000; if (!Number.isInteger(coef) || coef < 1 || coef > 900 || d === h) throw new GenFail("x");
      const [nm, who] = rng.pick([["drum", "A cylindrical drum"], ["water cooler jug", "A cylindrical cooler jug"], ["rain barrel", "A cylindrical rain barrel"], ["milk tank", "A cylindrical milk tank"], ["juice vat", "A cylindrical juice vat"]]);
      const stimulus = spin(rng, `${who} has a diameter of ${d} centimeters and a height of ${h} centimeters. [[There are 1000 cubic centimeters in 1 liter.|Recall that 1 liter equals 1000 cubic centimeters.]]`);
      const out = finish(rng, {
        stimulus: withOpen(rng, OPEN_GEO, stimulus), question: spin(rng, `[[What is the volume of the ${nm}, in liters, in terms of π?|Find the volume of the ${nm}, in liters, in terms of π.|How many liters does the ${nm} hold, in terms of π?]]`), correct: coef, fmt: piOpt,
        wrongs: [W(coef * 4, "geometry_misapplied", "지름을 반지름처럼 제곱해 계산했다."), W(coef * 1000, "unit_error", "리터로 환산하지 않았다."), W(coef * 2, "formula_misuse", "지름을 한 번만 곱했다."), W(coef * 10, "unit_error", "환산 계수를 100 으로 썼다."), W(r * r * h, "step_missing", "cm³ 부피를 답했다."), W(coef / 2, "other", "반지름을 두 번 반으로 나눴다.")],
        verificationJs: withParams({ d, h }, "const v=(P.d*P.d*P.h)/4; if(v%1000!==0) throw new Error('정수 아님'); return v/1000;"),
        trace: [
          [`지름이 ${d} 이므로 반지름은 ${d} ÷ 2 = ${r} cm 이다.`, "Radius from diameter."],
          [`밑면의 넓이는 π × ${r}² = ${r * r}π cm² 이다.`, "Base area."],
          [`부피 = ${r * r}π × ${h} = ${r * r * h}π cm³ 이다.`, "Volume in cm³."],
          ["1 L = 1000 cm³ 이므로 1000 으로 나눈다.", "Convert."],
          [`부피는 ${coef}π 리터이다.`, "Answer."],
        ],
        variant: "frame",
      });
      return sem(out, [{ v: d, words: ["diameter"] }, { v: h, words: ["height"] }], { words: ["liters", "volume"], forbid: forbidExcept("volume") });
    },
  },
  {
    id: "av.cylinder_volume_diameter.compare_scenarios", skill: SKILL, kind: "cylinder_volume_diameter", operator: "compare_scenarios",
    structure: "지름으로 주어진 원기둥 A 와 반지름으로 주어진 원기둥 B 의 부피가 같을 때 (d_A/2)² h_A = r_B² h_B 로 B 의 높이를 구함",
    extraThinking: "한쪽은 지름, 다른 쪽은 반지름으로 주어진 두 조건을 같은 기준(반지름)으로 맞춰 비교 — medium 은 지름으로 부피 하나 계산",
    concepts: ["원기둥 부피", "지름·반지름 통일", "부피 동일 조건 비교"], mediumSteps: 2,
    generate(rng) {
      const rA = rng.int(2, 10), hA = rng.int(2, 18), rB = rng.int(2, 12); const dA = 2 * rA; if (rA === rB || (rA * rA * hA) % (rB * rB) !== 0) throw new GenFail("x"); const hB = (rA * rA * hA) / (rB * rB);
      if (hB === hA || hB > 99 || dA === rB || hA === dA || hB === rB || hB === hA) throw new GenFail("x"); const [nm] = rng.pick(CANS); const [C1, c2, cs] = rng.pick([["Can A", "can B", "cans"], ["Jar A", "jar B", "jars"], ["Drum A", "drum B", "drums"], ["Tank A", "tank B", "tanks"], ["Cup A", "cup B", "cups"]] as const);
      const stimulus = spin(rng, `[[${C1} is a cylinder with a diameter of ${dA} centimeters and a height of ${hA} centimeters.|${C1} is a cylinder whose height is ${hA} centimeters and whose diameter is ${dA} centimeters.|The cylinder ${C1} has a diameter of ${dA} centimeters, and its height is ${hA} centimeters.]] [[${c2[0].toUpperCase() + c2.slice(1)} is a cylinder with a radius of ${rB} centimeters.|The radius of ${c2}, also a cylinder, is ${rB} centimeters.|${c2[0].toUpperCase() + c2.slice(1)} is another cylinder, and its radius is ${rB} centimeters.]] [[The two ${cs} hold exactly the same volume.|Both ${cs} can hold precisely the same volume of liquid.|The volume that ${C1} holds equals the volume that ${c2} holds.]]`);
      const out = finish(rng, {
        stimulus: withOpen(rng, OPEN_GEO, stimulus), question: spin(rng, `[[What is the height of ${c2}, in centimeters?|Find the height of ${c2}, in centimeters.|How tall is ${c2}, in centimeters?|Determine the height of ${c2} in centimeters.]]`), correct: hB,
        wrongs: [W((dA * dA * hA) / (rB * rB), "geometry_misapplied", "A 의 지름을 반지름처럼 제곱해 계산했다."), W((rA * rA * hA) / (2 * rB) , "formula_misuse", "B 의 반지름을 지름으로 착각했다."), W((dA * dA * hA) / (4 * rB * rB * 4), "other", "계산 실수."), W(hA, "step_missing", "같은 높이라고 답했다."), W((rA * hA) / rB, "formula_misuse", "높이가 반지름에 반비례한다고 보았다.")],
        verificationJs: withParams({ dA, hA, rB }, "const out=[];\nfor(let h=1;h<=2000;h++){ if(P.dA*P.dA*P.hA===4*P.rB*P.rB*h) out.push(h); }\nif(out.length!==1) throw new Error('유일하지 않음');\nreturn out[0];"),
        trace: [
          [`A 의 지름이 ${dA} 이므로 반지름은 ${rA} 이다.`, "Radius of A from its diameter."],
          [`A 의 부피는 π × ${rA}² × ${hA} = ${rA * rA * hA}π 이다.`, "Volume of A."],
          [`B 의 반지름은 ${rB} 이므로 부피는 π × ${rB}² × h = ${rB * rB}πh 이다.`, "Volume of B."],
          ["두 부피가 같으므로 π 를 약분한다.", "Equate the volumes."],
          [`${rB * rB}h = ${rA * rA * hA} 이므로 h = ${hB} 이다.`, "Solve for the height."],
        ],
        variant: "frame",
      });
      return sem(out, [{ v: dA, words: ["diameter"] }, { v: rB, words: ["radius"] }, { v: hA, words: ["height"] }], { words: ["height", "tall"], forbid: forbidExcept("height") });
    },
  },
 ] as Archetype[]).map(paraArch);

// ───────────────────────── easy / medium 원형(lite) — 12개 틀 ─────────────────────────
const nz = (rng: Rng, lo: number, hi: number, step = 1) => rng.int(Math.ceil(lo / step), Math.floor(hi / step)) * step;
const dim = (rng: Rng, level: Level) => (level === "easy" ? rng.int(3, 15) : rng.int(8, 40));
const ROOMS = [["room", "A rectangular room"], ["gym floor", "A rectangular gym floor"], ["classroom", "A rectangular classroom"], ["terrace", "A rectangular terrace"], ["lobby", "A rectangular lobby"], ["dance floor", "A rectangular dance floor"], ["workshop", "A rectangular workshop"], ["library hall", "A rectangular library hall"]] as const;
const WALLS = [["wall", "A rectangular wall"], ["mural panel", "A rectangular mural panel"], ["fence section", "A rectangular fence section"], ["billboard", "A rectangular billboard"], ["classroom door", "A rectangular door panel"], ["bulletin board", "A rectangular bulletin board"]] as const;
const FRACS = [[1, 2, "1/2"], [3, 4, "3/4"], [1, 4, "1/4"], [2, 3, "2/3"]] as const;

export const AV_LITE: LiteArchetype[] = [
  {
    id: "av.rectangle_area.floor", skill: SKILL, kind: "rectangle_area", frame: "floor", levels: ["easy", "medium"], structure: "가로×세로 넓이(easy) / 넓이×단가 비용(medium)",
    generate(rng, level) {
      const l = dim(rng, level), w = dim(rng, level), [nm, who] = rng.pick(ROOMS), u = rng.pick(UNITS); if (l === w) throw new GenFail("x"); const price = rng.pick([2, 3, 4, 5, 6, 8]);
      const A = l * w; const ans = level === "easy" ? A : A * price; if (ans > 9000) throw new GenFail("x");
      const stimulus = withOpen(rng, OPEN_GEO, spin(rng, `${who} has a length of ${l} ${u} and a width of ${w} ${u}.${level === "easy" ? "" : ` New flooring costs ${price} dollars for each square ${SING[u]}.`}`));
      const out = finish(rng, { stimulus, question: spin(rng, level === "easy" ? `[[What is the area of the ${nm}, in ${sq(u)}?|Find the area of the ${nm}, in ${sq(u)}.|How many ${sq(u)} does the ${nm} cover?]]` : `[[What is the total cost, in dollars, to put new flooring over the whole ${nm}?|How many dollars does the flooring for the entire ${nm} cost?|Find the total cost of the flooring, in dollars.]]`), correct: ans,
        wrongs: [W(2 * (l + w), "geometry_misapplied", "넓이 대신 둘레를 계산했다."), W(l + w, "formula_misuse", "가로와 세로를 더했다."), W(level === "easy" ? A + l : A + price, "other", "계산 실수."), W(level === "easy" ? 2 * A : 2 * (l + w) * price, "formula_misuse", level === "easy" ? "넓이를 두 배로 계산했다." : "둘레에 단가를 곱했다.")],
        verificationJs: withParams({ l, w, price: level === "easy" ? 1 : price, easy: level === "easy" ? 1 : 0 }, "let cells=0; for(let i=0;i<P.l;i++) for(let j=0;j<P.w;j++) cells++;\nreturn P.easy? cells : cells*P.price;"),
        trace: [[`넓이 = ${l} × ${w} = ${A} 이다.`, "Area of the rectangle."], ...(level === "easy" ? [] : [[`비용 = ${A} × ${price} = ${ans} 달러이다.`, "Multiply by the unit cost."] as [string, string]])], variant: level === "easy" ? "area" : "cost" });
      return sem(out, [{ v: l, words: ["length"] }, { v: w, words: ["width"] }], { words: level === "easy" ? ["area", "cover"] : ["cost", "dollars"], forbid: forbidExcept(...(level === "easy" ? ["area"] : [])) });
    },
  },
  {
    id: "av.rectangle_area.wall", skill: SKILL, kind: "rectangle_area", frame: "wall", levels: ["easy", "medium"], structure: "직사각형 넓이(easy) / 큰 직사각형에서 작은 직사각형을 뺀 넓이(medium)",
    generate(rng, level) {
      const l = dim(rng, level) + 4, w = dim(rng, level) + 3, [nm, who] = rng.pick(WALLS), u = rng.pick(UNITS); const a = rng.int(2, Math.max(2, Math.floor(l / 2))), b = rng.int(2, Math.max(2, Math.floor(w / 2))); if (l === w || a === b) throw new GenFail("x");
      const A = l * w, ans = level === "easy" ? A : A - a * b;
      const stimulus = withOpen(rng, OPEN_GEO, spin(rng, `${who} measures ${l} ${u} by ${w} ${u}.${level === "easy" ? "" : ` A rectangular opening measuring ${a} ${u} by ${b} ${u} is cut out of it.`}`));
      return finish(rng, { stimulus, question: spin(rng, level === "easy" ? `[[What is the area of the ${nm}, in ${sq(u)}?|Find the area of the ${nm}, in ${sq(u)}.]]` : `[[What is the area of the ${nm} that remains after the opening is cut out, in ${sq(u)}?|How many ${sq(u)} of the ${nm} are left once the opening is removed?]]`), correct: ans,
        wrongs: [W(2 * (l + w), "geometry_misapplied", "넓이 대신 둘레를 계산했다."), W(level === "easy" ? l + w : A, "step_missing", level === "easy" ? "가로와 세로를 더했다." : "구멍의 넓이를 빼지 않았다."), W(level === "easy" ? A + w : A + a * b, "other", level === "easy" ? "계산 실수." : "구멍의 넓이를 더했다."), W(level === "easy" ? A * 2 : a * b, "other", level === "easy" ? "넓이를 두 배로 계산했다." : "구멍의 넓이만 답했다.")],
        verificationJs: withParams({ l, w, a: level === "easy" ? 1 : a, b: level === "easy" ? 1 : b, easy: level === "easy" ? 1 : 0 }, "let c=0; for(let i=0;i<P.l;i++) for(let j=0;j<P.w;j++){ const hole=(!P.easy) && i<P.a && j<P.b; if(!hole) c++; }\nreturn c;"),
        trace: [[`전체 넓이는 ${l} × ${w} = ${A} 이다.`, "Whole area."], ...(level === "easy" ? [] : [[`구멍의 넓이는 ${a} × ${b} = ${a * b} 이므로 남는 넓이는 ${A} − ${a * b} = ${ans} 이다.`, "Subtract the opening."] as [string, string]])], variant: level === "easy" ? "area" : "with_opening" });
    },
  },
  {
    id: "av.triangle_area.sail", skill: SKILL, kind: "triangle_area", frame: "sail", levels: ["easy", "medium"], structure: "삼각형 넓이(easy) / 같은 삼각형 n 장의 넓이 합(medium)",
    generate(rng, level) {
      const b = nz(rng, 4, level === "easy" ? 30 : 60, 2), h = nz(rng, 3, level === "easy" ? 20 : 40), n = rng.int(2, 5); if ((b * h) % 2 !== 0 || b === h || n === h || n === b) throw new GenFail("x");
      const [nm, who] = rng.pick([["sail", "A triangular sail"], ["pennant", "A triangular pennant"], ["road sign", "A triangular road sign"], ["tent flap", "A triangular tent flap"], ["garden bed", "A triangular garden bed"], ["roof panel", "A triangular roof panel"]]); const u = rng.pick(UNITS);
      const A = (b * h) / 2, ans = level === "easy" ? A : A * n;
      const stimulus = withOpen(rng, OPEN_GEO, spin(rng, `${who} has a base of ${b} ${u} and a height of ${h} ${u}.${level === "easy" ? "" : ` A crew makes ${n} identical ones.`}`));
      const out = finish(rng, { stimulus, question: spin(rng, level === "easy" ? `[[What is the area of the ${nm}, in ${sq(u)}?|Find the area of the ${nm}, in ${sq(u)}.]]` : `[[What is the total area of all ${n} ${nm}s together, in ${sq(u)}?|How many ${sq(u)} do the ${n} ${nm}s cover altogether?]]`), correct: ans,
        wrongs: [W(level === "easy" ? b * h : b * h * n, "formula_misuse", "÷2 를 빼먹었다."), W(level === "easy" ? b + h : A, "step_missing", level === "easy" ? "밑변과 높이를 더했다." : "한 개의 넓이만 답했다."), W(level === "easy" ? A + b : A * n + n, "other", "계산 실수."), W(level === "easy" ? (b * h) / 4 : (A * n) / 2, "formula_misuse", "÷2 를 두 번 했다.")],
        verificationJs: withParams({ b, h, n: level === "easy" ? 1 : n, easy: level === "easy" ? 1 : 0 }, "const area2=P.b*P.h; return (P.easy? area2 : area2*P.n)/2;"),
        trace: [[`한 개의 넓이 = (1/2) × ${b} × ${h} = ${A} 이다.`, "Area of one triangle."], ...(level === "easy" ? [] : [[`${n} 개이므로 ${A} × ${n} = ${ans} 이다.`, "Multiply by the number."] as [string, string]])], variant: level === "easy" ? "area" : "total_of_n" });
      return sem(out, [{ v: b, words: ["base"] }, { v: h, words: ["height"] }], { words: ["area", "cover"], forbid: forbidExcept("area") });
    },
  },
  {
    id: "av.triangle_area.garden", skill: SKILL, kind: "triangle_area", frame: "garden", levels: ["easy", "medium"], structure: "삼각형 넓이(easy) / 넓이와 밑변으로 높이 역산(medium)",
    generate(rng, level) {
      const b = nz(rng, 4, 40, 2), h = nz(rng, 3, 30); if (b === h) throw new GenFail("x"); const A = (b * h) / 2; const [nm, who] = rng.pick([["flower bed", "A triangular flower bed"], ["lot", "A triangular lot"], ["banner", "A triangular banner"], ["shade cloth", "A triangular shade cloth"], ["window pane", "A triangular window pane"], ["ramp side", "A triangular ramp side"]]); const u = rng.pick(UNITS);
      const stimulus = withOpen(rng, OPEN_GEO, spin(rng, level === "easy" ? `${who} has a base of ${b} ${u} and a height of ${h} ${u}.` : `${who} has an area of ${A} ${sq(u)} and a base of ${b} ${u}.`));
      const out = finish(rng, { stimulus, question: spin(rng, level === "easy" ? `[[What is the area of the ${nm}, in ${sq(u)}?|Find the area of the ${nm}, in ${sq(u)}.]]` : `[[What is the height of the ${nm}, in ${u}?|Find the height of the ${nm}, in ${u}.]]`), correct: level === "easy" ? A : h,
        wrongs: level === "easy" ? [W(b * h, "formula_misuse", "÷2 를 빼먹었다."), W(b + h, "formula_misuse", "밑변과 높이를 더했다."), W(A + h, "other", "계산 실수."), W((b * h) / 4, "formula_misuse", "÷2 를 두 번 했다.")]
          : [W(A / b, "formula_misuse", "÷2 를 빼먹고 A÷b 를 높이로 답했다."), W(A * 2, "step_missing", "넓이의 2 배를 답했다."), W(2 * A * b, "formula_misuse", "넓이에 밑변을 곱했다."), W(A - b, "formula_misuse", "넓이에서 밑변을 뺐다.")],
        verificationJs: withParams(level === "easy" ? { b, h, easy: 1 } : { A, b, easy: 0 }, "if(P.easy) return P.b*P.h/2;\nfor(let h=1;h<=1000;h++){ if(P.b*h===2*P.A) return h; }\nthrow new Error('없음');"),
        trace: level === "easy" ? [[`넓이 = (1/2) × ${b} × ${h} = ${A} 이다.`, "Apply the formula."]] : [[`넓이 = (1/2) × 밑변 × 높이 이므로 ${A} = (1/2) × ${b} × h 이다.`, "Set up the formula."], [`h = 2 × ${A} ÷ ${b} = ${h} 이다.`, "Solve for the height."]], variant: level === "easy" ? "area" : "find_height" });
      return sem(out, level === "easy" ? [{ v: b, words: ["base"] }, { v: h, words: ["height"] }] : [{ v: A, words: ["area"] }, { v: b, words: ["base"] }], { words: level === "easy" ? ["area"] : ["height"], forbid: forbidExcept(level === "easy" ? "area" : "height") });
    },
  },
  {
    id: "av.prism_volume.box", skill: SKILL, kind: "prism_volume", frame: "box", levels: ["easy", "medium"], structure: "직육면체 부피(easy) / 같은 상자 n 개의 부피 합(medium)",
    generate(rng, level) {
      const l = rng.int(2, level === "easy" ? 10 : 14), w = rng.int(2, level === "easy" ? 10 : 12), h = rng.int(2, level === "easy" ? 9 : 10), n = rng.int(2, 6); if (new Set([l, w, h]).size < 2 || n === l || n === w || n === h) throw new GenFail("x");
      const [nm, who] = rng.pick([["box", "A rectangular box"], ["crate", "A shipping crate"], ["aquarium", "A glass aquarium"], ["toolbox", "A toolbox"], ["storage bin", "A storage bin"], ["gift box", "A gift box"]]); const u = rng.pick(UNITS); const V = l * w * h, ans = level === "easy" ? V : V * n;
      const stimulus = withOpen(rng, OPEN_GEO, spin(rng, `${who} has a length of ${l} ${u}, a width of ${w} ${u}, and a height of ${h} ${u}.${level === "easy" ? "" : ` A warehouse stores ${n} identical ones.`}`));
      const out = finish(rng, { stimulus, question: spin(rng, level === "easy" ? `[[What is the volume of the ${nm}, in ${cu(u)}?|Find the volume of the ${nm}, in ${cu(u)}.]]` : `[[What is the total volume of all ${n} ${plural(nm)} together, in ${cu(u)}?|How many ${cu(u)} do the ${n} identical ${plural(nm)} hold altogether?]]`), correct: ans,
        wrongs: [W(2 * (l * w + l * h + w * h) * (level === "easy" ? 1 : n), "geometry_misapplied", "부피 대신 겉넓이를 계산했다."), W(l + w + h, "formula_misuse", "세 치수를 더했다."), W(level === "easy" ? l * w : V, "step_missing", level === "easy" ? "밑넓이만 구했다." : "상자 하나의 부피만 답했다."), W(level === "easy" ? V + l : V * n + n, "other", "계산 실수.")],
        verificationJs: withParams({ l, w, h, n: level === "easy" ? 1 : n, easy: level === "easy" ? 1 : 0 }, "let c=0; for(let i=0;i<P.l;i++) for(let j=0;j<P.w;j++) for(let k=0;k<P.h;k++) c++;\nreturn P.easy? c : c*P.n;"),
        trace: [[`한 상자의 부피 = ${l} × ${w} × ${h} = ${V} 이다.`, "Volume of one box."], ...(level === "easy" ? [] : [[`${n} 개이므로 ${V} × ${n} = ${ans} 이다.`, "Multiply by the number of boxes."] as [string, string]])], variant: level === "easy" ? "volume" : "total_of_n" });
      return sem(out, [{ v: l, words: ["length"] }, { v: w, words: ["width"] }, { v: h, words: ["height"] }], { words: ["volume", "hold"], forbid: forbidExcept("volume") });
    },
  },
  {
    id: "av.prism_volume.tank", skill: SKILL, kind: "prism_volume", frame: "tank", levels: ["easy", "medium"], structure: "수조 부피(easy) / 분수만큼 찬 물의 부피(medium)",
    generate(rng, level) {
      const l = nz(rng, 4, level === "easy" ? 20 : 40, 2), w = nz(rng, 4, level === "easy" ? 16 : 30, 2), h = nz(rng, 4, level === "easy" ? 12 : 24, 4); if (l === w) throw new GenFail("x"); const [fn, fd, fw] = rng.pick(FRACS); const V = l * w * h; const ans = level === "easy" ? V : (V * fn) / fd; if (!Number.isInteger(ans)) throw new GenFail("x");
      const [nm, who] = rng.pick([["tank", "A rectangular water tank"], ["pool", "A rectangular pool"], ["fish tank", "A rectangular fish tank"], ["trough", "A rectangular trough"], ["planter", "A rectangular planter"], ["cistern", "A rectangular cistern"]]); const u = rng.pick(UNITS);
      const stimulus = withOpen(rng, OPEN_GEO, spin(rng, `${who} has a length of ${l} ${u}, a width of ${w} ${u}, and a depth of ${h} ${u}.${level === "easy" ? "" : ` The ${nm} is currently filled to ${fw} of its capacity.`}`));
      const out = finish(rng, { stimulus, question: spin(rng, level === "easy" ? `[[What is the volume of the ${nm}, in ${cu(u)}?|Find the volume of the ${nm}, in ${cu(u)}.]]` : `[[How many ${cu(u)} of water are in the ${nm}?|What is the volume of the water in the ${nm}, in ${cu(u)}?]]`), correct: ans,
        wrongs: [W(level === "easy" ? 2 * (l * w + l * h + w * h) : V, "step_missing", level === "easy" ? "겉넓이를 계산했다." : "가득 찼을 때의 부피를 답했다."), W(l + w + h, "formula_misuse", "세 치수를 더했다."), W(level === "easy" ? l * w : (V * (fd - fn)) / fd, level === "easy" ? "step_missing" : "opposite", level === "easy" ? "밑넓이만 구했다." : "비어 있는 부분의 부피를 답했다."), W(level === "easy" ? V + w : (V * fn) / fd + l, "other", "계산 실수.")],
        verificationJs: withParams({ l, w, h, fn: level === "easy" ? 1 : fn, fd: level === "easy" ? 1 : fd, easy: level === "easy" ? 1 : 0 }, "let c=0; for(let i=0;i<P.l;i++) for(let j=0;j<P.w;j++) for(let k=0;k<P.h;k++) c++;\nreturn P.easy? c : c*P.fn/P.fd;"),
        trace: [[`수조의 부피 = ${l} × ${w} × ${h} = ${V} 이다.`, "Volume of the tank."], ...(level === "easy" ? [] : [[`${fw}(${fn}/${fd}) 만큼 찼으므로 ${V} × ${fn}/${fd} = ${ans} 이다.`, "Take the filled fraction."] as [string, string]])], variant: level === "easy" ? "volume" : "filled_fraction" });
      return sem(out, [{ v: l, words: ["length"] }, { v: w, words: ["width"] }, { v: h, words: ["depth"] }], { words: ["volume", "water"], forbid: forbidExcept("volume") });
    },
  },
  {
    id: "av.prism_missing_dimension.box", skill: SKILL, kind: "prism_missing_dimension", frame: "box", levels: ["easy", "medium"], structure: "부피와 두 치수로 높이(easy) / 부피·길이와 '너비=높이' 관계로 너비(medium)",
    generate(rng, level) {
      const l = rng.int(2, 12), w = rng.int(2, level === "easy" ? 12 : 9), h = level === "easy" ? rng.int(2, 12) : w; if (new Set([l, w, h]).size < 2 && level === "easy") throw new GenFail("x"); if (level === "medium" && l === w) throw new GenFail("x"); const V = l * w * h; if (V > 999) throw new GenFail("x");
      const [nm, who] = rng.pick([["box", "A rectangular box"], ["crate", "A wooden crate"], ["cooler", "A rectangular cooler"], ["toy chest", "A toy chest"], ["suitcase", "A rectangular suitcase"], ["planter", "A rectangular planter"]]); const u = rng.pick(UNITS);
      const stimulus = withOpen(rng, OPEN_GEO, spin(rng, level === "easy" ? `${who} has a volume of ${V} ${cu(u)}, a length of ${l} ${u}, and a width of ${w} ${u}.` : `${who} has a volume of ${V} ${cu(u)} and a length of ${l} ${u}. Its width and its height are equal.`));
      const ask = level === "easy" ? h : w;
      const out = finish(rng, { stimulus, question: spin(rng, level === "easy" ? `[[What is the height of the ${nm}, in ${u}?|Find the height of the ${nm}, in ${u}.]]` : `[[What is the width of the ${nm}, in ${u}?|Find the width of the ${nm}, in ${u}.]]`), correct: ask,
        wrongs: level === "easy" ? [W(V / l, "step_missing", "한 치수만 나눴다."), W(V - l - w, "formula_misuse", "부피에서 두 치수를 뺐다."), W(V / (l + w), "formula_misuse", "두 치수의 합으로 나눴다."), W(h + 1, "other", "계산 실수.")]
          : [W(V / l, "step_missing", "너비×높이(=w²)를 너비로 답했다."), W(V / (2 * l), "formula_misuse", "w² 대신 2w 로 나눴다."), W(w * w, "other", "너비의 제곱을 답했다."), W(V - l, "formula_misuse", "부피에서 길이를 뺐다.")],
        verificationJs: withParams({ V, l, w, easy: level === "easy" ? 1 : 0 }, "if(P.easy){ for(let h=1;h<=1000;h++) if(P.l*P.w*h===P.V) return h; throw new Error('없음'); }\nfor(let w=1;w<=1000;w++) if(P.l*w*w===P.V) return w;\nthrow new Error('없음');"),
        trace: level === "easy" ? [[`부피 = 길이 × 너비 × 높이 이므로 ${V} = ${l} × ${w} × h 이다.`, "Set up the volume formula."], [`h = ${V} ÷ ${l * w} = ${h} 이다.`, "Divide."]] : [[`너비와 높이가 같으므로 둘을 w 라 하면 ${V} = ${l} × w × w 이다.`, "Use w for both."], [`w² = ${V / l} 이다.`, "Divide by the length."], [`w = ${w} 이다.`, "Take the positive root."]], variant: level === "easy" ? "find_height" : "square_cross_section" });
      return sem(out, [{ v: V, words: ["volume", "holds", "contains"] }, { v: l, words: ["length"] }, ...(level === "easy" ? [{ v: w, words: ["width"] }] : [])], { words: [level === "easy" ? "height" : "width"], forbid: forbidExcept(level === "easy" ? "height" : "width") });
    },
  },
  {
    id: "av.prism_missing_dimension.tank", skill: SKILL, kind: "prism_missing_dimension", frame: "tank", levels: ["easy", "medium"], structure: "부피와 밑넓이로 높이(easy) / 부피와 밑면 두 변으로 높이(medium)",
    generate(rng, level) {
      const l = rng.int(3, level === "easy" ? 10 : 15), w = rng.int(3, level === "easy" ? 10 : 12), h = rng.int(2, 12); if (l === w) throw new GenFail("x"); const V = l * w * h; if (V > 999) throw new GenFail("x");
      const [nm, who] = rng.pick([["tank", "A rectangular water tank"], ["pool", "A small rectangular pool"], ["sandbox", "A rectangular sandbox"], ["bin", "A rectangular storage bin"], ["pond", "A garden pond shaped like a box"], ["tub", "A rectangular tub"]]); const u = rng.pick(UNITS);
      const stimulus = withOpen(rng, OPEN_GEO, spin(rng, level === "easy" ? `${who} holds ${V} ${cu(u)} when full. Its base has an area of ${l * w} ${sq(u)}.` : `${who} holds ${V} ${cu(u)} when full. Its base is a rectangle that is ${l} ${u} by ${w} ${u}.`));
      const out = finish(rng, { stimulus, question: spin(rng, `[[How deep is the ${nm}, in ${u}?|What is the depth of the ${nm}, in ${u}?|Find the depth of the ${nm}, in ${u}.]]`), correct: h,
        wrongs: [W(V / l, "step_missing", "한 변으로만 나눴다."), W(V - l * w, "formula_misuse", "부피에서 밑넓이를 뺐다."), W(V / (l + w), "formula_misuse", "두 변의 합으로 나눴다."), W(h + 1, "other", "계산 실수.")],
        verificationJs: withParams(level === "easy" ? { V, B: l * w } : { V, l, w }, level === "easy" ? "for(let h=1;h<=1000;h++){ if(P.B*h===P.V) return h; }\nthrow new Error('없음');" : "for(let h=1;h<=1000;h++){ if(P.l*P.w*h===P.V) return h; }\nthrow new Error('없음');"),
        trace: level === "easy" ? [[`부피 = 밑넓이 × 깊이 이므로 ${V} = ${l * w} × d 이다.`, "Volume equals base area times depth."], [`d = ${V} ÷ ${l * w} = ${h} 이다.`, "Divide."]] : [[`밑넓이는 ${l} × ${w} = ${l * w} 이다.`, "Compute the base area."], [`깊이 = ${V} ÷ ${l * w} = ${h} 이다.`, "Divide the volume by the base area."]], variant: level === "easy" ? "base_area_given" : "base_sides_given" });
      return sem(out, level === "easy" ? [{ v: V, words: ["holds", "contains"] }, { v: l * w, words: ["area"] }] : [{ v: V, words: ["holds", "contains"] }, { v: l, words: ["base"] }, { v: w, words: ["base"] }], { words: ["deep", "depth"], forbid: forbidExcept() });
    },
  },
  {
    id: "av.cylinder_volume_radius.can", skill: SKILL, kind: "cylinder_volume_radius", frame: "can", levels: ["easy", "medium"], structure: "원기둥 부피(easy) / n 개 합(medium)",
    generate(rng, level) {
      const r = rng.int(2, level === "easy" ? 9 : 14), h = rng.int(2, level === "easy" ? 12 : 16), n = rng.int(2, 5); if (r === h || n === r || n === h) throw new GenFail("x"); const [nm, who] = rng.pick(CANS); const u = rng.pick(["centimeters", "inches", "meters", "feet"] as const);
      const c = r * r * h, ans = level === "easy" ? c : c * n; if (ans > 9000) throw new GenFail("x");
      const stimulus = withOpen(rng, OPEN_GEO, spin(rng, `[[${who} is a right circular cylinder with a radius of ${r} ${u} and a height of ${h} ${u}.|${who} is a right circular cylinder whose radius is ${r} ${u} and whose height is ${h} ${u}.|The cylinder, ${who.charAt(0).toLowerCase() + who.slice(1)}, has a radius of ${r} ${u} and stands ${h} ${u} in height.]]${level === "easy" ? "" : ` [[A shop stocks ${n} identical ones.|There are ${n} identical ones on a shop shelf.|A store keeps ${n} identical ones in stock.]]`}`));
      const out = finish(rng, { stimulus, question: spin(rng, level === "easy" ? `[[What is the volume of the ${nm}, in ${cu(u)}, in terms of π?|Find the volume of the ${nm}, in ${cu(u)}, in terms of π.|How many ${cu(u)} does the ${nm} hold, in terms of π?|Determine the volume of the ${nm} in ${cu(u)}, leaving the answer in terms of π.]]` : `[[What is the total volume of all ${n} identical ones, in ${cu(u)}, in terms of π?|Altogether, how many ${cu(u)} do the ${n} identical ones hold, in terms of π?|Find the combined volume of the ${n} identical ones, in ${cu(u)}, in terms of π.]]`), correct: ans, fmt: piOpt,
        wrongs: [W(level === "easy" ? 2 * r * h : 2 * r * h * n, "formula_misuse", "옆넓이 형태(2πrh)로 계산했다."), W(level === "easy" ? r * h : r * h * n, "formula_misuse", "r² 대신 r 을 곱했다."), W(level === "easy" ? 4 * r * r * h : 4 * c * n, "geometry_misapplied", "반지름 대신 지름을 제곱했다."), W(level === "easy" ? c + r : c * n + n, "other", "계산 실수."), W(level === "easy" ? r * r : c, level === "easy" ? "step_missing" : "step_missing", level === "easy" ? "밑넓이만 답했다." : "하나의 부피만 답했다.")],
        verificationJs: withParams({ r, h, n: level === "easy" ? 1 : n, easy: level === "easy" ? 1 : 0 }, "let v=0; for(let i=0;i<P.r*P.r;i++) v+=P.h;\nreturn P.easy? v : v*P.n;"),
        trace: [[`한 개의 부피 = π × ${r}² × ${h} = ${c}π 이다.`, "Volume of one cylinder."], ...(level === "easy" ? [] : [[`${n} 개이므로 ${c}π × ${n} = ${ans}π 이다.`, "Multiply by the number."] as [string, string]])], variant: level === "easy" ? "volume" : "total_of_n" });
      return sem(out, [{ v: r, words: ["radius"] }, { v: h, words: ["height"] }], { words: ["volume", "hold"], forbid: forbidExcept("volume") });
    },
  },
  {
    id: "av.cylinder_volume_radius.pipe", skill: SKILL, kind: "cylinder_volume_radius", frame: "pipe", levels: ["easy", "medium"], structure: "관의 부피(easy) / 밑넓이 kπ 로 부피(medium)",
    generate(rng, level) {
      const r = rng.int(2, 12), h = rng.int(3, 20); if (r === h) throw new GenFail("x"); const [nm, who] = rng.pick([["pipe", "A cylindrical pipe"], ["water main", "A cylindrical water main"], ["silo", "A cylindrical silo"], ["column", "A cylindrical column"], ["tube", "A cylindrical tube"], ["pillar", "A cylindrical pillar"]]); const u = rng.pick(["centimeters", "inches", "meters", "feet"] as const);
      const c = r * r * h; if (c > 9000) throw new GenFail("x");
      const stimulus = withOpen(rng, OPEN_GEO, spin(rng, level === "easy" ? `[[${who} has a radius of ${r} ${u} and a length of ${h} ${u}.|${who} has these dimensions: its radius is ${r} ${u} and its length is ${h} ${u}.|${who} has a circular cross-section of radius ${r} ${u}, and its length is ${h} ${u}.]]` : `[[${who} has a circular base with an area of $${r * r}\\pi$ ${sq(u)}. Its length is ${h} ${u}.|The circular base of ${who.charAt(0).toLowerCase() + who.slice(1)} has an area of $${r * r}\\pi$ ${sq(u)}, and its length is ${h} ${u}.|${who} is ${h} ${u} in length, and the area of its circular base is $${r * r}\\pi$ ${sq(u)}.]]`));
      const out = finish(rng, { stimulus, question: spin(rng, `[[What is the volume of the ${nm}, in ${cu(u)}, in terms of π?|Find the volume of the ${nm}, in ${cu(u)}, in terms of π.|How many ${cu(u)} does the ${nm} hold, in terms of π?|Determine the volume of the ${nm} in ${cu(u)}, leaving the answer in terms of π.]]`), correct: c, fmt: piOpt,
        wrongs: [W(2 * r * h, "formula_misuse", "옆넓이 형태로 계산했다."), W(r * h, "formula_misuse", "r² 대신 r 을 곱했다."), W(r * r + h, "formula_misuse", "밑넓이에 길이를 더했다."), W(level === "easy" ? 4 * c : r * r * h * 2, "geometry_misapplied", level === "easy" ? "반지름 대신 지름을 제곱했다." : "밑넓이 계수를 두 번 곱했다."), W(r * r, "step_missing", "밑넓이만 답했다.")],
        verificationJs: withParams(level === "easy" ? { r, h } : { a: r * r, h }, level === "easy" ? "let v=0; for(let i=0;i<P.r*P.r;i++) v+=P.h;\nreturn v;" : "let v=0; for(let i=0;i<P.a;i++) v+=P.h;\nreturn v;"),
        trace: level === "easy" ? [[`밑넓이 = π × ${r}² = ${r * r}π 이다.`, "Base area."], [`부피 = ${r * r}π × ${h} = ${c}π 이다.`, "Multiply by the length."]] : [[`밑넓이가 이미 ${r * r}π 로 주어졌다.`, "The base area is given."], [`부피 = 밑넓이 × 길이 = ${r * r}π × ${h} = ${c}π 이다.`, "Multiply by the length."]], variant: level === "easy" ? "radius_given" : "base_area_given" });
      return sem(out, level === "easy" ? [{ v: r, words: ["radius"] }, { v: h, words: ["length"] }] : [{ v: r * r, words: ["area", "base"] }, { v: h, words: ["length"] }], { words: ["volume", "hold"], forbid: forbidExcept("volume") });
    },
  },
  {
    id: "av.cylinder_volume_diameter.can", skill: SKILL, kind: "cylinder_volume_diameter", frame: "can", levels: ["easy", "medium"], structure: "지름으로 주어진 원기둥 부피(easy) / 분수만큼 찬 부피(medium)",
    generate(rng, level) {
      const r = rng.int(2, level === "easy" ? 9 : 12), h = rng.int(2, level === "easy" ? 12 : 16), d = 2 * r; if (d === h) throw new GenFail("x"); const [fn, fd, fw] = rng.pick(FRACS); const c = r * r * h; const ans = level === "easy" ? c : (c * fn) / fd; if (!Number.isInteger(ans)) throw new GenFail("x"); const [nm, who] = rng.pick(CANS); const u = rng.pick(["centimeters", "inches", "meters", "feet"] as const);
      const stimulus = withOpen(rng, OPEN_GEO, spin(rng, `[[${who} is a right circular cylinder with a diameter of ${d} ${u} and a height of ${h} ${u}.|${who} is a right circular cylinder whose diameter is ${d} ${u} and whose height is ${h} ${u}.|${who} has these measurements: diameter ${d} ${u}, height ${h} ${u}.]]${level === "easy" ? "" : ` [[It is currently filled to ${fw} of its capacity.|At the moment it is ${fw} full.|Its contents fill ${fw} of its capacity.]]`}`));
      const out = finish(rng, { stimulus, question: spin(rng, level === "easy" ? `[[What is the volume of the ${nm}, in ${cu(u)}, in terms of π?|Find the volume of the ${nm}, in ${cu(u)}, in terms of π.|How many ${cu(u)} does the ${nm} hold, in terms of π?|Determine the volume of the ${nm} in ${cu(u)}, leaving the answer in terms of π.]]` : `[[What is the volume of the contents, in ${cu(u)}, in terms of π?|How many ${cu(u)} are inside the ${nm}, in terms of π?|Find the volume of what the ${nm} currently holds, in ${cu(u)}, in terms of π.]]`), correct: ans, fmt: piOpt,
        wrongs: level === "easy" ? [W(4 * c, "geometry_misapplied", "지름을 반지름처럼 제곱했다."), W(2 * c, "formula_misuse", "지름을 한 번만 곱했다."), W(d * h, "formula_misuse", "지름과 높이만 곱했다."), W(c / 2, "formula_misuse", "반지름을 한 번 더 반으로 나눴다."), W(c + d, "other", "계산 실수.")]
          : [W(c, "step_missing", "가득 찼을 때의 부피를 답했다."), W((4 * c * fn) / fd, "geometry_misapplied", "지름을 반지름처럼 제곱했다."), W(c - ans, "opposite", "비어 있는 부분의 부피를 답했다."), W(2 * ans, "formula_misuse", "지름을 한 번만 곱했다."), W(ans + d, "other", "계산 실수.")],
        verificationJs: withParams({ d, h, fn: level === "easy" ? 1 : fn, fd: level === "easy" ? 1 : fd, easy: level === "easy" ? 1 : 0 }, "const v=(P.d*P.d*P.h)/4; return P.easy? v : v*P.fn/P.fd;"),
        trace: [[`지름이 ${d} 이므로 반지름은 ${r} 이다.`, "Radius from diameter."], [`가득 찼을 때의 부피 = π × ${r}² × ${h} = ${c}π 이다.`, "Full volume."], ...(level === "easy" ? [] : [[`${fw}(${fn}/${fd}) 만큼 찼으므로 ${c}π × ${fn}/${fd} = ${ans}π 이다.`, "Take the filled fraction."] as [string, string]])], variant: level === "easy" ? "volume" : "filled_fraction" });
      return sem(out, [{ v: d, words: ["diameter"] }, { v: h, words: ["height"] }], { words: ["volume", "inside", "contents", "hold"], forbid: forbidExcept("volume") });
    },
  },
  {
    id: "av.cylinder_volume_diameter.column", skill: SKILL, kind: "cylinder_volume_diameter", frame: "column", levels: ["easy", "medium"], structure: "지름·높이로 부피(easy) / 높이가 지름의 2 배인 원기둥(medium)",
    generate(rng, level) {
      const r = rng.int(2, 10), d = 2 * r, h = level === "easy" ? rng.int(3, 18) : 2 * d; if (h === d && level === "easy") throw new GenFail("x"); const c = r * r * h; if (c > 9000) throw new GenFail("x");
      const [nm, who] = rng.pick([["column", "A cylindrical column"], ["tower model", "A cylindrical tower model"], ["candle", "A cylindrical candle"], ["rod", "A solid cylindrical rod"], ["cake", "A cylindrical cake"], ["stool", "A cylindrical stool"]]); const u = rng.pick(["centimeters", "inches", "meters", "feet"] as const);
      const stimulus = withOpen(rng, OPEN_GEO, spin(rng, level === "easy" ? `[[${who} has a diameter of ${d} ${u} and a height of ${h} ${u}.|For ${who.charAt(0).toLowerCase() + who.slice(1)}, the diameter is ${d} ${u} and the height is ${h} ${u}.|${who} has these measurements: height ${h} ${u}, diameter ${d} ${u}.]]` : `[[${who} has a diameter of ${d} ${u}. Its height is twice its diameter.|The diameter of ${who.charAt(0).toLowerCase() + who.slice(1)} is ${d} ${u}, and it is twice as tall as it is wide.|${who} measures ${d} ${u} across its diameter, and its height is double that diameter.]]`));
      const out = finish(rng, { stimulus, question: spin(rng, `[[What is the volume of the ${nm}, in ${cu(u)}, in terms of π?|Find the volume of the ${nm}, in ${cu(u)}, in terms of π.|How many ${cu(u)} does the ${nm} hold, in terms of π?|Determine the volume of the ${nm} in ${cu(u)}, leaving the answer in terms of π.]]`), correct: c, fmt: piOpt,
        wrongs: [W(4 * c, "geometry_misapplied", "지름을 반지름처럼 제곱했다."), W(2 * c, "formula_misuse", "지름을 한 번만 곱했다."), W(c / 2, "formula_misuse", "반지름을 한 번 더 반으로 나눴다."), W(d * h, "formula_misuse", "지름과 높이만 곱했다."), W(r * h, "formula_misuse", "r² 대신 r 을 곱했다.")],
        verificationJs: withParams(level === "easy" ? { d, h, tw: 0 } : { d, h: 1, tw: 1 }, "const v=(P.d*P.d*(P.tw? 2*P.d : P.h))/4; return v;"),
        trace: level === "easy" ? [[`반지름 = ${d} ÷ 2 = ${r} 이다.`, "Radius."], [`부피 = π × ${r}² × ${h} = ${c}π 이다.`, "Volume."]] : [[`반지름 = ${d} ÷ 2 = ${r} 이다.`, "Radius."], [`높이는 지름의 2 배이므로 ${h} 이다.`, "Height."], [`부피 = π × ${r}² × ${h} = ${c}π 이다.`, "Volume."]], variant: level === "easy" ? "height_given" : "height_twice_diameter" });
      return sem(out, level === "easy" ? [{ v: d, words: ["diameter"] }, { v: h, words: ["height"] }] : [{ v: d, words: ["diameter"] }], { words: ["volume", "hold"], forbid: forbidExcept("volume") });
    },
  },
];
