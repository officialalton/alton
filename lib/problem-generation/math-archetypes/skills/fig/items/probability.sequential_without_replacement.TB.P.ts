// probability.sequential_without_replacement.TB.P — 종류별 개수 표(값표)에서 비복원으로 두 번 뽑는 확률. 같은 종류·적어도 하나·두 종류 비교·추가 개수 역산으로 확장한다.
// 표: [종류, 개수] 행. 지문은 개수를 되풀이하지 않고 "the table shown" 으로 가리킨다(종류 이름만 쓴다).
import { GenFail } from "../../../types";
import type { Rng } from "../../../rng";
import type { DistractorKind } from "../../../../review";
import { frac, spin } from "../../../text";
import { W } from "../../d-kit";
import { figInst, figJs } from "../../../figure-kit";
import { defineItem } from "../item-kit";

type SqTopic = { box: string; items: string; one: string; head: string; cats: string[] };
const COLORS = ["red", "blue", "green", "yellow", "white", "black", "purple", "orange"];
const SQ_TOPICS: SqTopic[] = [
  { box: "a bag", items: "marbles", one: "marble", head: "Color", cats: COLORS },
  { box: "a box", items: "tiles", one: "tile", head: "Color", cats: COLORS },
  { box: "a cup on a desk", items: "pens", one: "pen", head: "Ink color", cats: ["black", "blue", "red", "green", "purple"] },
  { box: "a drawer", items: "socks", one: "sock", head: "Color", cats: ["white", "gray", "black", "navy", "brown"] },
  { box: "a jar", items: "candies", one: "candy", head: "Flavor", cats: ["cherry", "lemon", "lime", "grape", "orange", "mint"] },
  { box: "a bag of party supplies", items: "balloons", one: "balloon", head: "Color", cats: COLORS },
  { box: "a tin", items: "cookies", one: "cookie", head: "Flavor", cats: ["chocolate", "vanilla", "oatmeal", "ginger", "lemon"] },
  { box: "a bin at a gym", items: "balls", one: "ball", head: "Type", cats: ["soccer", "tennis", "rubber", "foam", "golf"] },
  { box: "a jar in an art room", items: "beads", one: "bead", head: "Color", cats: COLORS },
  { box: "a bowl", items: "game chips", one: "chip", head: "Color", cats: ["red", "blue", "white", "green", "black"] },
  { box: "a bucket at a flower stand", items: "roses", one: "rose", head: "Color", cats: ["red", "white", "pink", "yellow", "orange"] },
  { box: "a library cart", items: "books", one: "book", head: "Genre", cats: ["mystery", "fantasy", "history", "poetry", "science"] },
  { box: "a crayon box", items: "crayons", one: "crayon", head: "Color", cats: COLORS },
  { box: "a button box", items: "buttons", one: "button", head: "Color", cats: ["brown", "white", "black", "gold", "silver"] },
  { box: "a playlist", items: "songs", one: "song", head: "Genre", cats: ["pop", "rock", "jazz", "country", "classical"] },
  { box: "a toy chest", items: "toy cars", one: "toy car", head: "Color", cats: ["red", "blue", "green", "yellow", "silver"] },
  { box: "a deck of game cards", items: "cards", one: "card", head: "Color", cats: ["red", "blue", "green", "yellow", "purple"] },
  { box: "a closet", items: "shirts", one: "shirt", head: "Color", cats: ["white", "blue", "gray", "green", "black"] },
  { box: "a craft basket", items: "yarn balls", one: "yarn ball", head: "Color", cats: COLORS },
  { box: "a seed packet", items: "seeds", one: "seed", head: "Plant", cats: ["bean", "pea", "squash", "corn", "melon"] },
  { box: "a box of puzzle pieces", items: "pieces", one: "piece", head: "Shape", cats: ["corner", "edge", "center", "border"] },
  { box: "a mailbag", items: "envelopes", one: "envelope", head: "Size", cats: ["small", "medium", "large", "padded"] },
  { box: "a pencil case", items: "erasers", one: "eraser", head: "Color", cats: ["pink", "white", "blue", "green", "gray"] },
];
type SqScene = { t: SqTopic; names: string[]; ns: number[]; N: number; fig: { type: "data"; kind: "table"; columns: string[]; rows: (string | number)[][] } };
function makeSq(rng: Rng, o: { k?: number; hi?: number } = {}): SqScene {
  const t = rng.pick(SQ_TOPICS); const k = o.k ?? rng.int(3, 4); const names = rng.shuffle([...t.cats]).slice(0, k);
  const ns = names.map(() => rng.int(2, o.hi ?? 9)); const N = ns.reduce((a, b) => a + b, 0);
  return { t, names, ns, N, fig: { type: "data", kind: "table", columns: [t.head, `Number of ${t.items}`], rows: names.map((nm, i) => [nm, ns[i]]) } };
}
const SQ_JS = "const nm=FIGURE.rows.map(r=>r[0]), ct=FIGURE.rows.map(r=>r[1]); if (ct.some(c=>!Number.isInteger(c)||c<0)) throw new Error('개수 오류'); const N=ct.reduce((a,b)=>a+b,0); if (N<2) throw new Error('개수 부족'); const cnt=(n)=>{ const j=nm.indexOf(n); if (j<0) throw new Error('종류 없음'); return ct[j]; };\n";
const FW = (n: number, d: number, kind: DistractorKind, reason: string) => ({ text: frac(n, d), kind, reason });
const intro = (rng: Rng, s: SqScene) => spin(rng, `[[The table shows the number of ${s.t.items} of each kind in ${s.t.box}.|The table shown lists how many ${s.t.items} of each kind are in ${s.t.box}.|${s.t.box.charAt(0).toUpperCase() + s.t.box.slice(1)} holds only the ${s.t.items} described in the table shown.]]`);
const draw2 = (rng: Rng, s: SqScene) => spin(rng, `[[Two ${s.t.items} are chosen at random, one after the other, without replacement.|One ${s.t.one} is chosen at random and not put back, and then a second ${s.t.one} is chosen at random.|Two ${s.t.items} are selected at random in a row, and the first is not returned before the second is selected.]]`);
const read = (s: SqScene): [string, string] => [`표에서 개수를 읽는다: ${s.names.map((n, i) => `${n} ${s.ns[i]}`).join(", ")}.`, "Read the count of each kind."];
const tot = (s: SqScene): [string, string] => [`전체 = ${s.ns.join(" + ")} = ${s.N} 이다.`, "Find the total."];
const dd = (s: SqScene) => s.N * (s.N - 1);
const an = (w: string) => (/^[aeiou]/.test(w) ? `an ${w}` : `a ${w}`);
const kinds = (s: SqScene, A: string) => `${A} ${s.t.items}`;

export const ITEM = defineItem({
  prefix: "pr", itemId: "probability.sequential_without_replacement.TB.P",
  hard: [
    {
      op: "chain2", structure: "표의 모든 종류에 대해 비복원으로 두 번 같은 종류가 나올 확률을 각각 구해 더함", extra: "종류마다 a/N·(a−1)/(N−1) 을 구하고 배반 사건으로 합산하는 연쇄 — medium 은 한 종류만",
      concepts: ["비복원 추출", "곱셈 법칙", "배반 사건의 덧셈"],
      gen(rng) {
        const s = makeSq(rng); const same = s.ns.reduce((a, n) => a + n * (n - 1), 0); const wr = s.ns.reduce((a, n) => a + n * n, 0);
        return figInst(rng, {
          stimulus: `${intro(rng, s)} ${draw2(rng, s)}`,
          question: spin(rng, `[[What is the probability that both ${s.t.items} chosen are of the same kind?|What is the probability that the two ${s.t.items} match, that is, both are of the same kind?]]`), correctText: frac(same, dd(s)), range: [0, 1],
          wrongTexts: [FW(wr, s.N * s.N, "condition_ignored", "복원 추출로 계산했다."), FW(dd(s) - same, dd(s), "opposite", "서로 다른 종류일 확률을 구했다."), FW(Math.max(...s.ns) * (Math.max(...s.ns) - 1), dd(s), "step_missing", "가장 많은 종류만 계산했다."), FW(s.ns.reduce((a, n) => a + n * (n - 1), 0), s.N * s.N, "formula_misuse", "두 번째 분모를 줄이지 않았다."), FW(s.ns.length, s.N, "formula_misuse", "종류 수를 전체로 나눴다.")],
          verificationJs: figJs({}, s.fig, `${SQ_JS}return ct.reduce((a, c) => a + c * (c - 1), 0) / (N * (N - 1));`),
          trace: [read(s), tot(s), ["같은 종류가 두 번 나오는 경우는 종류별로 배반이다.", "The kinds give disjoint cases."], [`각 종류: ${s.names.map((n, i) => `${n} ${s.ns[i]}×${s.ns[i] - 1}`).join(", ")} → 합 ${same} 이다.`, "For each kind, a(a − 1) favorable ordered pairs."], [`전체 순서쌍 = ${s.N}×${s.N - 1} = ${dd(s)} 이다.`, "Total ordered pairs without replacement."], [`확률 = ${same}/${dd(s)} = ${frac(same, dd(s))} 이다.`, "Divide and reduce."]], variant: "same_kind_twice",
        }, s.fig);
      },
    },
    {
      op: "compose_kind", structure: "비복원 두 번 뽑기에서 '한 종류가 적어도 한 번' 나올 확률을 여사건(둘 다 그 종류가 아님)으로 구함", extra: "비복원 곱셈 법칙과 여사건을 합성해야 함 — medium 은 두 번 모두 한 종류",
      concepts: ["비복원 추출", "여사건", "곱셈 법칙"],
      gen(rng) {
        const s = makeSq(rng); const i = rng.int(0, s.names.length - 1); const A = s.names[i]; const a = s.ns[i]; const r = s.N - a; const none = r * (r - 1); const ans = dd(s) - none;
        return figInst(rng, {
          stimulus: `${intro(rng, s)} ${draw2(rng, s)}`,
          question: spin(rng, `[[What is the probability that at least one of the two ${s.t.items} chosen is ${an(`${A} ${s.t.one}`)}?|What is the probability that at least one ${A} ${s.t.one} is chosen?]]`), correctText: frac(ans, dd(s)), range: [0, 1],
          wrongTexts: [FW(none, dd(s), "opposite", "둘 다 그 종류가 아닐 확률을 답했다."), FW(s.N * s.N - r * r, s.N * s.N, "condition_ignored", "복원 추출로 계산했다."), FW(a * (a - 1), dd(s), "scope", "두 번 모두 그 종류인 확률을 구했다."), FW(2 * a * r, dd(s), "scope", "정확히 한 번인 경우만 셌다."), FW(2 * a, s.N, "formula_misuse", "한 번 뽑는 확률을 두 배 했다.")],
          verificationJs: figJs({ A }, s.fig, `${SQ_JS}const r = N - cnt(P.A); return 1 - (r * (r - 1)) / (N * (N - 1));`),
          trace: [read(s), tot(s), [`${A} 가 아닌 것은 ${s.N} - ${a} = ${r} 개이다.`, "Count the others."], [`둘 다 ${A} 가 아닐 확률 = ${r}/${s.N} × ${r - 1}/${s.N - 1} = ${none}/${dd(s)} 이다.`, "Probability of the complement."], [`적어도 한 번 = 1 - ${none}/${dd(s)} = ${ans}/${dd(s)} 이다.`, "Subtract from 1."], [`기약분수로 ${frac(ans, dd(s))} 이다.`, "Reduce."]], variant: "at_least_once",
        }, s.fig);
      },
    },
    {
      op: "compare_scenarios", structure: "두 종류 각각이 비복원으로 두 번 연속 나올 확률을 구해 두 확률의 차를 구함", extra: "두 종류에 대해 비복원 곱을 따로 구하고 비교해야 함 — medium 은 한 종류만",
      concepts: ["비복원 추출", "곱셈 법칙", "확률 비교"],
      gen(rng) {
        const s = makeSq(rng); const [i, j] = rng.shuffle([...s.names.keys()]).slice(0, 2); const a = s.ns[i], b = s.ns[j]; const d = Math.abs(a * (a - 1) - b * (b - 1)); if (d === 0) throw new GenFail("same");
        const A = s.names[i], B = s.names[j];
        return figInst(rng, {
          stimulus: `${intro(rng, s)} ${draw2(rng, s)}`,
          question: spin(rng, `[[What is the positive difference between the probability that both ${s.t.items} chosen are ${kinds(s, A)} and the probability that both are ${kinds(s, B)}?|By how much does the probability that both choices are ${kinds(s, A)} differ from the probability that both are ${kinds(s, B)}?]]`), correctText: frac(d, dd(s)), range: [0, 1],
          wrongTexts: [FW(Math.abs(a * a - b * b), s.N * s.N, "condition_ignored", "복원 추출로 계산했다."), FW(Math.abs(a - b), s.N, "step_missing", "한 번 뽑는 확률만 비교했다."), FW(a * (a - 1) + b * (b - 1), dd(s), "sign_error", "차 대신 합을 구했다."), FW(Math.abs(a * (a - 1) - b * (b - 1)), s.N * s.N, "formula_misuse", "두 번째 분모를 줄이지 않았다."), FW(Math.abs(a - b) * (Math.abs(a - b) - 1) || 1, dd(s), "formula_misuse", "개수의 차로 한 번에 계산했다.")],
          verificationJs: figJs({ A, B }, s.fig, `${SQ_JS}const a = cnt(P.A), b = cnt(P.B); return Math.abs(a * (a - 1) - b * (b - 1)) / (N * (N - 1));`),
          trace: [read(s), tot(s), [`둘 다 ${A}: ${a}/${s.N} × ${a - 1}/${s.N - 1} = ${a * (a - 1)}/${dd(s)} 이다.`, "First kind twice."], [`둘 다 ${B}: ${b}/${s.N} × ${b - 1}/${s.N - 1} = ${b * (b - 1)}/${dd(s)} 이다.`, "Second kind twice."], [`차 = ${d}/${dd(s)} 이다.`, "Subtract."], [`기약분수로 ${frac(d, dd(s))} 이다.`, "Reduce."]], variant: "compare_two_kinds",
        }, s.fig);
      },
    },
    {
      op: "inverse", structure: "한 종류를 x 개 더 넣은 뒤 그 종류가 비복원으로 두 번 연속 나올 확률이 주어진 분수가 될 때 x 를 역산", extra: "분자·분모가 모두 x 의 이차식이 되는 확률 식을 세워 정수 해를 찾아야 함 — medium 은 확률 계산까지",
      concepts: ["비복원 추출", "곱셈 법칙", "확률 방정식의 역산"],
      gen(rng) {
        for (let tr = 0; tr < 80; tr++) {
          const s = makeSq(rng, { hi: 7 }); const i = rng.int(0, s.names.length - 1); const A = s.names[i]; const a = s.ns[i]; const x = rng.int(1, 8);
          const g = frac((a + x) * (a + x - 1), (s.N + x) * (s.N + x - 1)); if (!g.includes("/")) continue; const [p, q] = g.split("/").map(Number); if (q > 999 || p < 2) continue;
          let uniq = 0; for (let y = 0; y <= 200; y++) if ((a + y) * (a + y - 1) * q === p * (s.N + y) * (s.N + y - 1)) uniq++; if (uniq !== 1) continue;
          return figInst(rng, {
            stimulus: `${intro(rng, s)} ${spin(rng, `[[Some more ${A} ${s.t.items} are then added.|Next, additional ${A} ${s.t.items} are put in.]]`)} ${spin(rng, "[[After that, if two are chosen at random without replacement, the probability that both are of the added kind is|Now, for two random choices made without replacement, the chance that both match the added kind is]]")} ${p}/${q}.`,
            question: spin(rng, `[[How many ${A} ${s.t.items} were added?|How many more ${A} ${s.t.items} were put in?]]`), correct: x,
            wrongs: [W(x + a, "step_missing", "새 개수를 답하고 원래 개수를 빼지 않았다."), W(x + 1, "other", "계산 중 1 어긋났다."), W(x + 2, "other", "계산 중 어긋났다."), W(x - 1, "other", "계산 중 1 어긋났다."), W(s.N + x, "step_missing", "새 전체 개수를 답했다."), W(Math.round(Math.sqrt(p / q) * s.N - a), "condition_ignored", "복원 추출로 보고 근사했다.")].filter((w) => w.v > 0 && w.v !== x),
            verificationJs: figJs({ A, p, q }, s.fig, `${SQ_JS}const a = cnt(P.A); const out = []; for (let y = 0; y <= 500; y++) if ((a + y) * (a + y - 1) * P.q === P.p * (N + y) * (N + y - 1)) out.push(y); if (out.length !== 1) throw new Error('해가 하나가 아님'); return out[0];`),
            trace: [read(s), tot(s), [`${A} 를 x 개 더하면 ${A} ${a} + x 개, 전체 ${s.N} + x 개이다.`, "Express the new counts."], [`(${a} + x)(${a - 1} + x) ÷ ((${s.N} + x)(${s.N - 1} + x)) = ${p}/${q} 이다.`, "Write the without-replacement probability."], [`x = 0, 1, 2, … 를 차례로 넣으면 x = ${x} 에서 ${(a + x) * (a + x - 1)}/${(s.N + x) * (s.N + x - 1)} = ${p}/${q} 이다.`, "Test whole numbers."], [`따라서 x = ${x} 이다.`, "State the answer."]], variant: "added_to_reach_both",
          }, s.fig);
        }
        throw new GenFail("inverse");
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "second_after_first", structure: "첫 번째로 한 종류가 나온 뒤(돌려놓지 않음) 두 번째도 같은 종류일 확률", extra: "easy: 남은 개수 ÷ 남은 전체", concepts: ["비복원 추출", "조건부 확률"],
      gen(rng) {
        const s = makeSq(rng); const i = rng.int(0, s.names.length - 1); const A = s.names[i]; const a = s.ns[i];
        return figInst(rng, {
          stimulus: `${intro(rng, s)} One ${s.t.one} is chosen at random, and it is ${an(`${A} ${s.t.one}`)}. It is not put back.`, question: spin(rng, `[[If a second ${s.t.one} is chosen at random, what is the probability that it is also ${an(`${A} ${s.t.one}`)}?|What is the probability that the next ${s.t.one} chosen at random is ${an(`${A} ${s.t.one}`)} as well?]]`), correctText: frac(a - 1, s.N - 1), range: [0, 1],
          wrongTexts: [FW(a, s.N, "condition_ignored", "첫 번째를 돌려놓은 것처럼 계산했다."), FW(a - 1, s.N, "formula_misuse", "전체를 줄이지 않았다."), FW(a, s.N - 1, "formula_misuse", "그 종류의 개수를 줄이지 않았다."), FW(s.N - a, s.N - 1, "opposite", "다른 종류일 확률을 구했다.")],
          verificationJs: figJs({ A }, s.fig, `${SQ_JS}return (cnt(P.A) - 1) / (N - 1);`), trace: [read(s), tot(s), [`남은 ${A} ${a - 1} 개, 남은 전체 ${s.N - 1} 개 → ${frac(a - 1, s.N - 1)} 이다.`, "Use the remaining counts."]], variant: "second_given_first",
        }, s.fig);
      },
    },
    {
      lv: "medium", name: "both_one_kind", structure: "한 종류가 비복원으로 두 번 연속 나올 확률(a/N × (a−1)/(N−1))", extra: "medium: 첫 번째 확률 → 남은 개수로 두 번째 확률 → 곱", concepts: ["비복원 추출", "곱셈 법칙"],
      gen(rng) {
        const s = makeSq(rng); const i = rng.int(0, s.names.length - 1); const A = s.names[i]; const a = s.ns[i];
        return figInst(rng, {
          stimulus: `${intro(rng, s)} ${draw2(rng, s)}`, question: spin(rng, `[[What is the probability that both ${s.t.items} chosen are ${kinds(s, A)}?|What is the probability that the two choices are both ${kinds(s, A)}?]]`), correctText: frac(a * (a - 1), dd(s)), range: [0, 1],
          wrongTexts: [FW(a * a, s.N * s.N, "condition_ignored", "복원 추출로 계산했다."), FW(a * (a - 1), s.N * s.N, "formula_misuse", "전체를 줄이지 않았다."), FW(2 * a, s.N, "formula_misuse", "확률을 더했다."), FW(a - 1, s.N - 1, "step_missing", "두 번째 확률만 구했다."), FW(a, s.N, "step_missing", "첫 번째 확률만 구했다.")],
          verificationJs: figJs({ A }, s.fig, `${SQ_JS}const a = cnt(P.A); return a * (a - 1) / (N * (N - 1));`), trace: [read(s), tot(s), [`첫 번째 ${a}/${s.N}, 두 번째 ${a - 1}/${s.N - 1} 이다.`, "Two step probabilities."], [`곱 = ${a * (a - 1)}/${dd(s)} = ${frac(a * (a - 1), dd(s))} 이다.`, "Multiply."]], variant: "both_kind",
        }, s.fig);
      },
    },
  ],
});
