// SAT R&W 'command_of_evidence_quant'(표·그래프 근거) 결정형 컴파일러 (백로그 A4, 2026-10-20). AI 호출 없음(비용 0), DB 없음.
//   npx tsx scripts/mock-exam-generation/rw-quant-compiler.ts [--out data/mock-exam-generation/sat-quant-20261020/final] [--count 36]
// 모든 선택지는 자료에 적힌 값을 정확히 인용한다(사실 오류 없음). 정답은 "주장을 실제로 뒷받침하는" 단 하나이고, 오답은 같은 자료의 다른 행·기간을 인용해 주장을 뒷받침하지 못한다.
// 정답 유일성은 구성 단계에서 보장하고, 별도 독립 검증기(rw-quant-verify.ts)가 문항 텍스트만 읽어 다시 확인한다.
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

export type Family = "PAIR_COMPARE" | "RATIO_VS_BASELINE" | "TARGET_MET" | "MAX_CHANGE" | "MAX_STEP";
export type Claim =
  | { type: "PAIR"; p: string; q: string }
  | { type: "RATIO"; q: string; factor: number }
  | { type: "TARGET" }
  | { type: "CHANGE"; threshold: number }
  | { type: "STEP"; threshold: number };

function rng(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const pick = <T,>(r: () => number, xs: T[]): T => xs[Math.floor(r() * xs.length)];
const shuffle = <T,>(r: () => number, xs: T[]): T[] => { const a = [...xs]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const ri = (r: () => number, lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1));
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// ── 시나리오 ────────────────────────────────────────────
type Cross = { id: string; role: string; setup: string; group: string; singular: string; entities: string[]; the: boolean; measureNoun: string; measureHas: string; unit: string; pct?: boolean; entityCol: string; colTitle: string; title: string; lo: number; hi: number };
const CROSS: Cross[] = [
  { id: "pinniped", role: "a marine biologist", setup: "fitted satellite tags to seals and sea lions of several species and recorded how long their typical dives lasted", group: "species", singular: "species", entities: ["Weddell seal", "elephant seal", "harbor seal", "California sea lion", "leopard seal", "fur seal", "hooded seal"], the: true, measureNoun: "average dive duration", measureHas: "an average dive duration of", unit: "minutes", entityCol: "Species", colTitle: "Average Dive Duration (minutes)", title: "Average Dive Duration by Pinniped Species", lo: 4, hi: 60 },
  { id: "libraries", role: "a city planner", setup: "compared the number of visitors that neighborhood branch libraries received in a typical week", group: "branches", singular: "branch", entities: ["Harbor Street branch", "Millbrook branch", "Cedar Park branch", "Riverside branch", "Oak Hill branch", "Lakeview branch", "Station Road branch"], the: true, measureNoun: "weekly visitor count", measureHas: "a weekly visitor count of", unit: "visitors", entityCol: "Branch", colTitle: "Weekly Visitors (number of visitors)", title: "Weekly Visitors at Neighborhood Library Branches", lo: 220, hi: 1900 },
  { id: "rainfall", role: "a climatologist", setup: "gathered annual rainfall totals for several weather stations across a mountain valley", group: "stations", singular: "station", entities: ["Alder Gap", "Bell Ridge", "Cutter Flat", "Dunmore", "East Fork", "Fenner Pass", "Gray Hollow"], the: false, measureNoun: "annual rainfall", measureHas: "annual rainfall of", unit: "centimeters", entityCol: "Station", colTitle: "Annual Rainfall (centimeters)", title: "Annual Rainfall at Valley Weather Stations", lo: 25, hi: 190 },
  { id: "orbit", role: "an astronomer", setup: "measured how long each of several newly discovered exoplanets takes to complete one orbit of its star", group: "planets", singular: "planet", entities: ["Kestrel b", "Marlow b", "Tamsin b", "Orrin b", "Vesper b", "Calder b", "Ismene b"], the: false, measureNoun: "orbital period", measureHas: "an orbital period of", unit: "Earth days", entityCol: "Planet", colTitle: "Orbital Period (Earth days)", title: "Orbital Periods of Newly Discovered Exoplanets", lo: 6, hi: 400 },
  { id: "bakery", role: "a food scientist", setup: "baked loaves with different flour blends and measured how much each loaf's volume rose during proofing", group: "blends", singular: "blend", entities: ["rye blend", "spelt blend", "oat blend", "barley blend", "whole wheat blend", "buckwheat blend", "millet blend"], the: true, measureNoun: "proofing rise", measureHas: "a proofing rise of", unit: "percent", pct: true, entityCol: "Flour blend", colTitle: "Proofing Rise (percent)", title: "Dough Volume Increase by Flour Blend", lo: 12, hi: 95 },
  { id: "battery", role: "an engineer", setup: "tested prototype batteries and recorded how many hours each one powered a standard sensor before it shut down", group: "prototypes", singular: "prototype", entities: ["Model Alder", "Model Birch", "Model Cypress", "Model Dogwood", "Model Elm", "Model Fir", "Model Hazel"], the: false, measureNoun: "runtime", measureHas: "a runtime of", unit: "hours", entityCol: "Prototype", colTitle: "Runtime (hours)", title: "Sensor Runtime of Prototype Batteries", lo: 8, hi: 140 },
  { id: "crops", role: "an agronomist", setup: "grew several varieties of wheat on test plots and recorded the grain harvested from each plot", group: "varieties", singular: "variety", entities: ["Ardent", "Beacon", "Clarion", "Drummer", "Emblem", "Forager", "Granger"], the: false, measureNoun: "grain yield per plot", measureHas: "a grain yield of", unit: "kilograms", entityCol: "Variety", colTitle: "Grain Yield per Plot (kilograms)", title: "Wheat Yield by Variety", lo: 30, hi: 190 },
  { id: "museum", role: "a museum analyst", setup: "counted the visitors who attended each of the museum's permanent galleries during a holiday weekend", group: "galleries", singular: "gallery", entities: ["Maritime Hall", "Textile Room", "Mineral Court", "Printing Annex", "Clockwork Gallery", "Folk Art Wing", "Glass Atrium"], the: true, measureNoun: "holiday-weekend attendance", measureHas: "a holiday-weekend attendance of", unit: "visitors", entityCol: "Gallery", colTitle: "Holiday-Weekend Attendance (visitors)", title: "Attendance at Permanent Galleries", lo: 140, hi: 1500 },
];
type Target = { id: string; role: string; setup: string; group: string; singular: string; entities: string[]; the: boolean; goalNoun: string; unit: string; entityCol: string; targetCol: string; actualCol: string; title: string; lo: number; hi: number };
const TARGETS: Target[] = [
  { id: "recycling", role: "a county official", setup: "set a yearly recycling target for each of several drop-off centers and then recorded how much each center actually collected", group: "centers", singular: "center", entities: ["North Gate", "Pine Lane", "Quarry Road", "Mill Bridge", "Sunset Mall", "Depot Square"], the: true, goalNoun: "collection", unit: "tons", entityCol: "Center", targetCol: "Target (tons)", actualCol: "Actual (tons)", title: "Recycling Collected Compared With Target", lo: 120, hi: 560 },
  { id: "tutoring", role: "a school administrator", setup: "set a sign-up target for each after-school tutoring program and then recorded how many students actually enrolled", group: "programs", singular: "program", entities: ["Math Lab", "Writing Studio", "Science Club", "Reading Circle", "Coding Hour", "Test Prep"], the: true, goalNoun: "enrollment", unit: "students", entityCol: "Program", targetCol: "Target (students)", actualCol: "Actual (students)", title: "Tutoring Enrollment Compared With Target", lo: 24, hi: 150 },
  { id: "reforest", role: "a conservation manager", setup: "set a planting goal for each of several reforestation sites and then recorded how many seedlings were actually planted", group: "sites", singular: "site", entities: ["Elk Meadow", "Fern Gully", "Ridgeback", "Stone Creek", "Willow Bend", "Thistle Run"], the: true, goalNoun: "planting", unit: "seedlings", entityCol: "Site", targetCol: "Target (seedlings)", actualCol: "Actual (seedlings)", title: "Seedlings Planted Compared With Target", lo: 800, hi: 4800 },
  { id: "clinic", role: "a public health researcher", setup: "set a vaccination goal for each of several community clinics and then recorded how many patients each clinic actually vaccinated", group: "clinics", singular: "clinic", entities: ["Eastside", "Harbor", "Ridge", "Valley", "Lakeshore", "Crossroads"], the: true, goalNoun: "vaccination count", unit: "patients", entityCol: "Clinic", targetCol: "Target (patients)", actualCol: "Actual (patients)", title: "Vaccinations Compared With Clinic Goals", lo: 180, hi: 900 },
];
type BA = { id: string; role: string; setup: string; group: string; singular: string; entities: string[]; the: boolean; measureNoun: string; unit: string; aName: string; bName: string; aPhrase: string; bPhrase: string; title: string; yTitle: string; lo: number; hi: number };
const BAS: BA[] = [
  { id: "bus", role: "a transit analyst", setup: "counted average weekday riders on several bus routes before and after the routes were redesigned", group: "routes", singular: "route", entities: ["Harbor Line", "Maple Line", "Summit Line", "Garden Line", "Mill Line", "Bridge Line"], the: true, measureNoun: "average weekday ridership", unit: "riders", aName: "Before redesign", bName: "After redesign", aPhrase: "before the redesign", bPhrase: "after the redesign", title: "Average Weekday Riders Before and After Redesign", yTitle: "Average weekday riders", lo: 240, hi: 900 },
  { id: "lakes", role: "a limnologist", setup: "measured water clarity in several lakes before and after a volunteer cleanup program", group: "lakes", singular: "lake", entities: ["Lake Aster", "Lake Bryn", "Lake Corva", "Lake Delmar", "Lake Evers", "Lake Fallow"], the: false, measureNoun: "water clarity", unit: "centimeters", aName: "Before cleanup", bName: "After cleanup", aPhrase: "before the cleanup", bPhrase: "after the cleanup", title: "Water Clarity Before and After Cleanup", yTitle: "Water clarity (centimeters)", lo: 60, hi: 340 },
  { id: "reading", role: "a literacy researcher", setup: "tested students' reading speed in several classrooms at the start and at the end of a semester-long reading program", group: "classrooms", singular: "classroom", entities: ["Room Amber", "Room Basil", "Room Cobalt", "Room Dune", "Room Ember", "Room Fjord"], the: false, measureNoun: "average reading speed", unit: "words per minute", aName: "Start of semester", bName: "End of semester", aPhrase: "at the start of the semester", bPhrase: "at the end of the semester", title: "Average Reading Speed at Start and End of Semester", yTitle: "Reading speed (words per minute)", lo: 90, hi: 260 },
  { id: "orchard", role: "a horticulturist", setup: "compared the apples harvested from several orchard blocks in a season before and after a new irrigation system was installed", group: "blocks", singular: "block", entities: ["Block Aspen", "Block Birch", "Block Cedar", "Block Dale", "Block Elder", "Block Flint"], the: false, measureNoun: "apple harvest", unit: "bushels", aName: "Before irrigation", bName: "After irrigation", aPhrase: "before the irrigation system", bPhrase: "after the irrigation system", title: "Apple Harvest Before and After New Irrigation", yTitle: "Apple harvest (bushels)", lo: 140, hi: 640 },
  { id: "gym", role: "a recreation director", setup: "recorded monthly memberships at several community gyms before and after a membership discount was introduced", group: "gyms", singular: "gym", entities: ["Northside Gym", "Parkview Gym", "Quayside Gym", "Rosewood Gym", "Southgate Gym", "Tidewater Gym"], the: false, measureNoun: "monthly membership count", unit: "members", aName: "Before discount", bName: "After discount", aPhrase: "before the discount", bPhrase: "after the discount", title: "Monthly Gym Memberships Before and After Discount", yTitle: "Members", lo: 180, hi: 780 },
];
type TS = { id: string; role: string; setup: string; measureNoun: string; unit: string; periodNoun: string; start: number; title: string; xTitle: string; yTitle: string; lo: number; hi: number };
const TSS: TS[] = [
  { id: "solar", role: "an energy analyst", setup: "tracked the electricity generated each year by a city's rooftop solar panels", measureNoun: "rooftop solar output", unit: "megawatt-hours", periodNoun: "year", start: 2014, title: "Annual Rooftop Solar Output", xTitle: "Year", yTitle: "Solar output (megawatt-hours)", lo: 400, hi: 2600 },
  { id: "bees", role: "an entomologist", setup: "counted the active honeybee colonies in a county's apiaries at the end of each year", measureNoun: "colony count", unit: "colonies", periodNoun: "year", start: 2013, title: "Active Honeybee Colonies by Year", xTitle: "Year", yTitle: "Active colonies", lo: 120, hi: 900 },
  { id: "enroll", role: "a university registrar", setup: "recorded how many students enrolled in a language program in each fall term", measureNoun: "fall enrollment", unit: "students", periodNoun: "year", start: 2015, title: "Fall Enrollment in the Language Program", xTitle: "Year", yTitle: "Students enrolled", lo: 180, hi: 1100 },
  { id: "bikes", role: "a city transportation planner", setup: "counted the bicycle trips taken on a bike-share system during the month of June in each year", measureNoun: "June trip count", unit: "trips", periodNoun: "year", start: 2012, title: "June Bike-Share Trips by Year", xTitle: "Year", yTitle: "Trips (thousands)", lo: 20, hi: 160 },
  { id: "glacier", role: "a glaciologist", setup: "measured the thickness of ice at a fixed survey point on a glacier at the end of each summer", measureNoun: "ice thickness", unit: "meters", periodNoun: "year", start: 2011, title: "Ice Thickness at the Survey Point", xTitle: "Year", yTitle: "Ice thickness (meters)", lo: 90, hi: 420 },
];

// ── 결과 ────────────────────────────────────────────────
export type Built = {
  gid: string; family: Family; scenario: string; difficulty: "easy" | "medium" | "hard"; figureKind: string; claim: Claim; seed: number;
  passage: string; question: string; options: string[]; correctIndex: number; figure: Record<string, unknown>;
  explanation: string; explanationEn: string; evidenceTarget: string; answerRationale: string; distractorErrorTypes: string[]; entityNames: string[];
};
const fmt = (n: number) => String(n);
const withUnit = (v: number, u: string, pct?: boolean) => (pct ? `${fmt(v)}%` : `${fmt(v)} ${u}`);
const ent = (e: string, the: boolean) => (the ? `the ${e}` : e);
const entCap = (e: string, the: boolean) => cap(ent(e, the));
const refWord = (kind: string) => (kind === "table" ? "table" : "graph");
const lead = (r: () => number, kind: string, role: string) => pick(r, [`which choice most effectively uses data from the ${refWord(kind)} to support ${role.replace(/^an? /, "the ")}'s claim?`, `which choice most effectively uses data from the ${refWord(kind)} to illustrate ${role.replace(/^an? /, "the ")}'s claim?`]);
const theRole = (s: string) => `The ${s.replace(/^an? /, "")}`;

function bounded(r: () => number, n: number, lo: number, hi: number, minGap: number): number[] | null {
  for (let t = 0; t < 200; t++) {
    const vs = Array.from({ length: n }, () => ri(r, lo, hi));
    const sorted = [...vs].sort((a, b) => a - b);
    if (sorted.every((v, i) => i === 0 || v - sorted[i - 1] >= minGap)) return vs;
  }
  return null;
}
const roundNice = (v: number, lo: number, hi: number) => { const step = hi - lo > 400 ? 10 : hi - lo > 100 ? 5 : 1; return Math.round(v / step) * step; };

function placeCorrect(r: () => number, wantIdx: number, correct: string, wrongs: string[], wrongTypes: string[]) {
  const opts: string[] = []; const types: string[] = []; let w = 0;
  for (let i = 0; i < wrongs.length + 1; i++) { if (i === wantIdx) opts.push(correct); else { opts.push(wrongs[w]); types.push(wrongTypes[w]); w++; } }
  return { options: opts, types };
}

export function build(family: Family, seed: number, wantIdx: number): Built | null {
  const r = rng(seed);
  const gid = `quant-${family.toLowerCase().replace(/_/g, "-")}-${seed}`;
  if (family === "PAIR_COMPARE" || family === "RATIO_VS_BASELINE") {
    const sc = pick(r, CROSS); const n = ri(r, 5, 6);
    const names = shuffle(r, sc.entities).slice(0, n);
    const kind = r() < 0.5 || names.some((x) => x.length > 11) ? "table" : "bar";
    const vals = bounded(r, n, sc.lo, sc.hi, family === "PAIR_COMPARE" ? Math.max(2, Math.round((sc.hi - sc.lo) * 0.03)) : 1)?.map((v) => roundNice(v, sc.lo, sc.hi));
    if (!vals || new Set(vals).size !== n) return null;
    const u = sc.unit;
    const cite = (e: string) => `${entCap(e, sc.the)} had ${sc.measureHas} ${withUnit(vals[names.indexOf(e)], u, sc.pct)}`;
    const cite2 = (e: string) => `${ent(e, sc.the)} had ${sc.measureHas} ${withUnit(vals[names.indexOf(e)], u, sc.pct)}`;
    const pair = (a: string, b: string) => `${cite(a)}, while ${cite2(b)}.`;
    let claimText = ""; let claim: Claim; let correct = ""; let wrongs: string[] = []; let types: string[] = []; let expEn = ""; let expKr = ""; let rationale = ""; let diff: Built["difficulty"] = "easy"; let target = "EXACT_LOOKUP";
    if (family === "PAIR_COMPARE") {
      const order = names.map((_, i) => i).sort((a, b) => vals[b] - vals[a]);
      const pi = order[0 + ri(r, 0, 1)]; let qi = order[2 + ri(r, 0, n - 3)];
      if (pi === qi) return null;
      const P = names[pi], Q = names[qi];
      claim = { type: "PAIR", p: P, q: Q };
      claimText = `${theRole(sc.role)} claims that ${ent(P, sc.the)} had a greater ${sc.measureNoun} than ${ent(Q, sc.the)}.`;
      correct = r() < 0.5 ? pair(P, Q) : pair(Q, P);
      const others = names.filter((x) => x !== P && x !== Q);
      const wr: [string, string, string][] = [
        [pair(P, others[0]), "WRONG_ROW", "x"], [pair(Q, others[1 % others.length]), "WRONG_ROW", "x"], [pair(others[others.length - 1], others[0] === others[others.length - 1] ? others[1] : others[0]), "WRONG_ROW", "x"],
      ];
      if (others.length < 2) return null;
      wrongs = wr.map((w) => w[0]); types = wr.map((w) => w[1]);
      if (new Set([correct, ...wrongs]).size !== 4) return null;
      const dv = vals[pi] - vals[qi];
      expEn = `The claim compares ${ent(P, sc.the)} with ${ent(Q, sc.the)}, so the correct choice must give the value for each of those two items. ${cap(ent(P, sc.the))} had ${sc.measureHas} ${withUnit(vals[pi], u, sc.pct)} and ${ent(Q, sc.the)} had ${withUnit(vals[qi], u, sc.pct)}, a difference of ${withUnit(dv, u, sc.pct)}, which supports the claim. Each of the other choices reports accurate values but leaves out ${ent(P, sc.the)}, ${ent(Q, sc.the)}, or both, so none of them can support a claim about that comparison.`;
      expKr = `주장은 ${ent(P, sc.the)}와 ${ent(Q, sc.the)}를 비교하므로, 정답은 두 대상의 값을 모두 제시해야 한다. 자료에서 ${P}는 ${withUnit(vals[pi], u, sc.pct)}, ${Q}는 ${withUnit(vals[qi], u, sc.pct)}로 차이가 ${withUnit(dv, u, sc.pct)}이므로 주장을 뒷받침한다. 나머지 선택지는 값은 맞지만 비교 대상 중 하나 또는 둘 다를 빠뜨려 이 주장을 뒷받침하지 못한다.`;
      rationale = `${P}(${vals[pi]})와 ${Q}(${vals[qi]})의 두 값을 모두 인용한 선택지만 비교 주장을 뒷받침한다.`; target = "DIFFERENCE"; diff = "easy";
    } else {
      const bi = ri(r, 0, n - 1); const Q = names[bi]; const base = vals[bi];
      const ok = names.map((_, i) => i).filter((i) => i !== bi && vals[i] > 2 * base);
      const near = names.map((_, i) => i).filter((i) => i !== bi && vals[i] <= 2 * base);
      if (ok.length !== 1 || near.length < 3) return null;
      const E = names[ok[0]];
      claim = { type: "RATIO", q: Q, factor: 2 };
      claimText = `${theRole(sc.role)} claims that at least one of the ${sc.group} had more than twice the ${sc.measureNoun} of ${ent(Q, sc.the)}.`;
      correct = pair(E, Q);
      const nearSorted = near.sort((a, b) => vals[b] - vals[a]);
      wrongs = [pair(names[nearSorted[0]], Q), pair(names[nearSorted[1]], Q), pair(names[nearSorted[2]], Q)];
      types = ["ADJACENT_CELL", "WRONG_ROW", "WRONG_ROW"];
      if (new Set([correct, ...wrongs]).size !== 4) return null;
      expEn = `The claim is about a ${sc.singular} whose ${sc.measureNoun} is more than double that of ${ent(Q, sc.the)}, which is ${withUnit(base, u, sc.pct)}, so the threshold is ${withUnit(2 * base, u, sc.pct)}. Only ${ent(E, sc.the)} exceeds that threshold at ${withUnit(vals[ok[0]], u, sc.pct)}. In the other choices the ${sc.singular} named is at most ${withUnit(Math.max(...near.map((i) => vals[i])), u, sc.pct)}, which is not more than twice ${withUnit(base, u, sc.pct)}.`;
      expKr = `주장은 ${ent(Q, sc.the)}(${withUnit(base, u, sc.pct)})의 두 배보다 큰 값을 가진 대상이 있다는 것이므로 기준값은 ${withUnit(2 * base, u, sc.pct)}이다. 이를 넘는 것은 ${E}(${withUnit(vals[ok[0]], u, sc.pct)})뿐이다. 나머지 선택지의 대상은 모두 ${withUnit(Math.max(...near.map((i) => vals[i])), u, sc.pct)} 이하로, ${withUnit(base, u, sc.pct)}의 두 배를 넘지 않는다.`;
      rationale = `기준 ${Q}=${base}의 2배(${2 * base})를 넘는 값은 ${E}=${vals[ok[0]]} 하나뿐이다.`; target = "EXACT_LOOKUP"; diff = "medium";
    }
    const pl = placeCorrect(r, wantIdx, correct, wrongs, types);
    const figure: Record<string, unknown> = kind === "table"
      ? { type: "data", kind: "table", title: sc.title, columns: [sc.entityCol, sc.colTitle], rows: names.map((e, i) => [e.replace(/^the /, ""), vals[i]]) }
      : { type: "data", kind: "bar", title: sc.title, categories: names.map((e) => e.replace(/^the /, "")), series: [{ values: vals }], xTitle: sc.entityCol, yTitle: sc.colTitle, valueLabels: true };
    const passage = `${cap(sc.role)} ${sc.setup}. The ${refWord(kind)} below shows the results. ${claimText}`;
    const question = `Which choice most effectively uses data from the ${refWord(kind)} to support the claim?`;
    void lead;
    return { gid, family, scenario: sc.id, difficulty: diff, figureKind: kind, claim, seed, passage, question, options: pl.options, correctIndex: pl.options.indexOf(correct), figure, explanation: expKr, explanationEn: expEn, evidenceTarget: target, answerRationale: rationale, distractorErrorTypes: pl.types, entityNames: names };
  }
  if (family === "TARGET_MET") {
    const sc = pick(r, TARGETS); const n = 5;
    const names = shuffle(r, sc.entities).slice(0, n);
    const targets = names.map(() => roundNice(ri(r, sc.lo, sc.hi), sc.lo, sc.hi));
    const meet = ri(r, 0, n - 1);
    const actuals = targets.map((t, i) => (i === meet ? roundNice(Math.round(t * (1.05 + r() * 0.15)), sc.lo, sc.hi) : roundNice(Math.round(t * (0.7 + r() * 0.22)), sc.lo, sc.hi)));
    if (!actuals.every((a, i) => (i === meet ? a >= targets[i] : a < targets[i]))) return null;
    if (new Set(names.map((_, i) => `${targets[i]}-${actuals[i]}`)).size !== n) return null;
    const trap = names.map((_, i) => i).filter((i) => i !== meet && actuals[i] > actuals[meet]);
    const cite = (i: number) => `${entCap(names[i], sc.the)} had a target of ${fmt(targets[i])} ${sc.unit} and an actual ${sc.goalNoun} of ${fmt(actuals[i])} ${sc.unit}.`;
    const missIdx = names.map((_, i) => i).filter((i) => i !== meet).sort((a, b) => (trap.includes(b) ? 1 : 0) - (trap.includes(a) ? 1 : 0) || actuals[b] - actuals[a]);
    const correct = cite(meet); const wrongs = missIdx.slice(0, 3).map(cite);
    if (new Set([correct, ...wrongs]).size !== 4) return null;
    const pl = placeCorrect(r, wantIdx, correct, wrongs, ["WRONG_ROW", "WRONG_ROW", "WRONG_ROW"]);
    const kind = "table";
    const figure = { type: "data", kind: "table", title: sc.title, columns: [sc.entityCol, sc.targetCol, sc.actualCol], rows: names.map((e, i) => [e, targets[i], actuals[i]]) };
    const passage = `${cap(sc.role)} ${sc.setup}. The table below shows each target and the actual result. ${theRole(sc.role)} claims that at least one of the ${sc.group} met its target.`;
    const question = `Which choice most effectively uses data from the table to support the claim?`;
    const expEn = `To meet its target, a ${sc.singular}'s actual ${sc.goalNoun} must be at least as large as its own target. ${cap(ent(names[meet], sc.the))} reached ${fmt(actuals[meet])} ${sc.unit} against a target of ${fmt(targets[meet])} ${sc.unit}, so it met the target. In each of the other choices the actual figure is below that ${sc.singular}'s own target${trap.length ? `, even where it is larger than the winning figure (${fmt(actuals[meet])}), because the targets differ` : ""}.`;
    const expKr = `목표를 달성하려면 실제 값이 그 대상 자신의 목표 이상이어야 한다. ${names[meet]}은(는) 목표 ${fmt(targets[meet])} ${sc.unit}에 대해 실제 ${fmt(actuals[meet])} ${sc.unit}로 목표를 달성했다. 나머지 선택지의 대상은 모두 자기 목표에 미달한다${trap.length ? `(실제 값이 ${fmt(actuals[meet])}보다 큰 경우도 있지만 목표가 서로 달라 비교할 수 없다)` : ""}.`;
    return { gid, family, scenario: sc.id, difficulty: "medium", figureKind: kind, claim: { type: "TARGET" }, seed, passage, question, options: pl.options, correctIndex: pl.options.indexOf(correct), figure, explanation: expKr, explanationEn: expEn, evidenceTarget: "DIFFERENCE", answerRationale: `${names[meet]}만 실제(${actuals[meet]})가 목표(${targets[meet]}) 이상이다.`, distractorErrorTypes: pl.types, entityNames: names };
  }
  if (family === "MAX_CHANGE") {
    const sc = pick(r, BAS); const n = 6; const names = shuffle(r, sc.entities).slice(0, n);
    const before = names.map(() => roundNice(ri(r, sc.lo, sc.hi), sc.lo, sc.hi));
    const gains = names.map(() => ri(r, 1, 6) * (sc.hi - sc.lo > 400 ? 10 : 5));
    const big = ri(r, 0, n - 1); gains[big] = Math.max(...gains) + (sc.hi - sc.lo > 400 ? 40 : 20);
    const after = before.map((b, i) => b + gains[i]);
    const T = Math.max(...gains.filter((_, i) => i !== big)) + (sc.hi - sc.lo > 400 ? 10 : 5);
    if (!(gains[big] > T)) return null;
    const maxAfter = after.indexOf(Math.max(...after)); if (maxAfter === big) return null;
    const cite = (i: number) => `${entCap(names[i], sc.the)}'s ${sc.measureNoun} went from ${fmt(before[i])} ${sc.unit} ${sc.aPhrase} to ${fmt(after[i])} ${sc.unit} ${sc.bPhrase}.`;
    const others = names.map((_, i) => i).filter((i) => i !== big);
    const trapIdx = others.includes(maxAfter) ? [maxAfter, ...others.filter((i) => i !== maxAfter)] : others;
    const correct = cite(big); const wrongs = trapIdx.slice(0, 3).map(cite);
    const pl = placeCorrect(r, wantIdx, correct, wrongs, ["ADJACENT_CELL", "WRONG_ROW", "WRONG_ROW"]);
    const kind = r() < 0.55 && names.every((x) => x.length <= 11) ? "bar" : "table";
    const figure = kind === "bar"
      ? { type: "data", kind: "bar", title: sc.title, categories: names, series: [{ name: sc.aName, values: before }, { name: sc.bName, values: after }], xTitle: cap(sc.singular), yTitle: sc.yTitle, valueLabels: true }
      : { type: "data", kind: "table", title: sc.title, columns: [cap(sc.singular), `${sc.aName} (${sc.unit})`, `${sc.bName} (${sc.unit})`], rows: names.map((e, i) => [e, before[i], after[i]]) };
    const passage = `${cap(sc.role)} ${sc.setup}. The ${refWord(kind)} below shows the results. ${theRole(sc.role)} claims that the ${sc.measureNoun} of at least one of the ${sc.group} rose by more than ${T} ${sc.unit}.`;
    const question = `Which choice most effectively uses data from the ${refWord(kind)} to support the claim?`;
    const expEn = `The claim requires an increase of more than ${T} ${sc.unit}. ${cap(ent(names[big], sc.the))} rose from ${before[big]} to ${after[big]} ${sc.unit}, an increase of ${gains[big]} ${sc.unit}, which exceeds ${T}. The other choices describe increases of at most ${Math.max(...others.map((i) => gains[i]))} ${sc.unit}${trapIdx[0] === maxAfter ? `, including ${ent(names[maxAfter], sc.the)}, which has the highest value ${sc.bPhrase} but not a large enough increase` : ""}.`;
    const expKr = `주장은 증가량이 ${T} ${sc.unit}보다 커야 한다고 요구한다. ${names[big]}은(는) ${before[big]}에서 ${after[big]} ${sc.unit}로 ${gains[big]} ${sc.unit} 증가해 기준을 넘는다. 나머지 선택지의 증가량은 최대 ${Math.max(...others.map((i) => gains[i]))} ${sc.unit}로 기준에 못 미친다${trapIdx[0] === maxAfter ? `(${names[maxAfter]}은 ${sc.bPhrase}의 값이 가장 크지만 증가량은 충분하지 않다)` : ""}.`;
    return { gid, family, scenario: sc.id, difficulty: trapIdx[0] === maxAfter ? "hard" : "medium", figureKind: kind, claim: { type: "CHANGE", threshold: T }, seed, passage, question, options: pl.options, correctIndex: pl.options.indexOf(correct), figure, explanation: expKr, explanationEn: expEn, evidenceTarget: "DIFFERENCE", answerRationale: `${names[big]}의 증가량 ${gains[big]}만 기준 ${T}를 넘는다.`, distractorErrorTypes: pl.types, entityNames: names };
  }
  // MAX_STEP
  const sc = pick(r, TSS); const n = ri(r, 7, 8);
  const years = Array.from({ length: n }, (_, i) => String(sc.start + i));
  const unit10 = sc.hi - sc.lo > 400 ? 10 : 5;
  const vals: number[] = [roundNice(ri(r, sc.lo, Math.round(sc.lo + (sc.hi - sc.lo) * 0.3)), sc.lo, sc.hi)];
  for (let i = 1; i < n; i++) vals.push(Math.max(sc.lo, vals[i - 1] + ri(r, -2, 5) * unit10));
  const steps = vals.slice(1).map((v, i) => v - vals[i]);
  const bigStep = ri(r, 1, n - 2); // 인덱스: steps[bigStep] 가 가장 큰 상승(0..n-2)
  const maxOther = Math.max(...steps.filter((_, i) => i !== bigStep));
  const need = maxOther + 6 * unit10 - steps[bigStep];
  for (let j = bigStep + 1; j < n; j++) vals[j] += need;
  const steps2 = vals.slice(1).map((v, i) => v - vals[i]);
  const T = Math.max(...steps2.filter((_, i) => i !== bigStep)) + unit10;
  if (!(steps2[bigStep] > T) || Math.max(...vals) > sc.hi * 1.4 || steps2.filter((s) => s > T).length !== 1) return null;
  const cite = (i: number) => `From ${years[i]} to ${years[i + 1]}, ${sc.measureNoun} went from ${fmt(vals[i])} ${sc.unit} to ${fmt(vals[i + 1])} ${sc.unit}.`;
  const citeSpan = (i: number) => `From ${years[i]} to ${years[i + 2]}, ${sc.measureNoun} went from ${fmt(vals[i])} ${sc.unit} to ${fmt(vals[i + 2])} ${sc.unit}.`;
  const spanI = bigStep >= 1 ? bigStep - 1 : bigStep; // 큰 상승을 포함하는 2년 구간(함정)
  if (spanI + 2 >= n) return null;
  if (!(vals[spanI + 2] - vals[spanI] > T)) return null;
  const rest = steps2.map((_, i) => i).filter((i) => i !== bigStep && i !== spanI && i !== spanI + 1);
  if (rest.length < 2) return null;
  const sortedRest = rest.sort((a, b) => steps2[b] - steps2[a]);
  const correct = cite(bigStep); const wrongs = [citeSpan(spanI), cite(sortedRest[0]), cite(sortedRest[1])];
  if (new Set([correct, ...wrongs]).size !== 4) return null;
  const pl = placeCorrect(r, wantIdx, correct, wrongs, ["OFF_BY_ONE_INDEX", "ADJACENT_CELL", "WRONG_ROW"]);
  const kind = "line";
  const figure = { type: "data", kind: "line", title: sc.title, categories: years, series: [{ values: vals }], xTitle: sc.xTitle, yTitle: sc.yTitle, valueLabels: true };
  const passage = `${cap(sc.role)} ${sc.setup}. The graph below shows the results. ${theRole(sc.role)} claims that in a single ${sc.periodNoun}, the ${sc.measureNoun} rose by more than ${T} ${sc.unit}.`;
  const question = `Which choice most effectively uses data from the graph to support the claim?`;
  const expEn = `The claim is about a rise of more than ${T} ${sc.unit} within a single ${sc.periodNoun}. From ${years[bigStep]} to ${years[bigStep + 1]}, the value rose from ${vals[bigStep]} to ${vals[bigStep + 1]} ${sc.unit}, an increase of ${steps2[bigStep]} ${sc.unit}, which exceeds ${T}. The choice covering ${years[spanI]} to ${years[spanI + 2]} spans two ${sc.periodNoun}s, so its larger change (${vals[spanI + 2] - vals[spanI]} ${sc.unit}) does not show a one-${sc.periodNoun} rise; the remaining choices show one-${sc.periodNoun} changes of at most ${Math.max(steps2[sortedRest[0]], steps2[sortedRest[1]])} ${sc.unit}.`;
  const expKr = `주장은 한 해 사이에 ${T} ${sc.unit}보다 크게 올랐다는 것이다. ${years[bigStep]}년에서 ${years[bigStep + 1]}년 사이 값은 ${vals[bigStep]}에서 ${vals[bigStep + 1]} ${sc.unit}로 ${steps2[bigStep]} ${sc.unit} 올라 기준을 넘는다. ${years[spanI]}년~${years[spanI + 2]}년 선택지는 두 해에 걸친 변화(${vals[spanI + 2] - vals[spanI]} ${sc.unit})라 한 해의 상승을 보이지 못하고, 나머지는 한 해 변화가 최대 ${Math.max(steps2[sortedRest[0]], steps2[sortedRest[1]])} ${sc.unit}에 그친다.`;
  return { gid, family, scenario: sc.id, difficulty: "hard", figureKind: kind, claim: { type: "STEP", threshold: T }, seed, passage, question, options: pl.options, correctIndex: pl.options.indexOf(correct), figure, explanation: expKr, explanationEn: expEn, evidenceTarget: "DIFFERENCE", answerRationale: `${years[bigStep]}→${years[bigStep + 1]} 상승 ${steps2[bigStep]}만 기준 ${T}를 넘는다(두 해 구간은 함정).`, distractorErrorTypes: pl.types, entityNames: years };
}

export const FAMILY_ORDER: Family[] = ["PAIR_COMPARE", "RATIO_VS_BASELINE", "TARGET_MET", "MAX_CHANGE", "MAX_STEP"];
export function buildAll(count: number): Built[] {
  const out: Built[] = []; const seenKey = new Set<string>(); let seed = 20261020; let tries = 0; let idx = 0;
  while (out.length < count && tries < 20000) {
    tries++; seed += 7;
    const fam = FAMILY_ORDER[out.length % FAMILY_ORDER.length];
    const b = build(fam, seed, idx % 4);
    if (!b) continue;
    const key = `${b.scenario}|${b.family}|${b.entityNames.join(",")}|${JSON.stringify(b.figure)}`;
    // 같은 시나리오·같은 틀이 너무 겹치지 않게: 시나리오×틀 조합은 2회까지만
    const comb = `${b.scenario}|${b.family}`; const used = out.filter((o) => `${o.scenario}|${o.family}` === comb).length;
    if (seenKey.has(key) || used >= 2) continue;
    seenKey.add(key); out.push(b); idx++;
  }
  return out;
}

if (new RegExp("rw-quant-compiler\\.ts$").test(process.argv[1] ?? "")) {
  const arg = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
  const dir = path.resolve(arg("--out") ?? "data/mock-exam-generation/sat-quant-20261020/final");
  const items = buildAll(Number(arg("--count") ?? 36));
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, "built-all.json"), JSON.stringify(items, null, 1));
  const tally: Record<string, number> = {}; for (const b of items) tally[`${b.family}/${b.difficulty}/${b.figureKind}`] = (tally[`${b.family}/${b.difficulty}/${b.figureKind}`] ?? 0) + 1;
  console.log(items.length, tally, "correctIndex", [0, 1, 2, 3].map((i) => items.filter((b) => b.correctIndex === i).length));
}
