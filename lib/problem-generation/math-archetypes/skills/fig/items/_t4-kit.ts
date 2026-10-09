// 묶음 T4(퍼센트·비율·일차방정식 문장제 값표) 전용 장면 키트 — 이 묶음의 조합 파일들만 쓴다.
// 규칙: 수치 먼저 → figure(data.table) → 지문은 "the table" 로 가리키고 값을 되풀이하지 않는다.
// 지문에서 표의 행 이름을 부르는 문장에는 숫자를 두지 않는다(data lint 의 ref_mismatch 오탐 방지).
import { GenFail } from "../../../types";
import type { Rng } from "../../../rng";
import { W } from "../../d-kit";
import { oneDec } from "../../../figure-kit";

export type Tab = { type: "data"; kind: "table"; title?: string; columns: string[]; rows: (string | number)[][] };
export const tab = (columns: string[], rows: (string | number)[][], title?: string): Tab => ({ type: "data", kind: "table", ...(title ? { title } : {}), columns, rows });
export const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
/** 오답 정리: 양수·유한·(정답이 소수 첫째 자리까지면) 소수 첫째 자리까지만. */
export const pos = (ws: ReturnType<typeof W>[], correct: number) => ws.filter((w) => Number.isFinite(w.v) && w.v > 0 && Math.abs(w.v - correct) > 1e-9 && oneDec(w.v) && w.v < 1000);
export const retry = <T>(n: number, f: () => T | null, why: string): T => { for (let i = 0; i < n; i++) { const r = f(); if (r !== null) return r; } throw new GenFail(why); };
export const r1 = (n: number) => Math.round(n * 10) / 10;

// ───────── 개수 장면: 행 이름 × 개수 ─────────
/** at: 특정 행 앞에 붙는 말("at", "on", "for the"), prep: 일반 문장의 전치사, many: 행 이름의 복수 명사. what 은 사건 개수 명사구. */
export type CountTopic = { rowHead: string; rows: string[]; many: string; at: string; prep: string; what: string; col: string; unit: string; who: string };
export const COUNT_TOPICS: CountTopic[] = [
  { rowHead: "Store", rows: ["Store A", "Store B", "Store C", "Store D", "Store E", "Store F"], many: "stores", at: "at", prep: "at", what: "bikes sold", col: "Bikes sold", unit: "bikes", who: "A bike company" },
  { rowHead: "Theater", rows: ["Rialto", "Strand", "Majestic", "Palace", "Lyric", "Orpheum"], many: "theaters", at: "at the", prep: "at", what: "tickets sold", col: "Tickets sold", unit: "tickets", who: "A theater group" },
  { rowHead: "Branch", rows: ["North Branch", "South Branch", "East Branch", "West Branch", "Central Branch", "Harbor Branch"], many: "branch libraries", at: "at", prep: "at", what: "books borrowed", col: "Books borrowed", unit: "books", who: "A city library system" },
  { rowHead: "Farm", rows: ["Farm A", "Farm B", "Farm C", "Farm D", "Farm E", "Farm F"], many: "farms", at: "at", prep: "at", what: "crates of apples packed", col: "Crates packed", unit: "crates", who: "A fruit cooperative" },
  { rowHead: "Bakery", rows: ["Shop A", "Shop B", "Shop C", "Shop D", "Shop E", "Shop F"], many: "bakery shops", at: "at", prep: "at", what: "loaves of bread sold", col: "Loaves sold", unit: "loaves", who: "A bakery chain" },
  { rowHead: "Park", rows: ["Elm Park", "Oak Park", "Cedar Park", "Pine Park", "Maple Park", "Birch Park"], many: "parks", at: "at", prep: "at", what: "visitors counted", col: "Visitors", unit: "visitors", who: "A parks department" },
  { rowHead: "Route", rows: ["Route 1", "Route 2", "Route 3", "Route 4", "Route 5", "Route 6"], many: "bus routes", at: "on", prep: "on", what: "riders counted", col: "Riders", unit: "riders", who: "A transit agency" },
  { rowHead: "Cafe", rows: ["Cafe Luna", "Cafe Sol", "Cafe Rio", "Cafe Bea", "Cafe Mia", "Cafe Ivy"], many: "cafes", at: "at", prep: "at", what: "cups of coffee sold", col: "Cups sold", unit: "cups", who: "A coffee company" },
  { rowHead: "Museum", rows: ["Art Museum", "Science Museum", "History Museum", "Space Museum", "Nature Museum", "Folk Museum"], many: "museums", at: "at the", prep: "at", what: "visitors admitted", col: "Visitors", unit: "visitors", who: "A city tourism office" },
  { rowHead: "Line", rows: ["Line 1", "Line 2", "Line 3", "Line 4", "Line 5", "Line 6"], many: "assembly lines", at: "on", prep: "on", what: "parts made", col: "Parts made", unit: "parts", who: "A factory" },
  { rowHead: "Gym", rows: ["Gym A", "Gym B", "Gym C", "Gym D", "Gym E", "Gym F"], many: "gyms", at: "at", prep: "at", what: "check-ins recorded", col: "Check-ins", unit: "check-ins", who: "A fitness chain" },
  { rowHead: "Hotel", rows: ["Hotel Alba", "Hotel Bay", "Hotel Crest", "Hotel Dune", "Hotel Fern", "Hotel Glen"], many: "hotels", at: "at", prep: "at", what: "rooms booked", col: "Rooms booked", unit: "rooms", who: "A hotel group" },
  { rowHead: "Truck", rows: ["Taco Truck", "Pizza Truck", "Noodle Truck", "Burger Truck", "Salad Truck", "Crepe Truck"], many: "food trucks", at: "by the", prep: "by", what: "meals sold", col: "Meals sold", unit: "meals", who: "A food truck owner" },
  { rowHead: "Clinic", rows: ["Clinic A", "Clinic B", "Clinic C", "Clinic D", "Clinic E", "Clinic F"], many: "clinics", at: "at", prep: "at", what: "patients seen", col: "Patients seen", unit: "patients", who: "A health network" },
  { rowHead: "Shelter", rows: ["Shelter A", "Shelter B", "Shelter C", "Shelter D", "Shelter E", "Shelter F"], many: "animal shelters", at: "at", prep: "at", what: "pets adopted", col: "Pets adopted", unit: "pets", who: "A rescue group" },
  { rowHead: "Pool", rows: ["Pool A", "Pool B", "Pool C", "Pool D", "Pool E", "Pool F"], many: "pools", at: "at", prep: "at", what: "swimmers admitted", col: "Swimmers", unit: "swimmers", who: "A recreation center" },
  { rowHead: "Plot", rows: ["Plot A", "Plot B", "Plot C", "Plot D", "Plot E", "Plot F"], many: "garden plots", at: "from", prep: "from", what: "tomatoes picked", col: "Tomatoes picked", unit: "tomatoes", who: "A community garden" },
  { rowHead: "Team", rows: ["Hawks", "Lions", "Bears", "Owls", "Foxes", "Wolves"], many: "teams", at: "for the", prep: "for", what: "season tickets sold", col: "Season tickets", unit: "tickets", who: "A youth league" },
  { rowHead: "Kiosk", rows: ["Kiosk A", "Kiosk B", "Kiosk C", "Kiosk D", "Kiosk E", "Kiosk F"], many: "kiosks", at: "at", prep: "at", what: "maps sold", col: "Maps sold", unit: "maps", who: "A visitor center" },
  { rowHead: "Booth", rows: ["Booth A", "Booth B", "Booth C", "Booth D", "Booth E", "Booth F"], many: "fair booths", at: "at", prep: "at", what: "raffle tickets sold", col: "Raffle tickets", unit: "tickets", who: "A school fair committee" },
  { rowHead: "Lane", rows: ["Lane A", "Lane B", "Lane C", "Lane D", "Lane E", "Lane F"], many: "toll lanes", at: "in", prep: "in", what: "cars counted", col: "Cars", unit: "cars", who: "A highway office" },
  { rowHead: "Nursery", rows: ["Green Acres", "Sunny Hill", "Fern Hollow", "Rose Glen", "Ivy Ridge", "Oak Hollow"], many: "plant nurseries", at: "at", prep: "at", what: "trees sold", col: "Trees sold", unit: "trees", who: "A landscaping supplier" },
];
export const nameAt = (t: CountTopic, name: string) => `${t.at} ${name}`;
export type CountScene = { t: CountTopic; names: string[]; vals: number[] };
/** 개수 장면: n 개 행, 값은 lo~hi 의 step 배수(서로 다름). */
export function countScene(rng: Rng, n: number, lo: number, hi: number, step: number, topic?: CountTopic): CountScene {
  const t = topic ?? rng.pick(COUNT_TOPICS); const names = rng.shuffle(t.rows).slice(0, n).sort((a, b) => t.rows.indexOf(a) - t.rows.indexOf(b));
  return retry(40, () => { const vals = names.map(() => step * rng.int(Math.ceil(lo / step), Math.floor(hi / step))); return new Set(vals).size === n ? { t, names, vals } : null; }, "개수 장면");
}
export const countFig = (s: CountScene) => tab([s.t.rowHead, `${s.t.col} (${s.t.unit})`], s.names.map((nm, i) => [nm, s.vals[i]]));
export const countIntro = (rng: Rng, s: CountScene, when = rng.pick(["last month", "last week", "on one Saturday", "during one month", "last year", "during a holiday weekend"])) => rng.pick([
  `${s.t.who} recorded the number of ${s.t.what} ${s.t.prep} each of ${s.names.length} ${s.t.many} ${when}. The results are shown in the table.`,
  `The table shows the number of ${s.t.what} ${s.t.prep} each of ${s.names.length} ${s.t.many} ${when}.`,
  `The number of ${s.t.what} ${s.t.prep} each of several ${s.t.many} ${when} is given in the table shown.`,
  `For a report, ${lcFirst(s.t.who)} listed the number of ${s.t.what} ${s.t.prep} several ${s.t.many} ${when}, as shown in the table.`,
]);
export const lcFirst = (x: string) => x.charAt(0).toLowerCase() + x.slice(1);
/** FIGURE(이름 × 값 표)에서 값 v·이름 nm·합 S 를 읽고, 값이 수가 아니면 던지는 JS. */
export const ROW_JS = "const nm=FIGURE.rows.map(r=>r[0]); const v=FIGURE.rows.map(r=>r[1]); if (v.some(x=>typeof x!=='number')) throw new Error('값 오류'); const S=v.reduce((a,b)=>a+b,0); const at=(k)=>{ const i=nm.indexOf(k); if (i<0) throw new Error('행 없음'); return v[i]; };\n";

// ───────── 두 기간 장면: 행 이름 × (기간 1, 기간 2) ─────────
export const PERIODS: [string, string][] = [["Last year", "This year"], ["May", "June"], ["Spring", "Fall"], ["Week 1", "Week 2"], ["Saturday", "Sunday"], ["March", "April"], ["Before the sale", "During the sale"], ["First month", "Second month"]];
export type TwoScene = CountScene & { p: [string, string]; v2: number[]; pct: number[] };
export const twoFig = (s: TwoScene) => tab([s.t.rowHead, `${s.p[0]} (${s.t.unit})`, `${s.p[1]} (${s.t.unit})`], s.names.map((nm, i) => [nm, s.vals[i], s.v2[i]]), s.t.col);
export const pLow = (p: string) => (/^(May|June|March|April|Saturday|Sunday)$/.test(p) ? p : lcFirst(p));
/** 두 기간 장면: 기간 1 값은 20 의 배수, 퍼센트 변화는 5 의 배수(양·음). 기간 2 값은 정수. */
export function twoScene(rng: Rng, n: number, pcts: number[]): TwoScene {
  const p = rng.pick(PERIODS);
  return retry(60, () => {
    const s = countScene(rng, n, 40, 400, 20); const pct = s.names.map(() => rng.pick(pcts)); const v2 = s.vals.map((v, i) => (v * (100 + pct[i])) / 100);
    if (v2.some((x) => !Number.isInteger(x) || x > 999 || x <= 0)) return null; return { ...s, p, v2, pct };
  }, "두 기간 장면");
}
export const twoIntro = (rng: Rng, s: TwoScene) => rng.pick([
  `The table shows the number of ${s.t.what} ${s.t.prep} each of ${s.names.length} ${s.t.many} in two time periods.`,
  `${s.t.who} compared the number of ${s.t.what} ${s.t.prep} several ${s.t.many} in two periods, as shown in the table.`,
  `The table shown gives the number of ${s.t.what} ${s.t.prep} ${s.names.length} ${s.t.many}, for ${pLow(s.p[0])} and for ${pLow(s.p[1])}.`,
  `For each of several ${s.t.many}, the table lists the number of ${s.t.what} in two periods.`,
]);
/** FIGURE(이름 × 두 기간)에서 a(기간 1)·b(기간 2)·이름 nm 을 읽는 JS. */
export const TWO_JS = "const nm=FIGURE.rows.map(r=>r[0]); const a=FIGURE.rows.map(r=>r[1]), b=FIGURE.rows.map(r=>r[2]); if (a.some(x=>typeof x!=='number'||x<=0)||b.some(x=>typeof x!=='number')) throw new Error('값 오류'); const idx=(k)=>{ const i=nm.indexOf(k); if (i<0) throw new Error('행 없음'); return i; }; const pc=(i)=>(b[i]-a[i])/a[i]*100;\n";
