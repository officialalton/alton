// 묶음 T7(통계 추론·주장 평가) 전용 장면 키트 — T7 조합 파일들만 쓴다(T7 담당 소유).
// 자료 코드 ST(문장형 자료)는 렌더러의 data.statement(facts) 대신 '항목 | 값' 두 열의 data.table 로 조판한다:
//   figure-verify.ts 의 tamperFigure 는 DATA_KEYS(rows·cells·points…) 아래 숫자만 변조하고 statement.facts 는 건드리지 않아
//   statement 로는 자료 변조 검출(G6)이 0/N 이 된다. 같은 정보를 '조사 항목 | 값' 표로 두면 add/scale/neg/cell 변조가 모두 닿는다.
// 검증 JS 는 항목 이름(첫 열)으로 값을 찾고, 표본 내 응답 수의 합 = 표본 크기 같은 내부 일관성을 확인해 어긋나면 던진다.
import { GenFail } from "../../../types";
import type { Rng } from "../../../rng";

export type FactRow = [string, number | string];
export type FactFig = { type: "data"; kind: "table"; title: string; columns: string[]; rows: FactRow[] };
export const factFig = (title: string, rows: FactRow[], head = "Survey detail"): FactFig => ({ type: "data", kind: "table", title, columns: [head, "Value"], rows });
/** FIGURE.rows 에서 첫 열에 key(소문자 부분 문자열)가 든 행의 값을 읽는 JS. */
export const GET_JS = "const g=(k)=>{if(!FIGURE||!FIGURE.rows) throw new Error('자료 없음'); const r=FIGURE.rows.find(r=>String(r[0]).toLowerCase().includes(k)); if(!r) throw new Error('항목 없음: '+k); return r[1];};\n";
/** 응답 수 합 = 표본 크기 확인(어긋나면 던짐). yes/no 키는 행 이름의 부분 문자열. */
export const sumJs = (parts: string[], total: string) => `if (${parts.map((p) => `g(${JSON.stringify(p)})`).join(" + ")} !== g(${JSON.stringify(total)})) throw new Error('응답 수 합이 표본 크기와 다름');\n`;

// ───────────────────────── 설문 장면(표본 추정·오차범위·일반화) ─────────────────────────
/** ent: 복수 명사, popLbl: 표에 쓰는 모집단 이름, frame: 표집 틀(모집단의 일부) 이름, ev: '…라고 답한' 내용 */
export type Surv = { ent: string; popLbl: string; frame: string; ev: string; topic: string };
export const SURVEYS: Surv[] = [
  { ent: "residents", popLbl: "Residents of Millbrook", frame: "Residents with library cards", ev: "support building a new library", topic: "a proposed library" },
  { ent: "students", popLbl: "Students at Lincoln High School", frame: "Students in the school band", ev: "ride the bus to school", topic: "school transportation" },
  { ent: "customers", popLbl: "Customers of a grocery chain", frame: "Customers with loyalty cards", ev: "prefer shopping online", topic: "shopping habits" },
  { ent: "employees", popLbl: "Employees of a software company", frame: "Employees at the main office", ev: "work remotely at least one day a week", topic: "remote work" },
  { ent: "voters", popLbl: "Registered voters in Clay County", frame: "Voters on a party email list", ev: "favor a new park bond", topic: "a park bond" },
  { ent: "members", popLbl: "Members of a hiking club", frame: "Members who attended the spring trip", ev: "want a longer trail season", topic: "the trail season" },
  { ent: "households", popLbl: "Households in Riverton", frame: "Households on Oak Street", ev: "recycle every week", topic: "recycling" },
  { ent: "commuters", popLbl: "Commuters in a metro area", frame: "Commuters at one train station", ev: "use public transit daily", topic: "commuting" },
  { ent: "teachers", popLbl: "Teachers in Harbor School District", frame: "Teachers at one middle school", ev: "use a new grading app", topic: "grading tools" },
  { ent: "patients", popLbl: "Patients of a regional clinic network", frame: "Patients of the downtown clinic", ev: "are satisfied with wait times", topic: "clinic wait times" },
  { ent: "visitors", popLbl: "Visitors to a state park", frame: "Visitors who camped overnight", ev: "would return next year", topic: "park visits" },
  { ent: "farmers", popLbl: "Farmers in Hale County", frame: "Farmers in one cooperative", ev: "plan to plant more corn", topic: "planting plans" },
  { ent: "drivers", popLbl: "Licensed drivers in a state", frame: "Drivers renewing at one office", ev: "support lower speed limits", topic: "speed limits" },
  { ent: "athletes", popLbl: "Athletes in a youth league", frame: "Athletes on the soccer teams", ev: "want later practice times", topic: "practice times" },
  { ent: "nurses", popLbl: "Nurses at a hospital system", frame: "Nurses on the night shift", ev: "prefer twelve-hour shifts", topic: "shift lengths" },
  { ent: "gardeners", popLbl: "Members of a garden society", frame: "Members at the spring plant sale", ev: "grow their own tomatoes", topic: "home gardens" },
  { ent: "renters", popLbl: "Renters in Eastgate", frame: "Renters in one apartment complex", ev: "own a bicycle", topic: "bicycle ownership" },
  { ent: "readers", popLbl: "Subscribers to a city newspaper", frame: "Subscribers who read the website", ev: "want a weekend print edition", topic: "the print edition" },
  { ent: "musicians", popLbl: "Musicians in a community orchestra", frame: "Musicians in the string section", ev: "prefer evening rehearsals", topic: "rehearsal times" },
  { ent: "parents", popLbl: "Parents at Maple Elementary", frame: "Parents at the fall open house", ev: "support a longer school day", topic: "the school day" },
  { ent: "cyclists", popLbl: "Members of a cycling club", frame: "Members who ride on weekends", ev: "want more bike lanes downtown", topic: "bike lanes" },
  { ent: "shoppers", popLbl: "Shoppers at a downtown market", frame: "Shoppers at the Saturday market", ev: "bring their own bags", topic: "reusable bags" },
  { ent: "travelers", popLbl: "Travelers at a regional airport", frame: "Travelers on morning flights", ev: "check a bag", topic: "checked bags" },
  { ent: "volunteers", popLbl: "Volunteers at a food bank", frame: "Volunteers on the Monday crew", ev: "would help at a second site", topic: "a second site" },
];
export const surv = (rng: Rng) => rng.pick(SURVEYS);
export const lcf = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/** 표본 크기와 '예' 응답 수: 백분율이 정수가 되게 뽑는다. */
export function sampleCounts(rng: Rng, o: { nPool?: number[]; pLo?: number; pHi?: number } = {}): { n: number; yes: number; no: number; p: number } {
  for (let t = 0; t < 80; t++) {
    const n = rng.pick(o.nPool ?? [100, 200, 250, 300, 400, 500, 600, 800]); const p = rng.int(o.pLo ?? 12, o.pHi ?? 88);
    const yes = (n * p) / 100; if (!Number.isInteger(yes)) continue;
    return { n, yes, no: n - yes, p };
  }
  throw new GenFail("표본 수 표집 실패");
}

// ───────────────────────── 연구 장면(인과·연관·무작위 배정) ─────────────────────────
/** ent: 참가자, tr: 처치, out: 결과 이름(점수), unit: 결과 단위 낱말(UNITS 목록에 없는 'points' 계열만) */
export type Study = { ent: string; tr: string; out: string; pop: string; conf: string };
export const STUDIES: Study[] = [
  { ent: "students", tr: "a new reading app", out: "reading score", pop: "students at a large high school", conf: "already read more" },
  { ent: "employees", tr: "a standing desk", out: "energy rating", pop: "employees of a large company", conf: "exercise more often" },
  { ent: "patients", tr: "a daily stretching routine", out: "back pain score", pop: "patients of a clinic network", conf: "are healthier to begin with" },
  { ent: "runners", tr: "a new warm-up routine", out: "race fitness score", pop: "runners in a regional league", conf: "train more each week" },
  { ent: "volunteers", tr: "a mindfulness program", out: "stress score", pop: "adults in a city", conf: "sleep more" },
  { ent: "players", tr: "a video coaching tool", out: "shooting score", pop: "players in a basketball league", conf: "practice more" },
  { ent: "shoppers", tr: "a redesigned coupon booklet", out: "satisfaction rating", pop: "shoppers at a grocery chain", conf: "shop more often" },
  { ent: "teachers", tr: "a lesson-planning tool", out: "planning rating", pop: "teachers in a school district", conf: "have more experience" },
  { ent: "drivers", tr: "an online safety course", out: "driving test score", pop: "new drivers in a state", conf: "are more cautious" },
  { ent: "gardeners", tr: "a new plant fertilizer", out: "plant health score", pop: "home gardeners in a county", conf: "water their plants more" },
  { ent: "musicians", tr: "a daily ear-training app", out: "pitch accuracy score", pop: "musicians at a conservatory", conf: "practice longer" },
  { ent: "seniors", tr: "a balance exercise class", out: "balance score", pop: "adults over 65 in a city", conf: "are more active" },
  { ent: "workers", tr: "a short afternoon break", out: "focus rating", pop: "workers at a factory", conf: "work fewer shifts" },
  { ent: "children", tr: "a math puzzle game", out: "math quiz score", pop: "children at an elementary school", conf: "get more help at home" },
  { ent: "swimmers", tr: "a breathing drill", out: "endurance score", pop: "swimmers on club teams", conf: "swim more laps" },
  { ent: "nurses", tr: "a new scheduling system", out: "job satisfaction rating", pop: "nurses at a hospital system", conf: "work day shifts" },
  { ent: "chess players", tr: "an online puzzle trainer", out: "tactics score", pop: "players in a chess federation", conf: "play more games" },
  { ent: "cyclists", tr: "a sports drink", out: "recovery rating", pop: "cyclists in a racing club", conf: "ride more often" },
  { ent: "writers", tr: "a grammar feedback tool", out: "essay score", pop: "students in a writing program", conf: "write more often" },
  { ent: "customers", tr: "a loyalty reward", out: "store rating", pop: "customers of a coffee chain", conf: "visit more often" },
  { ent: "gamers", tr: "a blue-light filter", out: "sleep quality rating", pop: "adults who play video games", conf: "go to bed earlier" },
  { ent: "trainees", tr: "a virtual reality training module", out: "skills test score", pop: "trainees at a technical college", conf: "have more experience" },
];
export const study = (rng: Rng) => rng.pick(STUDIES);
export const RANDOM_ASSIGN = ["Random (coin flip)", "Random (computer draw)", "Random (names from a hat)"];
export const CHOICE_ASSIGN = ["Participants chose", "Volunteers chose", "Self-selected"];
export const RANDOM_SAMPLE = ["Random draw from a full list", "Random selection from a roster"];
export const NONRANDOM_SAMPLE = ["Volunteers who responded", "First people to arrive", "Online poll responses"];
/** JS: g('assignment') 가 무작위인지(문자열이 Random 으로 시작). */
export const isRandJs = (key: string) => `/^random/i.test(String(g(${JSON.stringify(key)})))`;
