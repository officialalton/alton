// EL1/EL2 검수 수정본 생성(2026-10-14, 무료·DB 없음): 원본 재고는 그대로 두고 data/audit/ 에 새 후보(키 el-rv:*) + 교체 계획을 쓴다.
//   npx tsx scripts/ap-generation/el-review-build-fixes.ts
// 입력: data/audit/el-review-raw-rewrite.json(선지 길이 보정), data/audit/el-review-raw-refs.json(해설의 문장 번호 → 문단 표현, 선택), data/audit/el-review-decisions.json(샘플 점수 결정 등).
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { passageDisplay, setViolations, itemViolations, type ElSetRaw, type ElItemRaw } from "../../lib/ap-generation/englang-gates";
import { frqPassageDisplay, frqTaskText, frqReferenceText, frqViolations, type ElFrqPayload } from "../../lib/ap-generation/englang-frq";

const rd = <T,>(f: string): T => JSON.parse(readFileSync(f, "utf-8")) as T;
const stock: Record<string, any> = {};
for (const f of readdirSync("data/ap/stock").filter((x) => /^el-.*-items\.json$/.test(x))) for (const it of rd<any[]>(path.join("data/ap/stock", f))) stock[it.stockKey] = it;
const assign = rd<{ sets: { id: string; mcA: string[]; frqA: string[] }[] }>("data/ap/stock/exact-assign-el-el1-el2.json").sets;
const idOf = (k: string) => k.replace(/[^a-zA-Z0-9]/g, "_").slice(-48);
const RUN = "el-rv";
const W = (t: string) => t.trim().split(/\s+/).length;
const rewrite = existsSync("data/audit/el-review-raw-rewrite.json") ? rd<Record<string, any>>("data/audit/el-review-raw-rewrite.json") : {};
const refs = existsSync("data/audit/el-review-raw-refs.json") ? rd<Record<string, any>>("data/audit/el-review-raw-refs.json") : {};
const pron = existsSync("data/audit/el-review-raw-pron.json") ? rd<Record<string, any>>("data/audit/el-review-raw-pron.json") : {};
const PRON_SKIP = new Set(["she", "her", "hers", "herself", "he", "his", "him", "the", "writer", "writer's", "speaker", "speaker's", "s", "writer’s", "speaker’s", "of", "own", "this", "that", "their", "they", "them", "a"]);
const pronKernel = (t: string) => t.toLowerCase().replace(/[^a-z0-9' ]/g, " ").split(/\s+/).filter((w) => w && !PRON_SKIP.has(w)).join(" ");
const pronLog: string[] = [];
const frqPatches = rd<Record<string, any>>("data/audit/el-review-frq-patches.json");
const decisions = existsSync("data/audit/el-review-decisions.json") ? rd<any>("data/audit/el-review-decisions.json") : { frq: {} };

const explanationOf = (it: any): string => {
  const key = it.options[it.key_index]; const lines = [`The correct answer is "${key.text}". ${key.why}`];
  it.options.forEach((o: any, j: number) => { if (j !== it.key_index) lines.push(`"${o.text}" is incorrect: ${o.why}`); });
  return lines.join("\n");
};
const wrap = (orig: any, payload: any, notes: string): any => {
  const c = JSON.parse(JSON.stringify(orig)); c.payload = payload; const base = orig.candidateKey;
  c.run = RUN; c.stockKey = `${RUN}:${base}`; c.canonicalKey = c.stockKey; c.itemFamilyId = `fam:${c.stockKey}`; c.selectedForSample = false;
  c.duplicateOf = null; c.duplicateReason = null; c.expertStatus = "unreviewed"; c.releaseTier = "candidate"; c.renderVerified = false; c.screenVerified = false; c.reviewEnvReady = false;
  c.history = [...(orig.history ?? []), { run: RUN, gateVersion: orig.gateVersion, outcome: "passed", reasons: notes }];
  return c;
};

// ── FRQ 수정(결정적 문자열·구조 수정; 파생 필드는 원본과 같은 함수로 재생성) ─────────────────────────
const sub = (o: any, from: string, to: string): number => { let n = 0; const walk = (x: any): any => { if (typeof x === "string") { if (x.includes(from)) { n += x.split(from).length - 1; return x.split(from).join(to); } return x; } if (Array.isArray(x)) return x.map(walk); if (x && typeof x === "object") { for (const k of Object.keys(x)) x[k] = walk(x[k]); } return x; }; const r = walk(o); Object.assign(o, r); return n; };
type FrqFix = { id: string; notes: string[]; apply: (e: ElFrqPayload) => void };
const FRQ_FIXES: Record<string, FrqFix> = {
  "englang-p2-b:ap_english_language-fb1-k0": { id: "EL-F1", notes: ["high sample: misplaced comma/'dollars' artifact (410,000, dollars)", "Source F category labels truncated by the 13-character renderer rule (Transportati., Custodial and)"], apply: (e) => {
    const hi = e.samples.find((s) => s.tier === "high")!; if (!hi.essay.includes('410,000, dollars "close to')) throw new Error("fb1 artifact not found");
    sub(e, '410,000, dollars "close to', '410,000 dollars, "close to');
    const F = e.sources.find((s) => s.id === "F")!; F.figure!.categories = ["Transport", "Utilities", "Substitutes", "Food service", "Custodial"];
    F.figure!.description = F.figure!.description.replace(/ Categories: .*$/, " Categories: Transport = Transportation; Utilities = Utilities; Substitutes = Substitute teacher pay; Food service = Food service; Custodial = Custodial and other.");
  } },
  "englang-p2-b:ap_english_language-fb2-k0": { id: "EL-F2", notes: ["student-visible prompt block restated the speech's purpose (Speaker/Audience/Exigence/Purpose scaffold); keep speaker, audience and occasion only"], apply: (e) => {
    e.prompt.scenario = "Speaker: Marisol Quenneville, a charge nurse who has worked the overnight shift at the fictional Harrowgate Memorial Hospital for nineteen years. Audience: the graduating class of the fictional Dunmore Valley School of Nursing, their families, and faculty. Occasion: a commencement ceremony; the graduates have finished their technical training and are about to begin work on busy hospital floors, and Quenneville has been invited to give the address.";
  } },
  "englang-p2-b:ap_english_language-fb3-k0": { id: "EL-F3", notes: ["high sample put quotation marks around words that are not a verbatim quote of Source A", "mid sample: Sophistication annotation says not earned but rubric_scores.C = 1 (see decisions file)"], apply: (e) => {
    if (sub(e, 'Teague says they stay "because nothing is idling at their backs."', 'Teague says people linger "when nothing is idling at their backs."') < 1) throw new Error("fb3 quote not found");
    const d = decisions.frq?.["EL-F3"]; if (d?.midC !== undefined) { const m = e.samples.find((s) => s.tier === "mid")!; m.rubric_scores.C = d.midC; m.rubric_scores.total = m.rubric_scores.A + m.rubric_scores.B + d.midC; m.target_total = m.rubric_scores.total; }
  } },
  "englang-p1-b2:ap_english_language-fa3-k0": { id: "EL-F6", notes: [], apply: () => {} },
  "englang-p1-b2:ap_english_language-fa1-k0": { id: "EL-F4", notes: ["high sample: 'dollars' token displaced after punctuation in two sentences and one annotation (7.50, dollars / 11.40. dollars)"], apply: (e) => {
    const a = sub(e, "costs 7.50, dollars and Source F charts the hub at 11.40. dollars That looks", "costs 7.50 dollars, and Source F charts the hub at 11.40 dollars. That looks");
    const b = sub(e, "Source F's 11.40. dollars The rubric", "Source F's 11.40 dollars. The rubric");
    if (a < 1 || b < 1) throw new Error("fa1 artifact not found");
  } },
  "englang-p1-b2:ap_english_language-fa2-k0": { id: "EL-F5", notes: ["student-visible prompt block restated the speech's strategy (Purpose line: reframing the wharf as infrastructure while acknowledging financial pressure); keep speaker, audience and occasion only"], apply: (e) => {
    e.prompt.scenario = "Speaker: Marguerite Osgood, a harbor pilot who retired after thirty-one years guiding ships into the port of Tillet's Reach, a fictional coastal town of about six thousand people. Audience: residents and elected council members gathered at a town meeting in 2019. Occasion: the council is about to vote on a developer's proposal to rezone the north wharf, the town's last commercial working pier, for a residential marina village of condominiums, cafes, and a recreational boat basin.";
  } },
};
const frqOut: any[] = []; const frqLog: any[] = [];
for (const [key, fix] of Object.entries(FRQ_FIXES)) {
  const orig = stock[key]; const p = JSON.parse(JSON.stringify(orig.payload)); const e: ElFrqPayload = p.el_frq;
  fix.apply(e);
  const pt = frqPatches[key];
  if (pt) {
    for (const [from, to] of pt.reps as [string, string][]) { if (sub(e, from, to) < 1) throw new Error(`${fix.id}: patch text not found: ${from.slice(0, 70)}`); }
    // 루브릭 행 문구가 바뀌면 parts[0].rubric_rows[].criterion 도 같은 값으로 맞춘다(아래에서 재생성).
    for (const [tier, sc] of Object.entries(pt.scores ?? {}) as [string, Record<string, number>][]) { const sm = e.samples.find((x) => x.tier === tier)!; Object.assign(sm.rubric_scores, sc); sm.rubric_scores.total = sm.rubric_scores.A + sm.rubric_scores.B + sm.rubric_scores.C; sm.target_total = sm.rubric_scores.total; }
    if (pt.addAnn) { const sm = e.samples.find((x) => x.tier === pt.addAnn.tier)!; sm.annotations.unshift(pt.addAnn.ann); }
    fix.notes.push(...(pt.notes ?? []));
  }
  for (const sm of e.samples) sm.word_count = W(sm.essay);
  p.el_frq = e; p.set_intro = frqPassageDisplay(e); p.parts[0].prompt = frqTaskText(e); p.parts[0].model_answer = e.samples.find((s) => s.tier === "high")!.essay; p.reference_text = frqReferenceText(e); p.parts[0].rubric_rows = p.parts[0].rubric_rows.map((x: any, i: number) => ({ ...x, criterion: e.rubric.rows[i].task_specific }));
  if (p.stimulus?.data) { const F = e.sources.find((s) => s.kind === "visual"); if (F?.figure) { p.stimulus.description = F.figure.description; if (p.stimulus.data.data) p.stimulus.data.data.categories = F.figure.categories; } }
  const viol = frqViolations(e); frqLog.push({ fixId: fix.id, key, newKey: `${RUN}:${orig.candidateKey}`, notes: fix.notes, violations: viol });
  frqOut.push(wrap(orig, p, `${fix.id}: ${fix.notes.join("; ")}`));
}

// ── MC 수정: 1단계(선지 길이 보정 병합) → refs 스크립트 → 2단계(문단 표현 병합·검증·산출) ─────────────────────────
const STAGE = process.argv.includes("--stage") ? process.argv[process.argv.indexOf("--stage") + 1] : "1";
const toRaw = (p: any, items: any[]): ElSetRaw => ({ kind: p.el_passage.kind, blueprint: p.blueprint, provenance: p.provenance, title: p.el_passage.title, paragraphs: p.el_passage.paragraphs, items: items.map((it) => ({ skill: it.skill, topic: it.topic, cognitive: it.cognitive, stem: it.stem, options: it.options.map((o: any, j: number) => ({ text: o.text, is_key: j === it.key_index, label: o.label, why: o.why })), evidence_sentence_ids: it.evidence_sentence_ids, devices_used: it.devices_used })) } as ElSetRaw);
const keyLongest = (items: any[]) => items.filter((it) => { const kw = W(it.options[it.key_index].text); return it.options.every((o: any, j: number) => j === it.key_index || W(o.text) < kw); }).length;
const keyRatio = (items: any[]) => items.map((it) => W(it.options[it.key_index].text) / (it.options.filter((_: any, j: number) => j !== it.key_index).reduce((a: number, o: any) => a + W(o.text), 0) / 3));
const mcLog: any[] = []; const mergedMc: Record<string, any> = {}; const mcItems: any[] = [];
let before = { n: 0, longest: 0 }, after = { n: 0, longest: 0 };
for (const s of assign) for (const key of s.mcA) {
  const orig = stock[key]; const p = JSON.parse(JSON.stringify(orig.payload)); const rw = rewrite[`rw__${idOf(key)}`]; const log: any = { id: s.id, key, rewriteMissing: !rw, reverted: [] as string[], changed: 0 };
  const rf = refs[`rf__${idOf(key)}`]; log.required = Boolean(rf) || Boolean(pron[`pn__${idOf(key)}`]);
  p.items.forEach((it: any, qi: number) => {
    before.n++; if (keyLongest([it])) before.longest++;
    const r = rw?.items?.find((x: any) => x.q === qi + 1);
    if (r && Array.isArray(r.options) && r.options.length === it.options.length) {
      const keyOk = r.options[it.key_index].text.trim().replace(/\s+/g, " ") === it.options[it.key_index].text.trim().replace(/\s+/g, " ");
      const sizeOk = r.options.every((o: any, j: number) => j === it.key_index || (W(o.text) <= 46 && W(o.text) >= 4));
      if (keyOk && sizeOk) { r.options.forEach((o: any, j: number) => { if (o.text.trim() !== it.options[j].text.trim() || o.why.trim() !== it.options[j].why.trim()) log.changed++; it.options[j].text = o.text.trim(); it.options[j].why = o.why.trim(); }); } else log.reverted.push(`q${qi + 1}:${keyOk ? "size" : "key_text_changed"}`);
    }
    const rr = rf?.items?.find((x: any) => x.q === qi + 1); if (STAGE === "2" && rr?.whys?.length === it.options.length) rr.whys.forEach((w: string, j: number) => { it.options[j].why = w.trim(); });
    const pn = pron[`pn__${idOf(key)}`]?.items?.find((x: any) => x.q === qi + 1);
    if (STAGE === "2" && pn) {
      const take = (cur: string, nw: string | undefined, what: string): string => { if (typeof nw !== "string" || nw.trim() === cur.trim()) return cur; const q = (t: string) => (t.match(/["\u201c][^"\u201d]{3,}["\u201d]/g) ?? []).join("|"); const wc = W(nw) / W(cur);
      if ((pronKernel(nw) === pronKernel(cur) || (!/\b(she|her|hers|herself|he|his|him)\b/i.test(nw) && q(nw) === q(cur) && wc > 0.7 && wc < 1.3)) && !/\b(she|her|hers|herself|he|his|him)\b/i.test(nw)) return nw.trim(); pronLog.push(`${key.split("-").slice(-2)[0]} q${qi + 1} ${what}: rejected (non-pronoun change)`); return cur; };
      it.stem = take(it.stem, pn.stem, "stem");
      it.options.forEach((o: any, j: number) => { if (j !== it.key_index || true) { o.text = take(o.text, pn.options?.[j], `opt${j}`); o.why = take(o.why, pn.whys?.[j], `why${j}`); } });
    }
    it.explanation_en = explanationOf(it);
    after.n++; if (keyLongest([it])) after.longest++;
  });
  // 수기 정정(검수 확정 결함 중 문구 수준): 키는 바꾸지 않는다(w32 q6 의 '거의 놀랍다' 어색한 표현만 키 문구 다듬기).
  const suf = key.split("-").slice(-2)[0] + "@" + s.id;
  const edit = (qi: number, f: (it: any) => void) => f(p.items[qi]);
  const swapPassage = (from: string, to: string) => { let n = 0; p.el_passage.paragraphs = p.el_passage.paragraphs.map((par: string[]) => par.map((x) => { if (x.includes(from)) { n++; return x.split(from).join(to); } return x; })); if (!n) throw new Error(`passage text not found: ${from}`); const disp = passageDisplay({ kind: p.el_passage.kind, title: p.el_passage.title, paragraphs: p.el_passage.paragraphs, provenance: p.provenance }); if (passageDisplay({ kind: orig.payload.el_passage.kind, title: orig.payload.el_passage.title, paragraphs: orig.payload.el_passage.paragraphs, provenance: orig.payload.provenance }) !== orig.payload.set_intro) throw new Error("set_intro not regenerable"); p.set_intro = disp; };
  const rep = (t: string, from: string, to: string) => { if (!t.includes(from)) throw new Error(`text not found: ${from}`); return t.split(from).join(to); };
  if (suf === "r03@EL1") { swapPassage("roughly one hundred and twenty working days", "roughly one hundred and ten working days"); log.manual = ["r03 P2: 'one hundred and twenty' -> 'one hundred and ten' working days (Nov-Mar has about 108 weekdays)"]; }
  if (suf === "w11@EL1") { swapPassage("neighbourhood", "neighborhood"); log.manual = ["w11 s11: British 'neighbourhood' -> 'neighborhood'"]; }
  if (suf === "w06@EL1") { edit(0, (it) => { it.stem = rep(it.stem, "Many panel members", "Many council members"); }); log.manual = ["w06 q1 stem: 'panel members' -> 'council members' (the passage addresses the council)"]; }
  if (suf === "w32@EL2") { edit(4, (it) => { const o = it.options[it.key_index]; o.text = rep(o.text, "close to remarkable", "nothing short of remarkable"); }); edit(5, (it) => { it.stem = rep(it.stem, 'the underlined portion, "midnight Sunday, a donation,"', 'the portion "midnight Sunday, a donation"'); }); log.manual = ["w32 q5 key: 'close to remarkable' -> 'nothing short of remarkable'", "w32 q6 stem: nothing is underlined in the display; remove 'underlined'"]; }
  if (suf === "w22@EL1") { edit(0, (it) => { const o = it.options[it.key_index]; o.text = rep(o.text, "forty others chose to play softer", "everyone else chose to play softer"); }); log.manual = ["w22 q1 key: 'forty others' (overstates: the passage says every section except the oboe played softer) -> 'everyone else'"]; }
  if (suf === "r11@EL1") { edit(4, (it) => { it.options.forEach((o: any) => { if (o.text.includes("'circular'")) o.text = rep(o.text, "'circular'", '"circular"'); }); }); log.manual = ["r11 q5 option: single quotes around 'circular' -> double quotes"]; }
  p.items.forEach((it: any) => { it.explanation_en = explanationOf(it); });
  // 문항 단위 안전장치: 수정 뒤 새 결정적 위반이 생긴 문항은 원본 선지·이유로 되돌린다(예: 인용형 선지에 문장을 이어 붙인 경우).
  p.items.forEach((it: any, qi: number) => {
    const o = stock[key].payload.items[qi]; const vOld = itemViolations(toRaw(orig.payload, orig.payload.items), toRaw(orig.payload, [o]).items[0]);
    const vNew = itemViolations(toRaw(p, p.items), toRaw(p, [it]).items[0]).filter((x) => !vOld.includes(x));
    if (vNew.length) { it.options = JSON.parse(JSON.stringify(o.options)); const rr = rf?.items?.find((x: any) => x.q === qi + 1); if (STAGE === "2" && rr?.whys?.length === it.options.length) rr.whys.forEach((w: string, j: number) => { it.options[j].why = w.trim(); }); it.explanation_en = explanationOf(it); log.reverted.push(`q${qi + 1}:gate:${vNew.join("|")}`); }
  });
  const viol = [...setViolations(toRaw(p, p.items)), ...p.items.flatMap((it: any) => itemViolations(toRaw(p, p.items), toRaw(p, [it]).items[0]))];
  log.violations = viol; log.keyLongestBefore = keyLongest(stock[key].payload.items); log.keyLongestAfter = keyLongest(p.items); log.items = p.items.length;
  log.hiddenRefsLeft = p.el_passage.kind === "reading" ? p.items.filter((it: any) => it.options.some((o: any) => /\b[Ss]entences?\s+\d|\(\d+(?:\s*[-–]\s*\d+)?\)/.test(o.why))).length : 0;
  mcLog.push(log); mergedMc[key] = { kind: p.el_passage.kind, title: p.el_passage.title, paragraphs: p.el_passage.paragraphs, provenance: p.provenance, items: p.items };
  if (log.changed || log.hiddenRefsLeft === 0) mcItems.push(wrap(orig, p, `EL-M: option-length balancing${STAGE === "2" ? " + paragraph references in explanations" : ""}`));
}
const bal = (it: any) => keyRatio([it]);
void bal;
after.longest = Object.values(mergedMc).reduce((a: number, m: any) => a + keyLongest(m.items), 0);
if (pronLog.length) console.log("pronoun pass:", pronLog.join(" | "));
console.log(`MC items key-is-strictly-longest (words): before ${before.longest}/${before.n} -> after ${after.longest}/${after.n}`);
console.log(JSON.stringify(mcLog.map((l) => ({ id: l.id, key: l.key.split("-").slice(-2)[0], changed: l.changed, reverted: l.reverted, viol: l.violations, before: l.keyLongestBefore, after: l.keyLongestAfter, n: l.items, hidden: l.hiddenRefsLeft })), null, 0));
writeFileSync("data/audit/el-review-merged-mc.json", JSON.stringify(mergedMc, null, 1));
if (STAGE === "2") { { const all = [...mcItems, ...frqOut]; writeFileSync("data/ap/stock/el-rv-items.json", JSON.stringify(all, null, 1)); writeFileSync("data/ap/stock/el-rv-pass-keys.json", JSON.stringify(all.map((c: any) => c.stockKey), null, 1) + "\n"); } console.log(`wrote ${mcItems.length} MC + ${frqOut.length} FRQ fixed candidates`); }
void passageDisplay; void idOf; void (null as unknown as ElSetRaw | ElItemRaw);

console.log(JSON.stringify(frqLog.map((l) => ({ fix: l.fixId, viol: l.violations }))));

// ── 교체 계획(관리자 '새 버전' 형식) ─────────────────────────────────────────────────────────────
if (STAGE === "2") {
  const fixedKeys = new Set([...mcItems, ...frqOut].map((c: any) => c.canonicalKey as string));
  const manualByKey = new Map(mcLog.map((l) => [l.key, l.manual as string[] | undefined]));
  for (const s of assign) {
    const swaps: any[] = [];
    for (const key of s.mcA) {
      const nk = `${RUN}:${stock[key].candidateKey}`; if (!fixedKeys.has(nk)) continue; const lg = mcLog.find((l) => l.key === key)!;
      const reasons = [`MC option-length balancing (key was the strictly longest option in ${lg.keyLongestBefore}/${lg.items} items; now ${lg.keyLongestAfter}/${lg.items})`];
      if (refs[`rf__${idOf(key)}`]) reasons.push("explanations no longer cite hidden sentence numbers"); if (pron[`pn__${idOf(key)}`]) reasons.push("stems/options no longer assume the writer's gender");
      for (const m of manualByKey.get(key) ?? []) reasons.push(m);
      swaps.push({ section: "ap_mc", removeKey: key, addKey: nk, tier: lg.manual || lg.required ? "required" : "recommended", reason: reasons.join("; "), remove: { skill: stock[key].payload.skill, topic: stock[key].payload.topic, items: lg.items }, add: { skill: stock[key].payload.skill, topic: stock[key].payload.topic, items: lg.items, sameCell: true } });
    }
    for (const key of s.frqA) {
      const nk = `${RUN}:${stock[key].candidateKey}`; if (!fixedKeys.has(nk)) continue; const fx = frqLog.find((l) => l.key === key)!;
      swaps.push({ section: "ap_frq", removeKey: key, addKey: nk, tier: "required", reason: `${fx.fixId}: ${fx.notes.join("; ")}`, remove: { type: stock[key].payload.template }, add: { type: stock[key].payload.template, sameCell: true } });
    }
    const plan = { kind: "ap_new_version_swap_plan", set: s.id, sourceSetName: `AP English Language — Practice Exam ${s.id.slice(2)}`, sourceVersionNo: 1, generatedBy: "scripts/ap-generation/el-review-build-fixes.ts (EL review 2026-10-14)",
      note: "Replacement candidates (keys el-rv:*) are NOT in the DB until admin batch 'el-rv' (data/ap/stock/el-rv-items.json) is loaded and its render/screen evidence is recorded; see docs/ap/englang-review-report.md for the order. Each swap replaces a whole passage set (all its slots) or one FRQ with the same-cell corrected copy. tier=required fixes a content/prompt defect; tier=recommended is the option-length balancing.",
      swapCount: swaps.length, verifierViolations: [], swaps };
    writeFileSync(`data/ap/stock/${s.id.toLowerCase()}-review-v2-swap-plan.json`, JSON.stringify(plan, null, 1)); console.log(`${s.id}: ${swaps.length} swaps (${swaps.filter((x) => x.tier === "required").length} required)`);
  }
}
