// ratios_rates_units.chained_conversion.TB.P — 단위 사슬 환산표(1 큰 단위 = f 작은 단위, 3행)에서 여러 단계 환산을 하고, 역환산·혼합량 비교·작업 속도로 확장한다.
import type { Rng } from "../../../rng";
import { W } from "../../d-kit";
import { figInst, figJs } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { pos, retry, tab } from "./_t4-kit";

type U = [string, string];
type Chain = { ctx: string; u: [U, U, U, U]; who: string };
const CHAINS: Chain[] = [
  { ctx: "a warehouse", who: "A worker", u: [["pallet", "pallets"], ["crate", "crates"], ["box", "boxes"], ["can", "cans"]] },
  { ctx: "a craft store", who: "A clerk", u: [["shelf", "shelves"], ["bin", "bins"], ["bag", "bags"], ["bead", "beads"]] },
  { ctx: "a board game", who: "A player", u: [["gold coin", "gold coins"], ["silver coin", "silver coins"], ["bronze coin", "bronze coins"], ["chip", "chips"]] },
  { ctx: "an office supply company", who: "A packer", u: [["case", "cases"], ["carton", "cartons"], ["pack", "packs"], ["pen", "pens"]] },
  { ctx: "a bakery", who: "A baker", u: [["rack", "racks"], ["tray", "trays"], ["row", "rows"], ["muffin", "muffins"]] },
  { ctx: "a print shop", who: "A printer", u: [["crate", "crates"], ["bundle", "bundles"], ["packet", "packets"], ["sheet", "sheets"]] },
  { ctx: "a farm", who: "A farmhand", u: [["wagon", "wagons"], ["sack", "sacks"], ["bag", "bags"], ["potato", "potatoes"]] },
  { ctx: "a sticker company", who: "A machine operator", u: [["box", "boxes"], ["roll", "rolls"], ["strip", "strips"], ["sticker", "stickers"]] },
  { ctx: "a garden center", who: "A gardener", u: [["carton", "cartons"], ["tube", "tubes"], ["packet", "packets"], ["seed", "seeds"]] },
  { ctx: "a hay farm", who: "A farmer", u: [["truckload", "truckloads"], ["bale", "bales"], ["bundle", "bundles"], ["stalk", "stalks"]] },
  { ctx: "a fantasy video game", who: "A character", u: [["chest", "chests"], ["pouch", "pouches"], ["purse", "purses"], ["gem", "gems"]] },
  { ctx: "a science lab", who: "A lab assistant", u: [["trunk", "trunks"], ["case", "cases"], ["tray", "trays"], ["vial", "vials"]] },
  { ctx: "a feed store", who: "A clerk", u: [["bin", "bins"], ["sack", "sacks"], ["scoop", "scoops"], ["pellet", "pellets"]] },
  { ctx: "an orchard", who: "A picker", u: [["truck", "trucks"], ["basket", "baskets"], ["bag", "bags"], ["apple", "apples"]] },
  { ctx: "a card shop", who: "A shop owner", u: [["kit", "kits"], ["set", "sets"], ["deck", "decks"], ["card", "cards"]] },
  { ctx: "a plant nursery", who: "A worker", u: [["cart", "carts"], ["crate", "crates"], ["flat", "flats"], ["seedling", "seedlings"]] },
  { ctx: "an arcade", who: "A player", u: [["vault", "vaults"], ["bag", "bags"], ["roll", "rolls"], ["token", "tokens"]] },
  { ctx: "a juice factory", who: "A worker", u: [["tank", "tanks"], ["barrel", "barrels"], ["jug", "jugs"], ["bottle", "bottles"]] },
  { ctx: "a toy factory", who: "A packer", u: [["container", "containers"], ["crate", "crates"], ["box", "boxes"], ["toy", "toys"]] },
  { ctx: "a school supply room", who: "A teacher", u: [["cabinet", "cabinets"], ["drawer", "drawers"], ["box", "boxes"], ["crayon", "crayons"]] },
  { ctx: "a candy shop", who: "A shop worker", u: [["barrel", "barrels"], ["jar", "jars"], ["bag", "bags"], ["candy", "candies"]] },
];
type CScene = { c: Chain; f: [number, number, number] };
function cScene(rng: Rng, cap = 999, lo = 2): CScene {
  const c = rng.pick(CHAINS);
  return retry(60, () => { const f: [number, number, number] = [rng.int(lo, 8), rng.int(lo, 9), rng.int(lo, 12)]; return f[0] * f[1] * f[2] <= cap ? { c, f } : null; }, "환산 장면");
}
const sg = (s: CScene, k: number) => s.c.u[k][0];
const pl = (s: CScene, k: number) => s.c.u[k][1];
const cFig = (s: CScene) => tab(["Unit", "Equals", "Smaller unit"], [0, 1, 2].map((k) => [`1 ${sg(s, k)}`, s.f[k], pl(s, k + 1)]), `Units used at ${s.c.ctx}`);
const intro = (rng: Rng, s: CScene) => rng.pick([
  `At ${s.c.ctx}, items are counted with the units shown in the table. Each row tells how many of the next smaller unit make one larger unit.`,
  `The table shows how the units used at ${s.c.ctx} are related.`,
  `${s.c.who} at ${s.c.ctx} uses the unit relationships given in the table shown.`,
  `The table lists the conversions among ${pl(s, 0)}, ${pl(s, 1)}, ${pl(s, 2)}, and ${pl(s, 3)} at ${s.c.ctx}.`,
]);
/** FIGURE 의 세 환산 비 f0, f1, f2 를 읽는 JS(사슬 순서·양의 정수 확인). */
const C_JS = "const f=FIGURE.rows.map(r=>r[1]); if (f.length!==3||f.some(x=>!Number.isInteger(x)||x<2)) throw new Error('환산표 오류');\n";
const read = (s: CScene): [string, string] => [`표: 1 ${sg(s, 0)} = ${s.f[0]} ${pl(s, 1)}, 1 ${sg(s, 1)} = ${s.f[1]} ${pl(s, 2)}, 1 ${sg(s, 2)} = ${s.f[2]} ${pl(s, 3)}.`, "Read the conversions."];
const many = (s: CScene, q: number, k: number) => `${q} ${q === 1 ? sg(s, k) : pl(s, k)}`;

export const ITEM = defineItem({
  prefix: "rru", itemId: "ratios_rates_units.chained_conversion.TB.P",
  hard: [
    {
      op: "chain2", structure: "가장 큰 단위 q 개를 세 단계 환산해 가장 작은 단위로 바꿈", extra: "세 환산 비를 차례로 곱하는 연쇄 — medium 은 두 단계",
      concepts: ["단위 환산표", "연쇄 환산", "곱셈"],
      gen(rng) {
        return retry(60, () => {
          const s = cScene(rng, 500); const P3 = s.f[0] * s.f[1] * s.f[2]; const q = rng.int(2, 6); const c = q * P3; if (c > 999) return null; const fig = cFig(s);
          return figInst(rng, {
            stimulus: intro(rng, s),
            question: rng.pick([`How many ${pl(s, 3)} are in ${many(s, q, 0)}?`, `Based on the table, ${many(s, q, 0)} is equal to how many ${pl(s, 3)}?`]), correct: c,
            wrongs: pos([W(q * s.f[0] * s.f[1], "step_missing", "마지막 환산을 빠뜨렸다."), W(q * (s.f[0] + s.f[1] + s.f[2]), "formula_misuse", "환산 비를 곱하지 않고 더했다."), W(P3, "step_missing", "개수 q 를 곱하지 않았다."), W(q * s.f[0] * s.f[2], "step_missing", "가운데 환산을 빠뜨렸다."), W(q * s.f[1] * s.f[2], "step_missing", "첫 환산을 빠뜨렸다.")], c),
            verificationJs: figJs({ q }, fig, `${C_JS}return P.q * f[0] * f[1] * f[2];`),
            trace: [read(s), [`${many(s, q, 0)} = ${q} × ${s.f[0]} = ${q * s.f[0]} ${pl(s, 1)} 이다.`, "Convert to the second unit."], [`${q * s.f[0]} × ${s.f[1]} = ${q * s.f[0] * s.f[1]} ${pl(s, 2)} 이다.`, "Convert to the third unit."], [`${q * s.f[0] * s.f[1]} × ${s.f[2]} = ${c} ${pl(s, 3)} 이다.`, "Convert to the smallest unit."], [`따라서 ${c} 이다.`, "That is the count."]], variant: "three_step_down",
          }, fig);
        }, "chain2");
      },
    },
    {
      op: "inverse", structure: "가장 작은 단위 Q 개가 가장 큰 단위 몇 개인지 거꾸로 환산", extra: "세 환산 비의 곱으로 나누는 역환산(곱하면 틀림) — medium 은 두 단계 정환산",
      concepts: ["단위 환산표", "역환산", "나눗셈"],
      gen(rng) {
        return retry(60, () => {
          const s = cScene(rng, 400); const P3 = s.f[0] * s.f[1] * s.f[2]; const q = rng.int(2, 9); const Q = q * P3; if (Q > 999) return null; const fig = cFig(s);
          return figInst(rng, {
            stimulus: `${intro(rng, s)} ${s.c.who.replace(/^An? /, "The ")} has ${Q} ${pl(s, 3)}.`,
            question: rng.pick([`How many full ${pl(s, 0)} can these ${pl(s, 3)} be packed into, with none left over?`, `These ${pl(s, 3)} are equal to how many ${pl(s, 0)}?`]), correct: q,
            wrongs: pos([W(Q / (s.f[1] * s.f[2]), "step_missing", "첫 환산으로 나누지 않았다."), W(Q / s.f[2], "step_missing", "한 단계만 환산했다."), W(Q / (s.f[0] + s.f[1] + s.f[2]), "formula_misuse", "환산 비를 더해서 나누었다."), W(Q / (s.f[0] * s.f[1]), "axis_misread", "마지막 비 대신 첫 두 비로 나누었다."), W(q + 1, "other", "하나 어긋났다.")].filter((w) => Number.isInteger(w.v)), q),
            verificationJs: figJs({ Q }, fig, `${C_JS}return P.Q / (f[0] * f[1] * f[2]);`),
            trace: [read(s), [`${Q} ÷ ${s.f[2]} = ${Q / s.f[2]} ${pl(s, 2)} 이다.`, "Convert up one unit."], [`${Q / s.f[2]} ÷ ${s.f[1]} = ${Q / s.f[2] / s.f[1]} ${pl(s, 1)} 이다.`, "Convert up again."], [`${Q / s.f[2] / s.f[1]} ÷ ${s.f[0]} = ${q} ${pl(s, 0)} 이다.`, "Convert to the largest unit."], [`따라서 ${q} 이다.`, "That is the count."]], variant: "three_step_up",
          }, fig);
        }, "inverse");
      },
    },
    {
      op: "compare_scenarios", structure: "서로 다른 단위로 섞인 두 사람의 양을 모두 가장 작은 단위로 바꿔 차를 구함", extra: "두 경우를 같은 단위로 맞춘 뒤 비교해야 함 — 개수만 비교하면 틀림 — medium 은 한 양의 환산",
      concepts: ["단위 환산표", "공통 단위로 맞추기", "두 경우 비교"],
      gen(rng) {
        return retry(120, () => {
          const s = cScene(rng, 300); const [f0, f1, f2] = s.f; const a = rng.int(1, 3), b = rng.int(2, 9), c2 = rng.int(2, 9), d = rng.int(2, 12);
          const A = a * f0 * f1 * f2 + b * f2; const B = c2 * f1 * f2 + d; if (A === B || A > 999 || B > 999) return null; const c = Math.abs(A - B); const fig = cFig(s);
          return figInst(rng, {
            stimulus: `${intro(rng, s)} Group X has ${many(s, a, 0)} and ${many(s, b, 2)}. Group Y has ${many(s, c2, 1)} and ${many(s, d, 3)}.`,
            question: rng.pick([`When both amounts are written in ${pl(s, 3)}, what is the positive difference between them?`, `How many ${pl(s, 3)} apart are the amounts of the two groups?`]), correct: c,
            wrongs: pos([W(Math.abs(a + b - c2 - d), "step_missing", "단위를 맞추지 않고 개수끼리 비교했다."), W(A + B, "sign_error", "차 대신 합을 구했다."), W(Math.abs(a * f0 * f1 * f2 + b - B), "step_missing", "한 양의 환산을 빠뜨렸다."), W(Math.abs(A - c2 * f1 * f2), "step_missing", "낱개를 더하지 않았다."), W(Math.max(A, B), "step_missing", "한쪽 양만 답했다.")], c),
            verificationJs: figJs({ a, b, c2, d }, fig, `${C_JS}return Math.abs(P.a * f[0] * f[1] * f[2] + P.b * f[2] - (P.c2 * f[1] * f[2] + P.d));`),
            trace: [read(s), [`1 ${sg(s, 0)} = ${f0 * f1 * f2} ${pl(s, 3)}, 1 ${sg(s, 1)} = ${f1 * f2} ${pl(s, 3)} 이다.`, "Express each unit in the smallest unit."], [`Group X = ${a}·${f0 * f1 * f2} + ${b}·${f2} = ${A} 이다.`, "Convert group X."], [`Group Y = ${c2}·${f1 * f2} + ${d} = ${B} 이다.`, "Convert group Y."], [`차 = |${A} - ${B}| = ${c} 이다.`, "Take the positive difference."]], variant: "mixed_units_compare",
          }, fig);
        }, "compare");
      },
    },
    {
      op: "unit_ratio", structure: "작업 속도(하루에 가장 작은 단위 r 개)와 환산표로 큰 단위 q 개를 끝내는 날 수를 구함", extra: "환산(큰 단위 → 작은 단위)과 속도(개수 ÷ 하루 개수)를 결합 — medium 은 두 단계 환산",
      concepts: ["단위 환산표", "속도(단위율)", "나눗셈"],
      gen(rng) {
        return retry(120, () => {
          const s = cScene(rng, 600); const P2 = s.f[1] * s.f[2]; const q = rng.int(2, 9); const tot = q * P2; if (tot > 999) return null;
          const divs = [...Array(tot).keys()].map((x) => x + 1).filter((x) => tot % x === 0 && x > 1 && x < tot && tot / x >= 2 && tot / x <= 60 && x !== s.f[2] && x !== P2); if (!divs.length) return null; const r = rng.pick(divs); const c = tot / r; const fig = cFig(s);
          return figInst(rng, {
            stimulus: `${intro(rng, s)} ${s.c.who.replace(/^An? /, "The ")} handles ${r} ${pl(s, 3)} each day.`,
            question: rng.pick([`At this rate, how many days will it take to handle ${many(s, q, 1)}?`, `How many days are needed, at this rate, to handle exactly ${many(s, q, 1)}?`]), correct: c,
            wrongs: pos([W(q / r, "step_missing", "환산하지 않고 나누었다."), W((q * s.f[1]) / r, "step_missing", "한 단계만 환산했다."), W((q * s.f[0] * P2) / r, "axis_misread", "가장 큰 단위에서 환산했다."), W(tot, "step_missing", "속도로 나누지 않았다."), W(c + 1, "other", "하나 어긋났다.")].filter((w) => Number.isInteger(w.v)), c),
            verificationJs: figJs({ q, r }, fig, `${C_JS}return P.q * f[1] * f[2] / P.r;`),
            trace: [read(s), [`${many(s, q, 1)} = ${q} × ${s.f[1]} = ${q * s.f[1]} ${pl(s, 2)} 이다.`, "Convert to the third unit."], [`${q * s.f[1]} × ${s.f[2]} = ${tot} ${pl(s, 3)} 이다.`, "Convert to the smallest unit."], [`하루 ${r} 개이므로 날 수 = ${tot} ÷ ${r} 이다.`, "Divide by the daily rate."], [`= ${c} 일이다.`, "That is the number of days."]], variant: "rate_with_conversion",
          }, fig);
        }, "unit_ratio");
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "one_step", structure: "큰 단위 q 개를 바로 아래 단위로 환산", extra: "easy: 한 번 곱하기", concepts: ["단위 환산표", "환산"],
      gen(rng) {
        const s = cScene(rng); const q = rng.int(2, 9); const k = rng.int(0, 2); const c = q * s.f[k]; const fig = cFig(s);
        return figInst(rng, { stimulus: intro(rng, s), question: `How many ${pl(s, k + 1)} are in ${many(s, q, k)}?`, correct: c, wrongs: pos([W(q + s.f[k], "formula_misuse", "더했다."), W(s.f[k], "step_missing", "개수를 곱하지 않았다."), W(q * s.f[(k + 1) % 3], "axis_misread", "다른 행을 읽었다."), W(c + q, "other", "어긋났다.")], c), verificationJs: figJs({ q, row: String(k) }, fig, `${C_JS}return P.q * f[Number(P.row)];`), trace: [[`1 ${sg(s, k)} = ${s.f[k]} ${pl(s, k + 1)} 을 읽는다.`, "Read the conversion."], [`${q} × ${s.f[k]} = ${c} 이다.`, "Multiply."]], variant: "one_step" }, fig);
      },
    },
    {
      lv: "medium", name: "two_step", structure: "큰 단위 q 개를 두 단계 아래 단위로 환산", extra: "medium: 두 번 곱하기", concepts: ["단위 환산표", "연쇄 환산"],
      gen(rng) {
        const s = cScene(rng); const q = rng.int(2, 9); const k = rng.int(0, 1); const c = q * s.f[k] * s.f[k + 1]; const fig = cFig(s);
        return figInst(rng, { stimulus: intro(rng, s), question: rng.pick([`How many ${pl(s, k + 2)} are in ${many(s, q, k)}?`, `${capF(many(s, q, k))} is equal to how many ${pl(s, k + 2)}?`]), correct: c, wrongs: pos([W(q * s.f[k], "step_missing", "한 단계만 환산했다."), W(q * (s.f[k] + s.f[k + 1]), "formula_misuse", "비를 더했다."), W(s.f[k] * s.f[k + 1], "step_missing", "개수를 곱하지 않았다."), W(q * s.f[k + 1], "step_missing", "첫 환산을 빠뜨렸다.")], c), verificationJs: figJs({ q, row: String(k) }, fig, `${C_JS}const k = Number(P.row); return P.q * f[k] * f[k + 1];`), trace: [read(s), [`${q} × ${s.f[k]} = ${q * s.f[k]} ${pl(s, k + 1)} 이다.`, "First conversion."], [`${q * s.f[k]} × ${s.f[k + 1]} = ${c} ${pl(s, k + 2)} 이다.`, "Second conversion."]], variant: "two_step" }, fig);
      },
    },
  ],
});
const capF = (x: string) => x.charAt(0).toUpperCase() + x.slice(1);
