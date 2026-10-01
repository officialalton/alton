// B 담당(일차 계열) 원형 공용 도구 — 오답 후보·단계 표기·부등호·직선식·유리수 계산·문장 맥락 은행.
import type { DistractorKind } from "../review";
import { gcd } from "./rng";
import { lin, type Wrong } from "./text";

export const T = (ko: string, en: string): [string, string] => [ko, en];
export const W = (v: number, kind: DistractorKind, reason: string): Wrong => ({ v, kind, reason });
export const sgn = (n: number) => (n < 0 ? `- ${-n}` : `+ ${n}`);
export const pn = (n: number) => (n < 0 ? `(${n})` : String(n));
export const ceilDiv = (a: number, b: number) => Math.ceil(a / b - 1e-12);
export const floorDiv = (a: number, b: number) => Math.floor(a / b + 1e-12);

export type Op = "<" | "\\le" | ">" | "\\ge";
export const OPS: Op[] = ["<", "\\le", ">", "\\ge"];
export const flipOp = (o: Op): Op => (o === "<" ? ">" : o === ">" ? "<" : o === "\\le" ? "\\ge" : "\\le");
export const holds = (l: number, o: Op, r: number) => (o === "<" ? l < r : o === ">" ? l > r : o === "\\le" ? l <= r : l >= r);
/** 말로 쓴 부등호 표현(영어): 대안 문구 묶음. */
export const opWords = (o: Op): string[] => (o === "<" ? ["less than", "smaller than", "below"] : o === ">" ? ["greater than", "larger than", "more than"] : o === "\\le" ? ["at most", "no more than", "not greater than"] : ["at least", "no less than", "not less than"]);

/** 직선식 `y = mx + b`. */
export const lineEq = (m: number, b: number, y = "y", x = "x") => `${y} = ${lin(m, b, x)}`;
/** 표준형 `ax + by = c`(계수 0 은 항 생략, 부호 정리). */
export function stdEq(a: number, b: number, c: number, x = "x", y = "y", rel = "="): string {
  const parts: string[] = [];
  const add = (co: number, v: string) => { if (co === 0) return; const body = `${Math.abs(co) === 1 ? "" : Math.abs(co)}${v}`; parts.push(parts.length === 0 ? (co < 0 ? `-${body}` : body) : `${co < 0 ? "-" : "+"} ${body}`); };
  add(a, x); add(b, y);
  return `${parts.join(" ") || "0"} ${rel} ${c}`;
}

/** 유리수 [분자, 분모] 연산(분모 > 0, 기약). */
export type Q = [number, number];
export const q = (n: number, d = 1): Q => { if (d < 0) { n = -n; d = -d; } const g = gcd(n, d); return [n / g, d / g]; };
export const qAdd = (a: Q, b: Q): Q => q(a[0] * b[1] + b[0] * a[1], a[1] * b[1]);
export const qSub = (a: Q, b: Q): Q => q(a[0] * b[1] - b[0] * a[1], a[1] * b[1]);
export const qMul = (a: Q, b: Q): Q => q(a[0] * b[0], a[1] * b[1]);
export const qDiv = (a: Q, b: Q): Q => q(a[0] * b[1], a[1] * b[0]);
export const qVal = (a: Q) => a[0] / a[1];
export const qStr = (a: Q) => (a[1] === 1 ? String(a[0]) : `${a[0]}/${a[1]}`);

/** 두 직선 y = m1 x + b1, y = m2 x + b2 의 교점(평행이면 null). */
export function meet(m1: number, b1: number, m2: number, b2: number): { x: Q; y: Q } | null {
  if (m1 === m2) return null;
  const x = q(b2 - b1, m1 - m2); const y = qAdd(qMul(q(m1), x), q(b1));
  return { x, y };
}

export const VAR_LETTERS = ["x", "t", "n", "m", "w"] as const;

/** 맥락 은행: 명사구는 한 곳에서만 정의해 문장·대응표(bindings)가 같은 표를 쓴다. */
export const SHOP: { thing: string; things: string; seller: string }[] = [
  { thing: "notebook", things: "notebooks", seller: "a campus store" },
  { thing: "ticket", things: "tickets", seller: "a theater" },
  { thing: "sandwich", things: "sandwiches", seller: "a cafe" },
  { thing: "poster", things: "posters", seller: "a print shop" },
  { thing: "plant", things: "plants", seller: "a garden center" },
  { thing: "bracelet", things: "bracelets", seller: "a craft fair" },
  { thing: "book", things: "books", seller: "a school book sale" },
  { thing: "ribbon", things: "ribbons", seller: "a craft shop" },
];
export const NAMES = ["Maya", "Daniel", "Priya", "Lucas", "Hana", "Omar", "Elena", "Kenji", "Sofia", "Andre", "Mina", "Theo"];
export const SERVICES: { who: string; job: string; unit: string; units: string }[] = [
  { who: "A plumber", job: "a house call", unit: "hour", units: "hours" },
  { who: "A tutor", job: "a registration", unit: "session", units: "sessions" },
  { who: "A photographer", job: "a booking", unit: "hour", units: "hours" },
  { who: "A repair shop", job: "an inspection", unit: "hour", units: "hours" },
  { who: "A bike rental shop", job: "a deposit", unit: "day", units: "days" },
  { who: "A catering company", job: "a setup", unit: "guest", units: "guests" },
];

/** verificationJs 공용 조각: 부등호 문자열("<","<=",">",">=") 판정. */
export const H_JS = "const h=(l,o,r)=>o==='<'?l<r:o==='<='?l<=r:o==='>'?l>r:l>=r;\n";
export const jsOp = (o: Op) => (o === "<" ? "<" : o === ">" ? ">" : o === "\\le" ? "<=" : ">=");
/** 순서쌍 목록 문자열 "(1, 2), (3, 4), and (5, 6)". */
export function pairList(ps: [number, number][]): string {
  const f = ps.map(([a, b]) => `$(${a}, ${b})$`);
  return f.length <= 2 ? f.join(" and ") : `${f.slice(0, -1).join(", ")}, and ${f[f.length - 1]}`;
}
/** 마지막 보충용 오답 후보: 정답 근처의 작은 계산 실수(의미 있는 후보가 모자랄 때만 뒤에 붙인다). */
export const near = (v: number): Wrong[] => [1, -1, 2, -2, 3].map((d) => W(v + d, "other", "계산 과정의 작은 실수."));

/** 선형 모델 맥락 은행: 시작값(b)·변화율(m)을 서로 다른 문장으로 서술하고 대응 키(명사구)를 함께 낸다. 서술은 대안 배열(rng.pick). */
export type LM = {
  subj: string; yName: string; yUnit: string; xUnit: string; xUnits: string;
  startKey: string; starts: ((b: number) => string)[]; rateKey: string; ups: ((m: number) => string)[]; downs: ((m: number) => string)[]; canDown: boolean;
};
export const LMS: LM[] = [
  { subj: "A water tank", yName: "volume of water", yUnit: "liters", xUnit: "minute", xUnits: "minutes", startKey: "at noon", starts: [(b) => `holds ${b} liters at noon`, (b) => `contains ${b} liters of water at noon`], rateKey: "each minute", ups: [(m) => `gains ${m} liters each minute`, (m) => `is filled at ${m} liters each minute`], downs: [(m) => `loses ${m} liters each minute`, (m) => `drains ${m} liters each minute`], canDown: true },
  { subj: "A savings account", yName: "balance", yUnit: "dollars", xUnit: "week", xUnits: "weeks", startKey: "when it is opened", starts: [(b) => `has ${b} dollars when it is opened`, (b) => `starts with a balance of ${b} dollars when it is opened`], rateKey: "each week", ups: [(m) => `gains ${m} dollars each week`, (m) => `grows by ${m} dollars each week`], downs: [(m) => `loses ${m} dollars each week`, (m) => `drops by ${m} dollars each week`], canDown: true },
  { subj: "A hiker", yName: "altitude", yUnit: "meters", xUnit: "hour", xUnits: "hours", startKey: "at the trailhead", starts: [(b) => `is at an altitude of ${b} meters at the trailhead`, (b) => `begins at ${b} meters of altitude at the trailhead`], rateKey: "each hour", ups: [(m) => `climbs ${m} meters each hour`, (m) => `gains ${m} meters of altitude each hour`], downs: [(m) => `descends ${m} meters each hour`, (m) => `loses ${m} meters of altitude each hour`], canDown: true },
  { subj: "A pot of water", yName: "temperature", yUnit: "degrees", xUnit: "minute", xUnits: "minutes", startKey: "when the timer starts", starts: [(b) => `is at ${b} degrees when the timer starts`, (b) => `reads ${b} degrees when the timer starts`], rateKey: "each minute", ups: [(m) => `warms by ${m} degrees each minute`, (m) => `heats up ${m} degrees each minute`], downs: [(m) => `cools by ${m} degrees each minute`, (m) => `loses ${m} degrees each minute`], canDown: true },
  { subj: "A warehouse", yName: "inventory", yUnit: "boxes", xUnit: "day", xUnits: "days", startKey: "at opening", starts: [(b) => `stores ${b} boxes at opening`, (b) => `has an inventory of ${b} boxes at opening`], rateKey: "each day", ups: [(m) => `receives ${m} boxes each day`, (m) => `takes in ${m} boxes each day`], downs: [(m) => `ships out ${m} boxes each day`, (m) => `sends away ${m} boxes each day`], canDown: true },
  { subj: "A channel", yName: "audience", yUnit: "subscribers", xUnit: "month", xUnits: "months", startKey: "at launch", starts: [(b) => `has ${b} subscribers at launch`, (b) => `begins with ${b} subscribers at launch`], rateKey: "each month", ups: [(m) => `gains ${m} subscribers each month`, (m) => `adds ${m} subscribers each month`], downs: [(m) => `loses ${m} subscribers each month`, (m) => `drops ${m} subscribers each month`], canDown: true },
  { subj: "A seedling", yName: "height", yUnit: "centimeters", xUnit: "week", xUnits: "weeks", startKey: "at the first measurement", starts: [(b) => `is ${b} centimeters tall at the first measurement`, (b) => `measures ${b} centimeters at the first measurement`], rateKey: "each week", ups: [(m) => `grows ${m} centimeters each week`, (m) => `gets ${m} centimeters taller each week`], downs: [(m) => `shrinks ${m} centimeters each week`, (m) => `loses ${m} centimeters of height each week`], canDown: false },
  { subj: "A taxi ride", yName: "fare", yUnit: "dollars", xUnit: "mile", xUnits: "miles", startKey: "as the base charge", starts: [(b) => `costs ${b} dollars as the base charge`, (b) => `has a base charge of ${b} dollars`], rateKey: "per mile", ups: [(m) => `adds ${m} dollars per mile`, (m) => `costs ${m} dollars more per mile`], downs: [(m) => `adds ${m} dollars per mile`], canDown: false },
  { subj: "A candle", yName: "length", yUnit: "centimeters", xUnit: "hour", xUnits: "hours", startKey: "when it is lit", starts: [(b) => `is ${b} centimeters long when it is lit`, (b) => `measures ${b} centimeters when it is lit`], rateKey: "each hour", ups: [(m) => `grows ${m} centimeters each hour`], downs: [(m) => `burns down ${m} centimeters each hour`, (m) => `gets ${m} centimeters shorter each hour`], canDown: true },
  { subj: "A library", yName: "collection", yUnit: "books", xUnit: "month", xUnits: "months", startKey: "in January", starts: [(b) => `owns ${b} books in January`, (b) => `has a collection of ${b} books in January`], rateKey: "each month", ups: [(m) => `buys ${m} books each month`, (m) => `adds ${m} books each month`], downs: [(m) => `retires ${m} books each month`, (m) => `removes ${m} books each month`], canDown: true },
  { subj: "A phone", yName: "storage in use", yUnit: "gigabytes", xUnit: "week", xUnits: "weeks", startKey: "when it is new", starts: [(b) => `has ${b} gigabytes in use when it is new`, (b) => `uses ${b} gigabytes of storage when it is new`], rateKey: "each week", ups: [(m) => `fills ${m} more gigabytes each week`, (m) => `stores ${m} additional gigabytes each week`], downs: [(m) => `frees ${m} gigabytes each week`, (m) => `clears ${m} gigabytes each week`], canDown: true },
];
/** 문맥 하나의 두 문장(시작값 문장·변화율 문장)과 대응표. m<0 이면 감소(canDown 인 맥락만). */
export function lmFacts(rng: { pick<T>(a: readonly T[]): T }, c: LM, b: number, m: number): { startS: string; rateS: string; bind: { phrase: string; value: number }[] } {
  const mm = Math.abs(m);
  return { startS: `${c.subj} ${rng.pick(c.starts)(b)}.`, rateS: `It ${m >= 0 ? rng.pick(c.ups)(mm) : rng.pick(c.downs)(mm)}.`, bind: [{ phrase: c.startKey, value: b }, { phrase: c.rateKey, value: mm }] };
}
