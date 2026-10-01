// 표 계열(값·함수표 TB · 도수표 FQ) 자료 원형 공용 장면 키트 — 1단계(표 계열) 조합 파일들이 함께 쓴다.
// 규칙: 수치를 먼저 뽑고 → figure(data.table)를 만들고 → 지문은 값을 되풀이하지 않고 "the table shown" 으로 가리킨다.
// verification_js 는 FIGURE.rows 만 읽어 다시 계산하고, 표가 장면의 전제(일차 관계 등)를 어기면 던진다 — 칸 하나만 바뀌어도(G6 'cell' 변조) 검출된다.
import { GenFail } from "../../types";
import type { Rng } from "../../rng";
import { SE_TOPICS, type SeTopic } from "../../figure-topics";
import { fmtNum } from "../../text";

export const lc = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const isInt = Number.isInteger;

// ───────────────────────── 일차 관계 값표(TB) ─────────────────────────
/** 표 열 이름에 단위를 넣을 수 있고, 'x 가 a 단위일 때' 문장이 자연스러운 장면만(단위에 'of'·'per' 가 든 x 는 뺀다). */
export const LIN_TOPICS: SeTopic[] = SE_TOPICS.filter((t) => !/ of | per /.test(t.xu) && t.xa !== t.ya);
export const CONV_LIN_TOPICS: SeTopic[] = LIN_TOPICS.filter((t) => t.conv);
export type LinTab = {
  t: SeTopic; xs: number[]; ys: number[]; m: number; b: number; d: number; fig: { type: "data"; kind: "table"; columns: string[]; rows: number[][] };
  /** 'the hours studied' 처럼 문장 안에서 쓰는 양 이름 */ xq: string; yq: string;
};
export const linFig = (t: SeTopic, xs: number[], ys: number[]) => ({ type: "data" as const, kind: "table" as const, columns: [`${t.xa} (${t.xu})`, `${t.ya} (${t.yu})`], rows: xs.map((x, i) => [x, ys[i]]) });
export type LinOpts = { topic?: SeTopic; conv?: boolean; n?: number; /** 기울기를 0.5 단위까지 허용 */ half?: boolean; mSign?: 1 | -1; x0Zero?: boolean; noZeroX?: boolean };
/** 일차 관계 y = m x + b 의 값표: x 는 등간격(간격 d), y 는 0 이상 정수. 표에 x = 0 이 없을 수도 있다(절편은 계산해야 함). */
export function makeLinTab(rng: Rng, o: LinOpts = {}): LinTab {
  const pool = o.conv ? CONV_LIN_TOPICS : LIN_TOPICS;
  for (let tr = 0; tr < 80; tr++) {
    const t = o.topic ?? rng.pick(pool); const n = o.n ?? rng.int(4, 5);
    const d = o.half ? rng.pick([2, 4]) : rng.pick([1, 2, 2, 3, 5]);
    const x0 = o.x0Zero ? 0 : o.noZeroX ? rng.pick([1, 2, 3, 4, 5]) * d : rng.pick([0, 1, 2, 3]) * d;
    const sign = o.mSign ?? (rng.chance(0.7) ? 1 : -1);
    const m = o.half ? sign * (rng.int(1, 9) + 0.5) : sign * rng.int(2, 12);
    const b = rng.int(2, 60) + (sign < 0 ? Math.ceil(Math.abs(m) * (x0 + d * (n + 6))) : 0);
    if (!isInt(m * d) || !isInt(m * x0)) continue;
    const xs = Array.from({ length: n }, (_, i) => x0 + d * i); const ys = xs.map((x) => m * x + b);
    if (ys.some((y) => y < 0 || y > 900 || !isInt(y))) continue;
    return { t, xs, ys, m, b, d, fig: linFig(t, xs, ys), xq: t.x, yq: t.y };
  }
  throw new GenFail("일차 값표 장면 표집 실패");
}
/** FIGURE(table, 두 열)에서 m, b 를 읽고 모든 행이 한 직선 위인지 확인하는 JS. */
export const LIN_JS = "const xs=FIGURE.rows.map(r=>r[0]), ys=FIGURE.rows.map(r=>r[1]); const m=(ys[1]-ys[0])/(xs[1]-xs[0]); const b=ys[0]-m*xs[0]; for (let i=0;i<xs.length;i++) if (Math.abs(m*xs[i]+b-ys[i])>1e-9) throw new Error('표가 일차 관계가 아님');\n";
export const linIntro = (rng: Rng, s: LinTab) => rng.pick([
  `The table shows ${s.yq} for several values of ${s.xq}. The relationship between the two quantities is linear.`,
  `The table shown gives several values of ${s.xq} and the matching values of ${s.yq}. There is a linear relationship between these quantities.`,
  `A linear relationship relates ${s.xq} to ${s.yq}. Some pairs of values are shown in the table.`,
  `For a linear model, the table lists ${s.yq} at several values of ${s.xq}.`,
]);
/** 사람이 표에서 읽는 두 행과 기울기 계산(해설용). */
export const linRead = (s: LinTab): [string, string][] => [
  [`표에서 두 행 (${s.xs[0]}, ${s.ys[0]}) 과 (${s.xs[1]}, ${s.ys[1]}) 을 읽는다.`, "Read two rows of the table."],
  [`기울기 = (${s.ys[1]} - ${s.ys[0]}) ÷ (${s.xs[1]} - ${s.xs[0]}) = ${fmtNum(s.m)} 이다.`, "Compute the rate of change."],
];
export const capFirst = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
export const linIntercept = (s: LinTab): [string, string] => [`x = 0 일 때 값: ${s.ys[0]} - (${fmtNum(s.m)}) × ${s.xs[0]} = ${fmtNum(s.b)} 이다.`, "Find the value at x = 0."];
/** 지문에 둘 새 x(표 밖, 정수). */
export const offX = (rng: Rng, s: LinTab, lo = 1, hi = 8) => s.xs[s.xs.length - 1] + s.d * rng.int(lo, hi) + (rng.chance(0.5) ? 1 : 0);
/** 단위 환산 장면: 표 제목에 '1 hour = 60 minutes' 를 둔다(환산 정보도 자료에만). */
export const convFig = (s: LinTab) => ({ ...s.fig, title: `1 ${sing(s.t.xu)} = ${s.t.conv!.per} ${s.t.conv!.small}` });
/** FIGURE.title 의 환산 비율(per)을 읽는 JS. */
export const CONV_JS = "const cm = /= (\\d+) /.exec(FIGURE.title || ''); if (!cm) throw new Error('환산 없음'); const per = Number(cm[1]);\n";
export const sing = (u: string) => u.replace(/ies$/, "y").replace(/(ches|shes|sses)$/, (m) => m.slice(0, -2)).replace(/s$/, "");

// ───────────────────────── 도수표(FQ)·값 목록 표(TB) ─────────────────────────
export type FqTopic = { what: string; col: string; unit: string; cnt: string; ent: string; where: string; lo: number; hi: number; step: number };
/** 도수표 장면 — 값 열(단위 포함) × 도수 열. 값은 lo~hi, step 간격. */
export const FQ_TOPICS: FqTopic[] = [
  { what: "number of books each student read last month", col: "Books read", unit: "books", cnt: "Number of students", ent: "students", where: "in a reading club", lo: 0, hi: 8, step: 1 },
  { what: "number of pets in each household", col: "Pets", unit: "pets", cnt: "Number of households", ent: "households", where: "on one street", lo: 0, hi: 6, step: 1 },
  { what: "number of siblings each student has", col: "Siblings", unit: "siblings", cnt: "Number of students", ent: "students", where: "in a class", lo: 0, hi: 5, step: 1 },
  { what: "number of goals each player scored this season", col: "Goals scored", unit: "goals", cnt: "Number of players", ent: "players", where: "in a soccer league", lo: 0, hi: 9, step: 1 },
  { what: "number of hours each volunteer worked", col: "Hours worked", unit: "hours", cnt: "Number of volunteers", ent: "volunteers", where: "at a food bank", lo: 1, hi: 9, step: 1 },
  { what: "number of cars in each family", col: "Cars owned", unit: "cars", cnt: "Number of families", ent: "families", where: "in a neighborhood", lo: 0, hi: 4, step: 1 },
  { what: "score each student earned on a 10-point quiz", col: "Quiz score", unit: "points", cnt: "Number of students", ent: "students", where: "in a math class", lo: 3, hi: 10, step: 1 },
  { what: "number of text messages each person sent in an hour", col: "Messages sent", unit: "messages", cnt: "Number of people", ent: "people", where: "in a survey", lo: 0, hi: 12, step: 2 },
  { what: "number of days each employee worked from home", col: "Days at home", unit: "days", cnt: "Number of employees", ent: "employees", where: "at a firm", lo: 0, hi: 5, step: 1 },
  { what: "number of eggs in each nest", col: "Eggs per nest", unit: "eggs", cnt: "Number of nests", ent: "nests", where: "in a bird survey", lo: 1, hi: 7, step: 1 },
  { what: "number of rooms in each apartment", col: "Rooms", unit: "rooms", cnt: "Number of apartments", ent: "apartments", where: "in a building", lo: 1, hi: 6, step: 1 },
  { what: "age of each camper", col: "Age", unit: "years", cnt: "Number of campers", ent: "campers", where: "at a summer camp", lo: 9, hi: 15, step: 1 },
  { what: "number of minutes each runner rested", col: "Rest time", unit: "minutes", cnt: "Number of runners", ent: "runners", where: "on a running team", lo: 5, hi: 40, step: 5 },
  { what: "number of hours of sleep each student got", col: "Hours of sleep", unit: "hours", cnt: "Number of students", ent: "students", where: "in a health study", lo: 4, hi: 10, step: 1 },
  { what: "number of plants that sprouted in each tray", col: "Sprouted plants", unit: "plants", cnt: "Number of trays", ent: "trays", where: "in a greenhouse", lo: 2, hi: 9, step: 1 },
  { what: "number of laps each swimmer completed", col: "Laps", unit: "laps", cnt: "Number of swimmers", ent: "swimmers", where: "at a swim practice", lo: 10, hi: 30, step: 2 },
  { what: "number of customers each server waited on in an hour", col: "Customers served", unit: "customers", cnt: "Number of servers", ent: "servers", where: "at a restaurant chain", lo: 2, hi: 10, step: 1 },
  { what: "number of museums each tourist visited", col: "Museums visited", unit: "museums", cnt: "Number of tourists", ent: "tourists", where: "in a city survey", lo: 0, hi: 5, step: 1 },
  { what: "number of times each person exercised last week", col: "Workouts", unit: "workouts", cnt: "Number of people", ent: "people", where: "at a gym", lo: 0, hi: 7, step: 1 },
  { what: "length of each fish caught", col: "Fish length", unit: "inches", cnt: "Number of fish", ent: "fish", where: "in a fishing contest", lo: 8, hi: 20, step: 2 },
  { what: "number of trees planted by each team", col: "Trees planted", unit: "trees", cnt: "Number of teams", ent: "teams", where: "on Arbor Day", lo: 4, hi: 16, step: 2 },
  { what: "number of hits each batter got in a season series", col: "Hits", unit: "hits", cnt: "Number of batters", ent: "batters", where: "on a baseball team", lo: 0, hi: 6, step: 1 },
  { what: "number of correct answers each contestant gave", col: "Correct answers", unit: "answers", cnt: "Number of contestants", ent: "contestants", where: "in a trivia contest", lo: 2, hi: 10, step: 1 },
  { what: "number of songs each student downloaded", col: "Songs downloaded", unit: "songs", cnt: "Number of students", ent: "students", where: "in a music class", lo: 0, hi: 10, step: 2 },
  { what: "number of miles each commuter drives to work", col: "Commute distance", unit: "miles", cnt: "Number of commuters", ent: "commuters", where: "in a small town", lo: 2, hi: 14, step: 2 },
  { what: "number of loaves each baker made", col: "Loaves baked", unit: "loaves", cnt: "Number of bakers", ent: "bakers", where: "at a bakery fair", lo: 10, hi: 18, step: 1 },
  { what: "number of goals each hockey team allowed", col: "Goals allowed", unit: "goals", cnt: "Number of teams", ent: "teams", where: "in a hockey league", lo: 1, hi: 7, step: 1 },
  { what: "number of photos each club member submitted", col: "Photos submitted", unit: "photos", cnt: "Number of members", ent: "members", where: "in a photography club", lo: 1, hi: 8, step: 1 },
  { what: "number of rainy days in each month", col: "Rainy days", unit: "days", cnt: "Number of months", ent: "months", where: "in a weather record", lo: 3, hi: 12, step: 1 },
  { what: "price of each item on a menu", col: "Price", unit: "dollars", cnt: "Number of items", ent: "items", where: "at a cafe", lo: 4, hi: 14, step: 2 },
];
export type FqScene = { t: FqTopic; vals: number[]; freqs: number[]; N: number; sum: number; fig: { type: "data"; kind: "table"; columns: string[]; rows: number[][] } };
export const fqFig = (t: FqTopic, vals: number[], freqs: number[]) => ({ type: "data" as const, kind: "table" as const, columns: [`${t.col} (${t.unit})`, t.cnt], rows: vals.map((v, i) => [v, freqs[i]]) });
/** 도수표: 연속한 k(4~6)개 값, 도수 1~fmax. 모든 도수 ≥ 1. */
export function makeFq(rng: Rng, o: { k?: number; fmax?: number; topic?: FqTopic } = {}): FqScene {
  const t = o.topic ?? rng.pick(FQ_TOPICS); const span = Math.floor((t.hi - t.lo) / t.step) + 1; const k = Math.min(o.k ?? rng.int(4, 6), span);
  const start = t.lo + t.step * rng.int(0, span - k); const vals = Array.from({ length: k }, (_, i) => start + t.step * i);
  const freqs = vals.map(() => rng.int(1, o.fmax ?? 9)); const N = freqs.reduce((a, b) => a + b, 0); const sum = vals.reduce((a, v, i) => a + v * freqs[i], 0);
  return { t, vals, freqs, N, sum, fig: fqFig(t, vals, freqs) };
}
/** FIGURE(도수표)에서 값·도수·전체 개수·합·펼친 목록(정렬)을 읽는 JS. 도수가 음수·비정수면 던진다. */
export const FQ_JS = "const vals=FIGURE.rows.map(r=>r[0]), fr=FIGURE.rows.map(r=>r[1]); if (fr.some(f=>f<0||!Number.isInteger(f))) throw new Error('도수 오류'); const N=fr.reduce((a,b)=>a+b,0); const S=vals.reduce((a,v,i)=>a+v*fr[i],0); const list=[]; vals.forEach((v,i)=>{ for(let k=0;k<fr[i];k++) list.push(v); }); list.sort((p,q)=>p-q); const med=list.length%2?list[(list.length-1)/2]:(list[list.length/2-1]+list[list.length/2])/2;\n";
export const expand = (s: { vals: number[]; freqs: number[] }) => { const l: number[] = []; s.vals.forEach((v, i) => { for (let k = 0; k < s.freqs[i]; k++) l.push(v); }); return l.sort((p, q) => p - q); };
export const medianOfList = (l: number[]) => { const s = [...l].sort((p, q) => p - q); const n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
export const fqIntro = (rng: Rng, s: FqScene) => rng.pick([
  `The frequency table shows the ${s.t.what} for ${s.t.ent} ${s.t.where}.`,
  `The table shown summarizes the ${s.t.what} for a group of ${s.t.ent} ${s.t.where}.`,
  `A survey recorded the ${s.t.what} for ${s.t.ent} ${s.t.where}. The results are shown in the table.`,
]);
export const fqRead = (s: FqScene): [string, string] => [`표에서 값과 도수를 읽는다: ${s.vals.map((v, i) => `${v}(${s.freqs[i]})`).join(", ")} — 전체 ${s.N}개.`, "Read each value and its frequency from the table."];

// ── 값 목록 표(TB): 행 이름(요일·주·가게 등) × 값 열 ──
export type ListTopic = { rowHead: string; rows: string[]; col: string; unit: string; noun: string; ctx: string; lo: number; hi: number };
export const LIST_TOPICS: ListTopic[] = [
  { rowHead: "Day", rows: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"], col: "Visitors", unit: "people", noun: "number of visitors", ctx: "a museum recorded its daily attendance for one week", lo: 20, hi: 90 },
  { rowHead: "Week", rows: ["Week 1", "Week 2", "Week 3", "Week 4", "Week 5", "Week 6", "Week 7"], col: "Rainfall", unit: "millimeters", noun: "rainfall", ctx: "a weather station recorded the weekly rainfall", lo: 4, hi: 60 },
  { rowHead: "Store", rows: ["Store A", "Store B", "Store C", "Store D", "Store E", "Store F", "Store G"], col: "Bikes sold", unit: "bikes", noun: "number of bikes sold", ctx: "a company recorded the bikes sold at each of its stores in one month", lo: 10, hi: 80 },
  { rowHead: "Player", rows: ["Ana", "Ben", "Cy", "Dee", "Eli", "Fay", "Gus"], col: "Points", unit: "points", noun: "number of points scored", ctx: "a coach recorded the points each player scored in a tournament", lo: 2, hi: 40 },
  { rowHead: "Month", rows: ["January", "February", "March", "April", "May", "June", "July"], col: "Electricity used", unit: "kilowatt-hours", noun: "electricity used", ctx: "a family recorded its monthly electricity use", lo: 300, hi: 900 },
  { rowHead: "Classroom", rows: ["Room 101", "Room 102", "Room 103", "Room 104", "Room 105", "Room 106", "Room 107"], col: "Students", unit: "students", noun: "number of students", ctx: "a school recorded the number of students in each classroom", lo: 15, hi: 35 },
  { rowHead: "Trail", rows: ["Ridge", "Creek", "Pine", "Lake", "Meadow", "Summit", "Valley"], col: "Length", unit: "kilometers", noun: "length", ctx: "a park lists the lengths of its hiking trails", lo: 2, hi: 18 },
  { rowHead: "Shift", rows: ["Shift 1", "Shift 2", "Shift 3", "Shift 4", "Shift 5", "Shift 6", "Shift 7"], col: "Boxes packed", unit: "boxes", noun: "number of boxes packed", ctx: "a warehouse recorded the boxes packed during each shift", lo: 40, hi: 120 },
  { rowHead: "City", rows: ["Avon", "Bexley", "Carlow", "Dover", "Easton", "Fulton", "Garner"], col: "High temperature", unit: "degrees", noun: "high temperature", ctx: "a newspaper listed the high temperature in several cities on one day", lo: 50, hi: 95 },
  { rowHead: "Tree", rows: ["Tree 1", "Tree 2", "Tree 3", "Tree 4", "Tree 5", "Tree 6", "Tree 7"], col: "Height", unit: "feet", noun: "height", ctx: "a forester measured the heights of several trees", lo: 12, hi: 70 },
  { rowHead: "Runner", rows: ["Kim", "Lee", "Moe", "Ned", "Ola", "Pat", "Quin"], col: "Finish time", unit: "minutes", noun: "finish time", ctx: "a race official recorded the finish times of several runners", lo: 20, hi: 60 },
  { rowHead: "Farm", rows: ["Farm A", "Farm B", "Farm C", "Farm D", "Farm E", "Farm F", "Farm G"], col: "Harvest", unit: "bushels", noun: "harvest", ctx: "an agency recorded the apple harvest at several farms", lo: 30, hi: 99 },
  { rowHead: "Bus route", rows: ["Route 1", "Route 2", "Route 3", "Route 4", "Route 5", "Route 6", "Route 7"], col: "Riders", unit: "riders", noun: "number of riders", ctx: "a transit agency counted the riders on several bus routes one morning", lo: 25, hi: 95 },
  { rowHead: "Lake", rows: ["Lake Ash", "Lake Birch", "Lake Cedar", "Lake Elm", "Lake Fir", "Lake Oak", "Lake Pine"], col: "Depth", unit: "meters", noun: "depth", ctx: "a survey recorded the greatest depth of several lakes", lo: 8, hi: 60 },
  { rowHead: "Student", rows: ["Ava", "Bo", "Cal", "Dia", "Ezra", "Finn", "Gia"], col: "Test score", unit: "points", noun: "test score", ctx: "a teacher recorded the test scores of several students", lo: 60, hi: 99 },
  { rowHead: "Truck", rows: ["Truck 1", "Truck 2", "Truck 3", "Truck 4", "Truck 5", "Truck 6", "Truck 7"], col: "Load", unit: "tons", noun: "load", ctx: "a shipping company recorded the load carried by each truck", lo: 3, hi: 20 },
  { rowHead: "Library", rows: ["North", "South", "East", "West", "Central", "Harbor", "Hill"], col: "Books borrowed", unit: "books", noun: "number of books borrowed", ctx: "a city recorded the books borrowed at each branch library in one day", lo: 40, hi: 99 },
  { rowHead: "Day", rows: ["Day 1", "Day 2", "Day 3", "Day 4", "Day 5", "Day 6", "Day 7"], col: "Snowfall", unit: "centimeters", noun: "snowfall", ctx: "a ski resort recorded its daily snowfall", lo: 1, hi: 30 },
  { rowHead: "Team", rows: ["Hawks", "Lions", "Bears", "Owls", "Foxes", "Wolves", "Eagles"], col: "Wins", unit: "games", noun: "number of wins", ctx: "a league listed the wins of several teams", lo: 3, hi: 25 },
  { rowHead: "Garden", rows: ["Plot A", "Plot B", "Plot C", "Plot D", "Plot E", "Plot F", "Plot G"], col: "Tomatoes picked", unit: "tomatoes", noun: "number of tomatoes picked", ctx: "a gardener recorded the tomatoes picked from each plot", lo: 10, hi: 60 },
];
export type ListScene = { t: ListTopic; names: string[]; vals: number[]; fig: { type: "data"; kind: "table"; columns: string[]; rows: (string | number)[][] } };
export const listFig = (t: ListTopic, names: string[], vals: number[]) => ({ type: "data" as const, kind: "table" as const, columns: [t.rowHead, `${t.col} (${t.unit})`], rows: names.map((nm, i) => [nm, vals[i]]) });
/** 값 목록 표: n(5~7)행, 값은 서로 다를 필요는 없지만 모두 lo~hi 정수. */
export function makeList(rng: Rng, o: { n?: number; topic?: ListTopic; distinct?: boolean } = {}): ListScene {
  const t = o.topic ?? rng.pick(LIST_TOPICS); const n = o.n ?? rng.int(5, 7); const names = t.rows.slice(0, n);
  for (let tr = 0; tr < 40; tr++) { const vals = names.map(() => rng.int(t.lo, t.hi)); if (o.distinct && new Set(vals).size !== n) continue; return { t, names, vals, fig: listFig(t, names, vals) }; }
  throw new GenFail("값 목록 표 표집 실패");
}
/** FIGURE(값 목록 표)에서 값 배열 v, 개수 n, 합 S 를 읽는 JS. */
export const LIST_JS = "const v=FIGURE.rows.map(r=>r[1]); if (v.some(x=>typeof x!=='number')) throw new Error('값 오류'); const n=v.length; const S=v.reduce((a,b)=>a+b,0); const sv=[...v].sort((p,q)=>p-q);\n";
export const listIntro = (rng: Rng, s: ListScene) => rng.pick([
  `The table shows the ${s.t.noun} for each of ${s.names.length} entries after ${s.t.ctx}.`,
  `To collect data, ${s.t.ctx}. The results are shown in the table.`,
  `The table shown lists the ${s.t.noun}, in ${s.t.unit}, recorded when ${s.t.ctx}.`,
]);
export const listRead = (s: ListScene): [string, string] => [`표의 값을 읽는다: ${s.vals.join(", ")} (${s.vals.length}개).`, "Read the values from the table."];
