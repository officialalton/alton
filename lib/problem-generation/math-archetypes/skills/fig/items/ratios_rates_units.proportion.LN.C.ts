// ratios_rates_units.proportion.LN.C — 비례(원점을 지나는) 관계 또는 처음 값이 있는 관계를 서술로 주고, 두 조건을 모두 만족하는 직선 그래프를 4개 중에서 고른다.
import { GenFail } from "../../../types";
import type { Rng } from "../../../rng";
import { defineItem } from "../item-kit";
import { C_LEADS, LSTAT, R_SET, SPR_NO_PLANE_CHOICE, cInst, lineOk, linePool, oneCond, pickLine, poolChoices, twoCond } from "../cplane-kit";
import { lineChoice } from "../ln-b-kit";

type Topic = { x: string; y: string; xu: string; yu: string };
const TOPICS: Topic[] = [
  { x: "the number of hours a machine runs", y: "the number of parts it makes", xu: "hour", yu: "parts" }, { x: "the number of pounds of apples bought", y: "the cost", xu: "pound", yu: "dollars" },
  { x: "the number of minutes a faucet is open", y: "the liters of water that flow out", xu: "minute", yu: "liters" }, { x: "the number of tickets sold", y: "the money collected", xu: "ticket", yu: "dollars" },
  { x: "the number of miles a cyclist rides", y: "the calories burned", xu: "mile", yu: "calories" }, { x: "the number of minutes a drone flies", y: "the distance it covers", xu: "minute", yu: "kilometers" },
];
const MS = [0.5, 1, 2, 3, 4];
const sg = (n: number) => `${n}`;
const STEMS = ["Four graphs of lines are shown in the $xy$-plane, all with the same axes.", "The four graphs shown are lines drawn on the same $xy$-plane axes.", "Each of the four graphs shown is a line in the same $xy$-plane.", "Four candidate lines are shown, graphed with identical axes.", "The choices shown are four line graphs that share one set of axes."];
const QS = (c: string) => [`Which of the four graphs shown models a situation in which ${c}?`, `Which graph shown could represent a situation in which ${c}?`, `Exactly one of the graphs shown matches a situation in which ${c}. Which one is it?`, `Of the four graphs shown, which one models the case where ${c}?`];
type B = { clause: string; P: Record<string, number>; A: string; Bj: string; rules: [string, string, string]; ok: { m: number; b: number }; trace: [string, string][]; tag: string };
function prop(rng: Rng, R: number): number { for (let t = 0; t < 200; t++) { const m = rng.pick(MS); try { lineChoice(R, m, 0); return m; } catch { /* retry */ } } throw new GenFail("비례 직선"); }
const BUILD: Record<string, (rng: Rng, R: number, t: Topic) => B> = {
  propRate(rng, R, t) { const m = prop(rng, R); return { tag: "proportional_rate", clause: rng.pick([`${t.y} is proportional to ${t.x}, and each additional ${t.xu} adds ${sg(m)} ${t.yu}`, `${t.y} is directly proportional to ${t.x}, with ${sg(m)} ${t.yu} for each ${t.xu}`]), P: { m }, A: "s.b === 0", Bj: "s.m === P.m", rules: ["not_proportional", "rate_off", "both_off"], ok: { m, b: 0 }, trace: [[`비례이므로 원점을 지나고 기울기는 ${m} 이다.`, "A proportional relationship passes through the origin; the slope is the rate."]] }; },
  propPoint(rng, R, t) { const m = prop(rng, R); const xs: number[] = []; for (let x = 1; x <= R - 1; x++) if (Number.isInteger(m * x) && m * x <= R - 1) xs.push(x); if (!xs.length) throw new GenFail("점"); const p = rng.pick(xs); const q = m * p; return { tag: "proportional_point", clause: rng.pick([`${t.y} is proportional to ${t.x}, and when ${t.x} is ${p}, ${t.y} is ${q}`, `${t.y} is directly proportional to ${t.x}, with ${q} ${t.yu} for ${p} ${t.xu}${p === 1 ? "" : "s"}`]), P: { p, q }, A: "s.b === 0", Bj: "Math.abs(s.m * P.p - P.q) < 1e-9", rules: ["not_proportional", "rate_off", "both_off"], ok: { m, b: 0 }, trace: [[`비례이므로 원점을 지나고 점 (${p}, ${q}) 에서 기울기는 ${m} 이다.`, "Passes through the origin and the given point."]] }; },
  propTimes(rng, R, t) { const m = prop(rng, R); const w = m === 0.5 ? "half" : m === 1 ? "equal to" : `${m} times`; return { tag: "proportional_times", clause: rng.pick([`${t.y} is always ${w} ${t.x}${m === 1 ? "" : ""}, with nothing added at the start`, `${t.y} is ${w} ${t.x} for every value, with a starting amount of 0`]), P: { m }, A: "s.b === 0", Bj: "s.m === P.m", rules: ["start_off", "rate_off", "both_off"], ok: { m, b: 0 }, trace: [[`처음 값이 0 이고 ${t.y} 는 ${t.x} 의 ${m} 배이므로 y = ${m}x 이다.`, "Zero start and a constant multiple."]] }; },
  startRate(rng, R, t) { const { m, b } = pickLine(rng, R, MS); if (b <= 0) throw new GenFail("b"); return { tag: "start_and_rate", clause: rng.pick([`there are already ${b} ${t.yu} at the start and each additional ${t.xu} adds ${sg(m)} ${t.yu}`, `${t.y} starts at ${b} and increases by ${sg(m)} ${t.yu} per ${t.xu}`]), P: { b, m }, A: "s.b === P.b", Bj: "s.m === P.m", rules: ["start_off", "rate_off", "both_off"], ok: { m, b }, trace: [[`처음 값 ${b}, 기울기 ${m} 이므로 y 절편이 ${b} 이다.`, "Starting amount and rate."]] }; },
};
const OPS = ["repr_shift", "chain2", "compose_kind", "inverse"] as const;
const MENU = ["propRate", "propPoint", "propTimes", "startRate"];
function make(rng: Rng, key: string) { const R = rng.pick(R_SET); const t = rng.pick(TOPICS); const b = BUILD[key](rng, R, t); const ch = poolChoices(rng, { ok: lineOk(R, b.ok.m, b.ok.b), pool: linePool(R), P: b.P, ...twoCond(LSTAT, b.A, b.Bj, b.rules) }); return { ch, b, t }; }
const intro = (rng: Rng, t: Topic) => `${rng.pick(C_LEADS)}In the $xy$-plane, $x$ is ${t.x} and $y$ is ${t.y}. ${rng.pick(STEMS)}`;
const ctx = (rng: Rng, key: string, med = false) => { const { ch, b, t } = make(rng, key); return cInst(rng, ch, { stimulus: intro(rng, t), question: rng.pick(QS(b.clause)), P: b.P, ...twoCond(LSTAT, b.A, b.Bj, b.rules), variant: `proportion_${b.tag}${med ? "_med" : ""}`, trace: [...b.trace, ["각 그래프에서 원점을 지나는지와 기울기를 읽는다.", "Check whether each graph passes through the origin and read its slope."], ["첫째 조건을 어긴 그래프를 지운다.", "Eliminate the graphs that fail the first condition."], ["남은 그래프가 정답이다.", "The remaining graph is the answer."]] }, ["다른 그래프는 조건 하나 이상이 어긋난다.", "Each other graph violates at least one condition."]); };

export const ITEM = defineItem({
  prefix: "prcg", itemId: "ratios_rates_units.proportion.LN.C",
  hard: MENU.map((key, i) => ({ op: OPS[i], sprNo: SPR_NO_PLANE_CHOICE, structure: `비례·처음 값 조건(${key}) 두 개를 서술로 주고 두 조건을 모두 만족하는 직선 그래프를 4개 중에서 고름`, extra: "비례(원점을 지남)와 비율(기울기)을 각각 따져야 함(기울기만 맞고 원점을 지나지 않는 그래프가 함정)", concepts: ["비례 관계", "원점을 지나는 직선", "기울기"], gen: (rng: Rng) => ctx(rng, key) })),
  em: [
    { lv: "easy" as const, name: "slope_only", sprNo: SPR_NO_PLANE_CHOICE, structure: "단위당 값 하나로 직선 그래프 4개 중 고름", extra: "easy: 한 조건", concepts: ["비례 관계", "기울기"],
      gen(rng: Rng) { const R = rng.pick(R_SET); const t = rng.pick(TOPICS); const m = prop(rng, R); const P = { m }; const c = oneCond(LSTAT, "s.m", "P.m", "1.5"); const ch = poolChoices(rng, { ok: lineOk(R, m, 0), pool: linePool(R), P, ...c }); return cInst(rng, ch, { stimulus: intro(rng, t), question: rng.pick([`Which of the four graphs shown is a line whose slope is ${sg(m)}, matching ${sg(m)} ${t.yu} for each ${t.xu}?`, `Which graph shown has ${sg(m)} ${t.yu} for each ${t.xu}?`]), P, ...c, variant: "proportion_rate_only", trace: [[`단위당 ${m} 이므로 기울기가 ${m} 인 직선을 찾는다.`, "Find the line with the given rate."], ["나머지 그래프는 기울기가 달라 지운다.", "Eliminate the other slopes."]] }, ["기울기가 다른 그래프는 정답이 아니다.", "Other slopes are wrong."]); } },
    { lv: "medium" as const, name: "medium_prop_point", sprNo: SPR_NO_PLANE_CHOICE, structure: "비례와 한 점으로 직선 그래프 4개 중 고름", extra: "medium: 두 조건", concepts: ["비례 관계", "원점을 지나는 직선"], gen: (rng: Rng) => ctx(rng, "propPoint", true) },
  ],
});
