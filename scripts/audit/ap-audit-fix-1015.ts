// 외부 AP 전체 검수(2026-10-15, docs/audits/ap-external-audit-20261015-confirmed-fixes.csv) 확정 수정의 "수정본 후보" 생성기(무료·DB 없음).
// 이미 공개된 세트의 문항은 불변이므로 원본 재고 후보를 복제해 고친 새 후보(run=fix1015)를 만들고, 새 버전 초안용 교체안(data/ap/stock/*-audit-1015-swap-plan.json)에서 그 칸을 교체한다.
//   npx tsx scripts/audit/ap-audit-fix-1015.ts [--write]
// 모든 수정은 정확히 한 번만 일치해야 적용된다(조용한 무변경 금지). 게이트: 렌더(gateCandidate)·변환(planConversion)·결정적 MC/FRQ 게이트·생성기 결함 검사.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { gateCandidate } from "../../lib/ap-figures/gate";
import { planConversion } from "../../lib/ap-exam/convert";
import { gateMc, gateFrq, type McPack, type FrqPack } from "../../lib/ap-generation/gates";
import { generatorDefects } from "../../lib/ap-generation/generator-defects";
import { LATEST_GATE } from "../../lib/ap-generation/stock";
import { itemContentHash } from "../../lib/ap-generation/verify-guard";
const curr = (sub: string) => JSON.parse(readFileSync(`data/ap/curriculum-2027/${sub}.json`, "utf-8")) as { skills: { code: string }[]; units: { topics: { code: string }[] }[] };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type J = any;
export const RUN = "fix1015";
export const OUT_ITEMS = "data/ap/stock/supp-fix1015-items.json";
export const OUT_KEYS = "data/ap/stock/supp-fix1015-pass-keys.json";

const STOCK_FILES = ["data/ap/stock/items.json", ...[
  "micro-p2a", "stats-s1", "bio-s2c", "bio-p1b", "bio-v3a", "bio-v2a", "stats-s3a", "stats-s3b", "phys-s3", "chem-p1a2",
].map((n) => `data/ap/stock/${n}-items.json`)];
const rd = (f: string) => JSON.parse(readFileSync(f, "utf-8")) as J[];
const stockByKey = new Map<string, J>();
for (const f of STOCK_FILES) if (existsSync(f)) for (const it of rd(f)) stockByKey.set(it.stockKey, it);

/** 문자열 안의 from 이 정확히 count 번 있어야 to 로 바꾼다. */
export function rep(s: string, from: string, to: string, label: string, count = 1): string {
  const c = s.split(from).length - 1;
  if (c !== count) throw new Error(`${label}: "${from.slice(0, 70)}" occurs ${c} times (need ${count})`);
  return s.split(from).join(to);
}
/** 페이로드 전체(JSON 직렬화)에서 문자열 치환. 해설·난이도 신호·블루프린트에 복제된 같은 문구도 함께 바뀐다. */
function subst(p: J, pairs: [string, string, number?][], label: string): J {
  let s = JSON.stringify(p);
  for (const [from, to, n] of pairs) s = rep(s, JSON.stringify(from).slice(1, -1), JSON.stringify(to).slice(1, -1), label, n ?? 1);
  return JSON.parse(s);
}

export type Fix = { id: string; auditRows: string[]; src: string; newKey: string; note: string; edit: (p: J) => J };

const CHI_HOM_OLD = "$H_0$: school and preferred way to get to school are independent in the population of all students; $df = 6$";
const CHI_HOM_NEW = "$H_0$: the distribution of preferred way to get to school is not the same for all $4$ schools; $df = 6$";
const CHI_HOM_WHY_OLD = "Describes a test of independence, which is for one random sample classified on two variables; here the samples were taken separately from each group.";
const CHI_HOM_WHY_NEW = "States the alternative hypothesis, not the null hypothesis; the null hypothesis of the test says that there is no difference among the schools.";

export const FIXES: Fix[] = [
  {
    id: "AP-002", auditRows: ["AP-002"], src: "micro-p2-a:ap_microeconomics-m32-k0", newKey: "ap_microeconomics-fx01-k0",
    note: "Micro MI2 MC56: marginal cost $26 was only in the stimulus description (not shown to students); state it in the stem.",
    edit: (p) => subst(p, [["The table shows each person's marginal benefit from each unit. What is the efficient quantity of the public good?", "The table shows each person's marginal benefit from each unit. The marginal cost of providing each unit of the public good is $26. What is the efficient quantity of the public good?"]], "AP-002"),
  },
  {
    id: "AP-001", auditRows: ["AP-001"], src: "bio-s2-frq:ap_biology-f21-k0", newKey: "ap_biology-fx02-k0",
    note: "Bio BI2 FRQ5 A/B: fork direction was only in an invisible stimulus field; state it in the title and in part A so the leading-strand template is determined.",
    edit: (p) => {
      const q = subst(p, [
        ["Identify which template strand (top or bottom) is used to make the leading strand.", "The replication fork is moving toward the right side of the diagram. Identify which template strand (top or bottom) is used to make the leading strand."],
        ["Analyzing a model of DNA replication", "Analyzing a model of DNA replication at a fork that moves toward the right side of the diagram"],
      ], "AP-001");
      return q;
    },
  },
  {
    id: "AP-003", auditRows: ["AP-003"], src: "stats-s3-a:ap_statistics-m10-k0", newKey: "ap_statistics-fx03-k0",
    note: "Stats ST1 MC27: homogeneity and independence nulls are equivalent; replace the independence option with a non-equivalent statement (the alternative).",
    edit: (p) => subst(p, [[CHI_HOM_OLD, CHI_HOM_NEW, 3], [CHI_HOM_WHY_OLD, CHI_HOM_WHY_NEW, 2]], "AP-003"),
  },
  {
    id: "AP-004", auditRows: ["AP-004"], src: "stats-s3-a:ap_statistics-m10-k1", newKey: "ap_statistics-fx04-k0",
    note: "Stats ST2 MC23 (same archetype as AP-003, other seed): same non-equivalent replacement.",
    edit: (p) => subst(p, [[CHI_HOM_OLD, CHI_HOM_NEW, 3], [CHI_HOM_WHY_OLD, CHI_HOM_WHY_NEW, 2]], "AP-004"),
  },
  {
    id: "AP-004b", auditRows: ["AP-004"], src: "stats-s3b-d:ap_statistics-m05-k0", newKey: "ap_statistics-fx05-k0",
    note: "Stats ST2 (sibling of AP-004, independence design): the homogeneity option is equivalent to the key; replace it with the alternative hypothesis.",
    edit: (p) => subst(p, [
      ["$H_0$: the distribution of preferred way to read the news is the same for all $3$ age groups in the population of adult residents of a county; $df = 6$", "$H_0$: age group and preferred way to read the news are associated in the population of adult residents of a county; $df = 6$", 3],
      ["Describes a test of homogeneity, which is for separate samples from several populations; here one sample was classified on both variables.", "States the alternative hypothesis, not the null hypothesis; the null hypothesis of a test of independence says that there is no association between the variables.", 2],
    ], "AP-004b"),
  },
  {
    id: "AP-006", auditRows: ["AP-006"], src: "bio-p1-b:ap_biology-f02-k0", newKey: "ap_biology-fx06-k0",
    note: "Bio BI1 FRQ2 D: more ions -> solute potential is lower (more negative), not greater; also complete the truncated title.",
    edit: (p) => subst(p, [
      ["so the solute concentration (and so the solute potential, Ψ_S = -iCRT with i = 2) is greater and the water potential of the solution is lower.", "so the solute concentration is greater, which makes the solute potential (Ψ_S = -iCRT with i = 2) lower (more negative) and the water potential of the solution lower.", 2],
      ["Results with graphing: A student places potato cores of equal i", "A student places potato cores of equal initial mass in sucrose solutions of different molarity for 24 hours and measures the percent change in mass of the cores"],
    ], "AP-006"),
  },
  {
    id: "AP-008", auditRows: ["AP-008"], src: "bio-v3a:ap_biology-f06-k0", newKey: "ap_biology-fx08-k0",
    note: "Bio BI1 FRQ3 C/D: state that the UV doses are nonlethal (most cells survive) and accept a conditional prediction.",
    edit: (p) => subst(p, [
      ["Colonies that grow on the plates come from cells that became resistant to the antibiotic.", "The UV doses are low enough that most of the exposed cells survive. Colonies that grow on the plates come from cells that became resistant to the antibiotic."],
      ["The number of colonies will increase as the exposure to UV light increases.", "Because the UV doses are low enough that most cells survive, the number of colonies will increase as the exposure to UV light increases.", 2],
      ["longer exposure will produce more colonies", "longer exposure will produce more colonies, provided that most cells survive the exposure"],
    ], "AP-008"),
  },
  {
    id: "AP-010", auditRows: ["AP-010"], src: "bio-v3a:ap_biology-f04-k0", newKey: "ap_biology-fx10-k0",
    note: "Bio BI2 FRQ2: the title was cut mid-sentence and the context never reached the student; make the title the complete setup.",
    edit: (p) => subst(p, [["Results with graphing: In an isolated population of insects, an", "In an isolated population of insects, an allele that provides resistance to a pesticide is rare at the start. The pesticide is applied every generation, and a researcher determines the frequency of the resistance allele in the population"]], "AP-010"),
  },
  {
    id: "AP-012", auditRows: ["AP-012"], src: "bio-v2a:ap_biology-m31-k2", newKey: "ap_biology-fx12-k0",
    note: "Bio BI2 population set q3: the table still changes from 798 to 800, so the size does not stop changing; say it changes very little.",
    edit: (p) => subst(p, [["The population size stops changing at the end of the table.", "The population size changes very little at the end of the table."]], "AP-012"),
  },
  {
    id: "AP-027", auditRows: ["AP-027"], src: "chem-p1-a2:ap_chemistry-m18-k0", newKey: "ap_chemistry-fx27-k0",
    note: "Chem CH1 MC39 = CH2 MC38 (same calorimetry-error stem and options). Keep CH1's item; CH2 gets the reversed task: which error makes the calculated magnitude HIGHER (key = water mass recorded too high; the other three errors lower it).",
    edit: (p) => {
      const q = JSON.parse(JSON.stringify(p));
      const o = (text: string, why: string) => ({ text, why, value: null });
      const opts = [
        o("The salt is recorded as 5.50 g but 5.00 g is actually dissolved.", "Recording 5.50 g when only 5.00 g dissolved makes the calculated moles of salt larger, so the heat per mole, and the magnitude of ΔH, is too low."),
        o("Some heat escapes through the cup walls, so the highest temperature reached is lower than expected.", "Heat escaping lowers the highest temperature reached, so ΔT and the calculated heat are smaller, and the calculated magnitude of ΔH is too low."),
        o("The thermometer reads the initial temperature 1.0 degC too high.", "An initial temperature read 1.0 °C too high makes ΔT smaller than the true change, so the calculated heat and the magnitude of ΔH are too low."),
        o("The recorded water mass is 110 g but the actual mass is 100 g.", "Recording 110 g of water when only 100 g is present makes the calculated heat q = mcΔT larger, so the calculated magnitude of ΔH is too high."),
      ];
      q.stem = rep(q.stem, "to be lower than the true value?", "to be higher than the true value?", "AP-027 stem");
      q.options = opts; q.key_index = 3;
      q.facts = ["base={'ms': 5.0, 'mw': 100.0, 'Ti': 22.0, 'Tf': 27.0}", "key=water_mass_high"];
      q.blueprint.misconceptions = opts.slice(0, 3).map((x, i) => ({ id: `m${i + 1}`, description: x.why }));
      q.pack_id = "ch_calorimetry_error-s7500-fx27"; q.seed = 7501;
      const key = opts[3];
      q.explanation_en = [`The correct answer is ${key.text}. ${key.why}`, ...opts.slice(0, 3).map((x) => `${x.text} is incorrect: ${x.why}`)].join("\n");
      return q;
    },
  },
  {
    id: "AP-058", auditRows: ["AP-058"], src: "phys-s3-a:ap_physics_1-m24-k0", newKey: "ap_physics_1-fx58-k0",
    note: "Physics PH3 MC26: displayed speeds 0.133/0.433 give p=0.999 and K=0.196 J (option said 0.197); use exact speeds 0.2/0.4 m/s (p = 1 kg m/s, K = 0.18 J).",
    edit: (p) => subst(p, [
      ["cart A moves at $0.133\\text{ m/s}$ and cart B moves at $0.433\\text{ m/s}$", "cart A moves at $0.2\\text{ m/s}$ and cart B moves at $0.4\\text{ m/s}$"],
      ["$0.197\\text{ J}$", "$0.18\\text{ J}$", 4],
      ["u1=0.13333333333333333", "u1=0.2"], ["u2=0.43333333333333335", "u2=0.4"], ["K1=0.19666666666666668", "K1=0.18"],
    ], "AP-058"),
  },
  {
    id: "AP-067", auditRows: ["AP-067"], src: "stats-s1-h-final:ap_statistics-m03-k0", newKey: "ap_statistics-fx67-k0",
    note: "Stats ST1 MC21: n=200 cannot give p-hat 0.459 (91.8 people). Use 92/200 = 0.46: z=1.732, upper-tail P = 0.0416 ~ 0.042.",
    edit: (p) => {
      let q = subst(p, [["$0.459$", "$0.46$", 9], ["$0.044$", "$0.042$", 9]], "AP-067");
      q = subst(q, [["ph=0.459", "ph=0.46"], ["P=0.0443", "P=0.0416"]], "AP-067-facts");
      const c = q.stimulus.data.curve;
      if (c.shades?.[0]?.from !== 0.459 || c.marks?.[0]?.at !== 0.459) throw new Error("AP-067: unexpected curve shade");
      c.shades[0].from = 0.46; c.marks[0].at = 0.46; c.marks[0].label = "0.46";
      return q;
    },
  },
];

export function buildRecord(f: Fix): J {
  const src = stockByKey.get(f.src);
  if (!src) throw new Error(`source ${f.src} not found`);
  const rec = JSON.parse(JSON.stringify(src)) as J;
  rec.payload = f.edit(rec.payload);
  rec.candidateKey = f.newKey; rec.cellId = f.newKey.replace(/-k\d+$/, "");
  rec.run = RUN; rec.stockKey = `${RUN}:${f.newKey}`;
  rec.gateVersion = LATEST_GATE; rec.validation = "auto_passed"; rec.reviewState = "auto_passed"; rec.rejectionReason = null;
  rec.releaseTier = "candidate"; rec.renderVerified = false; rec.screenVerified = false; rec.reviewEnvReady = false;
  rec.selectedForSample = false; rec.reserve = false; rec.legacyReserve = true;
  rec.canonicalKey = null; rec.duplicateOf = null; rec.duplicateReason = null; rec.sharedWith = [];
  rec.history = [...(src.history ?? []), { run: RUN, gateVersion: LATEST_GATE, outcome: "passed", reasons: `external audit 2026-10-15 ${f.auditRows.join("+")}: corrected copy of ${f.src}` }];
  rec.fixOf = f.src; rec.auditRows = f.auditRows;
  return rec;
}

export function runGates(rec: J): { render: string; conv: string; det: string[]; defects: string[] } {
  const g = gateCandidate(rec);
  const conv = planConversion(rec);
  const det: string[] = [];
  const p = rec.payload;
  const cur = curr(rec.apSubjectCode);
  const skills = new Set(cur.skills.map((x) => x.code)); const topics = new Set(cur.units.flatMap((u) => u.topics.map((t) => t.code)));
  try {
    if (rec.kind === "mc") {
      if (Array.isArray(p.items)) for (const it of p.items) det.push(...gateMc(rec.apSubjectCode, { ...p, ...it, stimulus: p.stimulus } as McPack));
      else det.push(...gateMc(rec.apSubjectCode, p as McPack));
    } else det.push(...gateFrq(rec.apSubjectCode, p as FrqPack, skills, { topics }));
  } catch (e) { det.push(`gate_threw:${(e as Error).message}`); }
  return { render: `${g.status}${g.issues.filter((i) => i.level === "error").map((i) => `:${i.code}`).join("")}`, conv: conv.ok ? "ok" : `FAIL ${conv.reason}`, det, defects: generatorDefects(p).map((d) => `${d.code}@${d.where}`) };
}

if (new RegExp("ap-audit-fix-1015\\.ts$").test(process.argv[1] ?? "")) {
  const write = process.argv.includes("--write");
  const recs: J[] = [];
  for (const f of FIXES) {
    const rec = buildRecord(f);
    const r = runGates(rec); const b = runGates(stockByKey.get(f.src)!);
    const newDet = r.det.filter((x) => !b.det.includes(x));
    console.log(`${f.id} ${rec.stockKey} <- ${f.src}\n   render=${r.render} conv=${r.conv}\n   det=${JSON.stringify(r.det)} (new vs source: ${JSON.stringify(newDet)}) defects=${JSON.stringify(r.defects)}`);
    if (newDet.length || r.defects.length || !r.render.startsWith("pass") && !r.render.startsWith("not_applicable") || r.conv !== "ok") process.exitCode = 1;
    recs.push(rec);
  }
  if (write && process.exitCode !== 1) {
    writeFileSync(OUT_ITEMS, JSON.stringify(recs)); console.log(`wrote ${OUT_ITEMS} (${recs.length})`);
    writeFileSync(OUT_KEYS, "[\n" + recs.map((r) => JSON.stringify(r.stockKey)).join(",\n") + "\n]\n");
    // 이 배치만의 렌더 보고(render-check.ts 전체 재생성 없이 mark-verified --render --report 로 쓸 수 있는 같은 행 형식).
    const rows = recs.map((r) => { const g = gateCandidate(r); return { key: r.stockKey, contentHash: itemContentHash(r.payload), subject: g.subject, kind: g.kind, validation: r.validation, stimKind: g.stimKind, renderType: g.renderType, need: g.need, needReason: g.needReason, status: g.status, issues: g.issues.filter((i) => i.level !== "info"), alt: g.alt }; });
    writeFileSync("data/ap/render-check/report-fix1015.json", JSON.stringify({ generatedAt: new Date().toISOString(), universe: OUT_ITEMS, all: { total: rows.length, pass: rows.filter((x) => x.status === "pass").length, fail: rows.filter((x) => x.status === "fail").length, notApplicable: rows.filter((x) => x.status === "not_applicable").length }, results: rows }, null, 1));
  }
}
