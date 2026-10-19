// 외부 AP 검수(2026-10-15) "유형 단위" 수정의 공개 문항 교체 후보 생성기(무료·DB 없음).
// 원형 코드(scripts/ap-generation/archetypes/*.py)를 고쳐도 이미 저장된 문항은 바뀌지 않으므로(원형 수정은 기존 문항을 바꾸지 않는다), 같은 결함 유형의 *공개* 문항은 복제본을 고쳐 새 키(run=fix1019)로 만들고
// 새 버전 교체안(data/ap/stock/*-audit-1019-swap-plan.json)으로 칸을 바꾼다. 어떤 문항이 대상인지는 scripts/audit/ap-type-defect-scan.py(data/audit/ap-type-defect-scan-20261019.json)가 정한다.
//   npx tsx scripts/audit/ap-audit-typefix-1019.ts [--write]           후보 생성(+게이트) → supp-fix1019-items.json
//   npx tsx scripts/audit/ap-audit-typefix-1019.ts --plans [--write]   교체안 생성(+독립 검증기, 후보 파일이 이미 있어야 풀에 보인다)
// 모든 수정은 정확히 한 번만 일치해야 적용된다(조용한 무변경 금지).
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { gateCandidate } from "../../lib/ap-figures/gate";
import { LATEST_GATE } from "../../lib/ap-generation/stock";
import { itemContentHash } from "../../lib/ap-generation/verify-guard";
import { runGates } from "./ap-audit-fix-1015";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type J = any;
export const RUN = "fix1019";
export const OUT_ITEMS = "data/ap/stock/supp-fix1019-items.json";
export const OUT_KEYS = "data/ap/stock/supp-fix1019-pass-keys.json";
const D = "data/ap/stock/";

let _pool: Map<string, J> | null = null;
export function stockPool(): Map<string, J> {
  if (_pool) return _pool;
  _pool = new Map();
  for (const f of readdirSync(D).filter((x) => /items\.json$/.test(x) && x !== "supp-fix1019-items.json").sort()) {
    let d: J; try { d = JSON.parse(readFileSync(D + f, "utf-8")); } catch { continue; }
    if (Array.isArray(d)) for (const r of d) if (r && r.stockKey && !_pool.has(r.stockKey)) _pool.set(r.stockKey, r);
  }
  return _pool;
}

export function rep(s: string, from: string, to: string, label: string, count = 1): string {
  const c = s.split(from).length - 1;
  if (c !== count) throw new Error(`${label}: "${from.slice(0, 70)}" occurs ${c} times (need ${count})`);
  return s.split(from).join(to);
}
/** 페이로드 전체(JSON 직렬화)에서 문자열 치환. 해설·난이도 신호·블루프린트에 복제된 같은 문구도 함께 바뀐다. */
export function subst(p: J, pairs: [string, string, number?][], label: string): J {
  let s = JSON.stringify(p);
  for (const [from, to, n] of pairs) s = rep(s, JSON.stringify(from).slice(1, -1), JSON.stringify(to).slice(1, -1), label, n ?? 1);
  return JSON.parse(s);
}
/** frq_visible.py setup_title 과 같은 규칙: 완전한 문장 그대로, 끝의 마침표·세미콜론만 뗀다. */
export const setupTitle = (t: string) => t.split(/\s+/).filter(Boolean).join(" ").replace(/[ .;]+$/, "");

/** 표·도식 설명(실험 소개·주어진 값)이 학생에게 안 보이는 서술형: 제목을 설명 전체(완전한 문장)로 바꾼다(원형 안전망 frq_visible.ensure_setup_visible 과 같은 결과). */
const titleFromDescription = (label: string) => (p: J): J => {
  const d = String(p.stimulus?.description ?? "");
  if (!d.trim()) throw new Error(`${label}: no description`);
  const q = JSON.parse(JSON.stringify(p)); q.title = setupTitle(d);
  if (q.title === p.title) throw new Error(`${label}: title unchanged`);
  return q;
};

/** 증가 = 이계도함수 > 0 로 쓴 오목성 이유(꺾임에서 f'' 미정의): 외부 검수 AP-014/020/023/025 와 같은 정정. */
const concavityReason = (label: string) => (p: J): J => {
  const s0 = JSON.stringify(p); const from = "Reason: f' is increasing (so f'' > 0) on those intervals";
  const n = s0.split(from).length - 1; if (n < 1 || n > 2) throw new Error(`${label}: criterion occurs ${n} times`); // 2번째는 블루프린트 복제
  let s1 = s0.split(from).join("Reason: f' is increasing on those intervals");
  const el = `,"f'' is positive"`; if (s1.split(el).length - 1 !== n) throw new Error(`${label}: required element count mismatch`);
  s1 = s1.split(el).join("");
  const q = JSON.parse(s1);
  if (JSON.stringify(q).includes("f'' is positive")) throw new Error(`${label}: f'' is positive still present`);
  return q;
};

export type Fix = { id: string; type: string; src: string; newKey: string; note: string; edit: (p: J) => J };
export const FIXES: Fix[] = [
  { id: "T-BI2-F1", type: "b_setup_hidden", src: "bio-s2-frq:ap_biology-f01-k0", newKey: "ap_biology-tf01-k0", note: "Bio BI2 FRQ1 (bif_q1_growthfactor): experiment setup only in the invisible stimulus description; make the title the full setup.", edit: titleFromDescription("T-BI2-F1") },
  { id: "T-BI1-F1", type: "b_setup_hidden", src: "bio-v3a:ap_biology-f01-k0", newKey: "ap_biology-tf02-k0", note: "Bio BI1 FRQ1 (bif_q1_fliesselection): same.", edit: titleFromDescription("T-BI1-F1") },
  { id: "T-BI1-F6", type: "b_setup_hidden", src: "bio-s2-frq:ap_biology-f24-k0", newKey: "ap_biology-tf03-k0", note: "Bio BI1 FRQ6 (bif_q6_mitotic): table caption with n=6 only in the invisible description.", edit: titleFromDescription("T-BI1-F6") },
  { id: "T-BI2-F6", type: "b_setup_hidden", src: "bio-v3c:ap_biology-f02-k0", newKey: "ap_biology-tf04-k0", note: "Bio BI2 FRQ6 (bif_q6_agemeiosis): table caption with n=10 only in the invisible description.", edit: titleFromDescription("T-BI2-F6") },
  { id: "T-CH1-F3", type: "b_setup_hidden", src: "chem-s2-f4:ap_chemistry-f03-k0", newKey: "ap_chemistry-tf05-k0", note: "Chem CH1 FRQ3 (chf_long_kinetics): temperature 310 K only in the invisible description.", edit: titleFromDescription("T-CH1-F3") },
  { id: "T-CH2-F3", type: "b_setup_hidden", src: "chem-s2-f2:ap_chemistry-f03-k0", newKey: "ap_chemistry-tf06-k0", note: "Chem CH2 FRQ3 (chf_long_kinetics): same.", edit: titleFromDescription("T-CH2-F3") },
  { id: "T-MI1-F3", type: "c_required_info_hidden", src: "micro-p1-b:ap_microeconomics-f05-k0", newKey: "ap_microeconomics-tf07-k0", note: "Micro MI1 FRQ3 (mif_short_labor): output price $3 and wage $55 (needed for MRP and the hiring rule) only in the invisible description.", edit: titleFromDescription("T-MI1-F3") },
  { id: "T-ST1-F2", type: "b_setup_hidden", src: "stats-s2b-c:ap_statistics-f02-k0", newKey: "ap_statistics-tf08-k0", note: "Stats ST1 FRQ2 (stfrq_q2_regression): the sample size (18 observations) only in the invisible description.", edit: titleFromDescription("T-ST1-F2") },
  { id: "T-ST2-F2", type: "b_setup_hidden", src: "stats-s3b-c:ap_statistics-f02-k0", newKey: "ap_statistics-tf09-k0", note: "Stats ST2 FRQ2 (stfrq_q2_regression): same (16 observations).", edit: titleFromDescription("T-ST2-F2") },
  { id: "T-AB2-FB2", type: "d_calc_concavity_reference", src: "run2:ap_calculus_ab-f02-k3", newKey: "ap_calculus_ab-tf11-k0", note: "Calc AB2 FRQ-B (frq_fprime_graph): same concavity-reason fix.", edit: concavityReason("T-AB2-FB2") },
  { id: "T-AB3-FB2", type: "d_calc_concavity_reference", src: "run2:ap_calculus_ab-f02-k2", newKey: "ap_calculus_ab-tf12-k0", note: "Calc AB3 FRQ-B (frq_fprime_graph): same concavity-reason fix.", edit: concavityReason("T-AB3-FB2") },
];

export function buildRecord(f: Fix): J {
  const src = stockPool().get(f.src);
  if (!src) throw new Error(`source ${f.src} not found`);
  const rec = JSON.parse(JSON.stringify(src)) as J;
  rec.payload = f.edit(rec.payload);
  rec.candidateKey = f.newKey; rec.cellId = f.newKey.replace(/-k\d+$/, "");
  rec.run = RUN; rec.stockKey = `${RUN}:${f.newKey}`;
  rec.gateVersion = LATEST_GATE; rec.validation = "auto_passed"; rec.reviewState = "auto_passed"; rec.rejectionReason = null;
  rec.releaseTier = "candidate"; rec.renderVerified = false; rec.screenVerified = false; rec.reviewEnvReady = false;
  rec.selectedForSample = false; rec.reserve = false; rec.legacyReserve = true;
  rec.canonicalKey = null; rec.duplicateOf = null; rec.duplicateReason = null; rec.sharedWith = [];
  rec.history = [...(src.history ?? []), { run: RUN, gateVersion: LATEST_GATE, outcome: "passed", reasons: `external audit 2026-10-15 type-level fix (${f.type}): corrected copy of ${f.src}` }];
  rec.fixOf = f.src; rec.typeFix = f.type;
  return rec;
}

if (new RegExp("ap-audit-typefix-1019\\.ts$").test(process.argv[1] ?? "") && !process.argv.includes("--plans")) {
  const write = process.argv.includes("--write");
  const recs: J[] = [];
  for (const f of FIXES) {
    const rec = buildRecord(f);
    const r = runGates(rec); const b = runGates(stockPool().get(f.src)!);
    const newDet = r.det.filter((x) => !b.det.includes(x));
    console.log(`${f.id} ${rec.stockKey} <- ${f.src}\n   render=${r.render} conv=${r.conv}\n   det=${JSON.stringify(r.det)} (new vs source: ${JSON.stringify(newDet)}) defects=${JSON.stringify(r.defects)}`);
    if (newDet.length || r.defects.length || (!r.render.startsWith("pass") && !r.render.startsWith("not_applicable")) || r.conv !== "ok") process.exitCode = 1;
    recs.push(rec);
  }
  if (write && process.exitCode !== 1) {
    writeFileSync(OUT_ITEMS, JSON.stringify(recs)); console.log(`wrote ${OUT_ITEMS} (${recs.length})`);
    writeFileSync(OUT_KEYS, "[\n" + recs.map((r) => JSON.stringify(r.stockKey)).join(",\n") + "\n]\n");
    const rows = recs.map((r) => { const g = gateCandidate(r); return { key: r.stockKey, contentHash: itemContentHash(r.payload), subject: g.subject, kind: g.kind, validation: r.validation, stimKind: g.stimKind, renderType: g.renderType, need: g.need, needReason: g.needReason, status: g.status, issues: g.issues.filter((i) => i.level !== "info"), alt: g.alt }; });
    writeFileSync("data/ap/render-check/report-fix1019.json", JSON.stringify({ generatedAt: new Date().toISOString(), universe: OUT_ITEMS, all: { total: rows.length, pass: rows.filter((x) => x.status === "pass").length, fail: rows.filter((x) => x.status === "fail").length, notApplicable: rows.filter((x) => x.status === "not_applicable").length }, results: rows }, null, 1));
  }
}
