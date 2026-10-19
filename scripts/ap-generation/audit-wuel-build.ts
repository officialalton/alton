// 외부 AP 전체 검수(2026-10-15) 확정 수정 — World History·US History·English Literature 25행(AP-047·050·051·052·073–075·078·079–095).
// 원본 재고는 그대로 두고 수정본 후보(키 audit-wuel:*)와 새 버전 교체안(*-audit-swap-plan.json)을 쓴다. 무료·DB 없음.
//   npx tsx scripts/ap-generation/audit-wuel-build.ts
// 설계: 문자열 정정은 payload 전체에 같은 치환을 적용하고(참고 본문이 여러 곳에 복제돼 있음), 점수·샘플 판정 변경은 타입이 있는 *_frq 객체를 고친 뒤
//       reference_text 의 샘플 블록·parts 의 모범답/루브릭을 같은 라이브러리 함수로 다시 만든다. 수정 전후 게이트 위반을 비교해 새 위반이 생기면 중단한다.
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { frqReferenceText as ushRef, frqViolations as ushViol, type UshFrqPayload } from "../../lib/ap-generation/ushistory-frq";
import { frqReferenceText as ltRef, frqViolations as ltViol, type LtFrqPayload } from "../../lib/ap-generation/englit-frq";
import { whReferenceText, whFrqViolations, type WhFrqPayload } from "../../lib/ap-generation/wh-frq";
import { loadWhRegistry, realSetIntro, realStimulus, whRealSetViolations } from "../../lib/ap-generation/wh-real-gates";
import { WH_FRQS, WH_SETS } from "../../lib/ap-generation/wh-plan";

const rd = <T,>(f: string): T => JSON.parse(readFileSync(f, "utf-8")) as T;
const RUN = "audit-wuel";
const DATE = "2026-10-15";
const stock: Record<string, any> = {};
for (const f of readdirSync("data/ap/stock").filter((x) => /-items\.json$/.test(x))) for (const it of rd<any[]>(path.join("data/ap/stock", f))) stock[it.stockKey] = it;
const REG = new Map(loadWhRegistry().map((s) => [s.id, s]));
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x)) as T;
const W = (t: string) => t.trim().split(/\s+/).length;

/** payload 전체의 문자열에서 from → to 치환(복제된 참고 본문 전부). 찾지 못하면 중단. */
function sub(o: any, from: string, to: string, min = 1): number {
  let n = 0;
  const walk = (x: any): any => {
    if (typeof x === "string") { if (x.includes(from)) { n += x.split(from).length - 1; return x.split(from).join(to); } return x; }
    if (Array.isArray(x)) return x.map(walk);
    if (x && typeof x === "object") { for (const k of Object.keys(x)) x[k] = walk(x[k]); return x; }
    return x;
  };
  walk(o);
  if (n < min) throw new Error(`치환 대상 없음: ${from.slice(0, 80)}`);
  return n;
}
const wrap = (orig: any, payload: any, notes: string): any => {
  const c = clone(orig); c.payload = payload; const base = orig.candidateKey;
  c.run = RUN; c.stockKey = `${RUN}:${base}`; c.canonicalKey = c.stockKey; c.itemFamilyId = `fam:${c.stockKey}`; c.selectedForSample = false;
  c.gateOverride = `${RUN}-${DATE}`; c.gateVersion = `${RUN}-${DATE}`;
  c.duplicateOf = null; c.duplicateReason = null; c.expertStatus = "unreviewed"; c.releaseTier = "candidate"; c.renderVerified = false; c.screenVerified = false; c.reviewEnvReady = false;
  c.history = [...(orig.history ?? []), { run: RUN, gateVersion: `${RUN}-${DATE}`, outcome: "passed", reasons: notes }];
  return c;
};

type Kind = "wh" | "ush" | "lit";
const FIELD: Record<Kind, string> = { wh: "whap_frq", ush: "ush_frq", lit: "lit_frq" };
const SAMPLE_MARK: Record<Kind, string> = { wh: "Sample response, high score", ush: "Sample response, high score", lit: "Sample essay (high;" };

function refOf(kind: Kind, p: any): string { return kind === "wh" ? whReferenceText(p as WhFrqPayload) : kind === "ush" ? ushRef(p as UshFrqPayload) : ltRef(p as LtFrqPayload); }
/** 샘플이 바뀐 뒤 reference_text 의 샘플 블록과 parts 의 모범답을 다시 만든다(머리 부분의 문자열 정정은 sub 로 이미 반영). */
function regen(kind: Kind, payload: any): void {
  const p = payload[FIELD[kind]];
  for (const sm of p.samples) sm.word_count = W(sm.essay);
  const fresh = refOf(kind, p); const mark = SAMPLE_MARK[kind];
  const iNew = fresh.indexOf(mark); const iOld = String(payload.reference_text).indexOf(mark);
  if (iNew < 0 || iOld < 0) throw new Error("샘플 블록 표식 없음");
  // 표식 앞의 빈 줄 한 줄을 포함해 머리는 기존 것을 유지하고 샘플 블록만 교체한다.
  payload.reference_text = String(payload.reference_text).slice(0, iOld) + fresh.slice(iNew);
  const hi = p.samples.find((s: any) => s.tier === "high");
  if (kind !== "wh" || p.task_type !== "saq") { if (payload.parts?.[0] && hi && p.task_type !== "saq") payload.parts[0].model_answer = hi.essay; }
}
const setScores = (p: any, tier: string, scores: Record<string, number>): void => {
  const sm = p.samples.find((s: any) => s.tier === tier); Object.assign(sm.rubric_scores, scores);
  const rows = Object.keys(sm.rubric_scores).filter((k) => k !== "total");
  sm.rubric_scores.total = rows.reduce((a, k) => a + sm.rubric_scores[k], 0); sm.target_total = sm.rubric_scores.total;
};
const setAnn = (p: any, tier: string, quotePrefix: string, comment: string): void => {
  const sm = p.samples.find((s: any) => s.tier === tier); const a = sm.annotations.find((x: any) => x.quote.startsWith(quotePrefix));
  if (!a) throw new Error(`주석 없음: ${tier} ${quotePrefix}`); a.comment = comment;
};
const ann = (p: any, tier: string) => p.samples.find((s: any) => s.tier === tier).annotations;
const sample = (p: any, tier: string) => p.samples.find((s: any) => s.tier === tier);

type Fix = { id: string; kind: Kind | "mc"; notes: string[]; apply: (payload: any) => void };
const FIXES: Record<string, Fix> = {};

// ───────────── World History: MC ─────────────
const mcRebuild = (payload: any, setId: string): void => {
  const spec = WH_SETS.find((s) => s.id === setId)!;
  payload.set_intro = realSetIntro(spec.sources, REG);
  const st = realStimulus(spec.sources, REG); if (st) payload.stimulus = st;
  const v = whRealSetViolations(payload, REG, spec); if (v.length) throw new Error(`${setId}: ${v.join(", ")}`);
};
FIXES["wh-m1:ap_world_history-w202-k0"] = { id: "AP-085", kind: "mc", notes: ["population table was shown twice (set_intro markdown + stimulus table); body now points to the single table"], apply: (p) => mcRebuild(p, "w202") };
FIXES["wh-p1:ap_world_history-w108-k0"] = { id: "AP-093", kind: "mc", notes: ["population table was shown twice (set_intro markdown + stimulus table); body now points to the single table"], apply: (p) => mcRebuild(p, "w108") };
FIXES["wh-m1:ap_world_history-w205-k0"] = { id: "AP-091+AP-092(MC20)", kind: "mc", notes: ["MC18: image description/alt now includes the 2 feet 7 inches heading the key relies on", "MC20: removed 'EXTRA: ' authoring marker from the stem"], apply: (p) => {
  sub(p, "EXTRA: ", ""); mcRebuild(p, "w205");
  if (!JSON.stringify(p.stimulus).includes("2 feet 7 inches")) throw new Error("w205 alt not updated");
} };
FIXES["wh-m1:ap_world_history-w111-k0"] = { id: "AP-092(MC42)", kind: "mc", notes: ["removed 'EXTRA. ' authoring marker from the stem"], apply: (p) => { sub(p, "EXTRA. ", ""); const spec = WH_SETS.find((s) => s.id === "w111")!; const v = whRealSetViolations(p, REG, spec); if (v.length) throw new Error(v.join(",")); } };
FIXES["wh-m1:ap_world_history-w211-k0"] = { id: "AP-094", kind: "mc", notes: ["source context said Order No. 1 came a few days after the abdication; it was issued March 1 (O.S.), the day before Nicholas II abdicated (March 2 O.S.)"], apply: (p) => {
  sub(p, "This order was issued in March 1917 by the Petrograd Soviet, a council of workers' and soldiers' deputies, a few days after Tsar Nicholas II gave up the throne.", "This order was issued on March 1 (Old Style) in 1917 by the Petrograd Soviet, a council of workers' and soldiers' deputies, during the February Revolution and one day before Tsar Nicholas II gave up the throne.");
  mcRebuild(p, "w211");
  const t = JSON.stringify(p);
  for (const bad of ["a few days after", "after the abdication", "after Tsar Nicholas II gave up", "after Nicholas II abdicated"]) if (t.includes(bad)) throw new Error(`w211 still says: ${bad}`);
} };

// ───────────── World History: FRQ ─────────────
const whCheck = (payload: any): string[] => {
  const spec = WH_FRQS.find((s) => `whfrq_${s.id}` === payload.archetype)!; return whFrqViolations(payload.whap_frq, spec, REG);
};
FIXES["wh-f4:ap_world_history-wh1_dbq-k0"] = { id: "AP-079+AP-080+AP-081+AP-082", kind: "wh", notes: [
  "docs row: level 1 no longer allows two documents (unified: 1 = accurately describe 3 documents, 2 = use 4 in an argument)",
  "high sample: complexity point not earned (annotation itself called it a 6) -> 6/7",
  "mid sample: annotation now credits the five documents actually used (1, 3, 5, 2, 4) -> docs 2, total 4 unchanged",
  "low sample: added Document 3 so three documents are described (docs 1, total 2 unchanged)"], apply: (payload) => {
  const p = payload.whap_frq;
  sub(payload, "accurately describes the content of at least three documents and ties them to the topic, or uses only two or three documents to support an argument.", "accurately describes the content of at least three documents and ties them to the topic.", 1);
  setScores(p, "high", { complexity: 0 });
  setAnn(p, "high", "Sun Yat-sen took the opposite view.", "Contrasts Asian rejection and adoption of industry and qualifies the thesis, but the qualification is brief and is not sustained through the whole essay, so the complexity point is not earned. The response scores 6, not 7.");
  // mid: five documents are used (1, 3, 5 in the internal paragraph; 2, 4 in the external paragraph) -> docs 2 is correct; fix the annotations that said 3 documents / 1 point.
  setAnn(p, "mid", "so the picture shows crowded housing next to new technology", "Accurately reads Document 5 for what it shows and uses it with Documents 1 and 3 to support the argument about internal change.");
  setAnn(p, "mid", "This shows that production was becoming much more efficient", "Accurate use of Document 1 tied to the topic. Documents 1, 3 and 5 (internal change) and Documents 2 and 4 (relations with China) all support the argument, so five documents are used to support an argument and the response earns 2 points on documents.");
  // low: add Document 3 so at least three documents are accurately described.
  const lo = sample(p, "low");
  const from = "It supports the idea that industrialization transformed how goods were made.";
  if (!lo.essay.includes(from)) throw new Error("wh1 dbq low anchor");
  lo.essay = lo.essay.replace(from, `${from} In Document 3, Friedrich Engels says the steam engine and the cotton machinery caused an industrial revolution that created the working class in England. This shows that factories also changed who worked and where people lived.`);
  setAnn(p, "low", "the work is divided into about eighteen distinct operations", "Accurately describes Document 1 and ties it to changes in production.");
  setAnn(p, "low", "British subjects in China are judged by British authorities and the Consul", "Accurate use of Document 4's consular jurisdiction, tied to the prompt. With Documents 1 and 3, three documents are accurately described, so the response earns 1 point on documents but not 2, because only the description is given and no document is developed into an argument.");
  regen("wh", payload);
} };
FIXES["wh-f4:ap_world_history-wh1_leq-k0"] = { id: "AP-083+AP-084", kind: "wh", notes: [
  "low sample: annotations now credit the continuity-and-change framing (analysis 1) that the header already gave; no complexity",
  "mid sample: header and annotations reconciled to thesis 1 + evidence 1 + analysis 1 = 3"], apply: (payload) => {
  const p = payload.whap_frq;
  setAnn(p, "low", "Many trade routes were already being used before 1200", "Frames the whole essay as change versus continuity (what changed, then 'However, some things stayed the same'), which earns the one reasoning point. The continuity is only general, with no named routes or examples, so there is no complexity point.");
  setAnn(p, "low", "so trade changed many things but it also had a lot of continuity.", "The conclusion repeats the change-and-continuity frame without weighing where or how much each applied, so analysis stays at 1 and the second point is not earned.");
  setScores(p, "mid", { evidence: 1, analysis: 1 });
  setAnn(p, "mid", "Some things stayed the same during this time.", "Uses change (disease, the Atlantic) against continuity (Indian Ocean trade) to frame the essay, which earns the one reasoning point. The continuity paragraph is brief and is not explained or compared in depth, so there is no complexity point.");
  setAnn(p, "mid", "The changes were large in some ways", "The conclusion repeats the thesis without weighing the evidence or distinguishing goods, ideas and diseases, so analysis stays at 1 and complexity is not shown.");
  regen("wh", payload);
} };
FIXES["wh-f1:ap_world_history-wh1_saq1-k0"] = { id: "AP-086", kind: "wh", notes: ["low sample part C annotation no longer faults Gandhi for not being a head of government (the prompt allows any nationalist leader); the valid objections are the 1930 Salt March outside 1945-1975 and the missing comparison"], apply: (payload) => {
  const p = payload.whap_frq;
  setAnn(p, "low", "Gandhi led the Indian independence movement against Britain", "Names a real nationalist leader in Asia, but only describes the case. The Salt March (1930) falls before the 1945 to 1975 period the prompt requires, and independence in 1947 is described rather than compared with Egypt.");
  regen("wh", payload);
} };
FIXES["wh-f1:ap_world_history-wh2_dbq-k0"] = { id: "AP-087", kind: "wh", notes: ["high sample: complexity point not earned (annotation described a 6-level response) -> 6/7"], apply: (payload) => {
  const p = payload.whap_frq; setScores(p, "high", { complexity: 0 });
  setAnn(p, "high", "Still, Arab demands did not disappear and they shaped the new order.", "Qualifies the argument by weighing European control against Arab agency, treats Palestine separately, and sets Doc 2 against Doc 7. This is kept fairly brief and is not sustained through the essay, so the complexity point is not earned. The response scores 6, not 7.");
  regen("wh", payload);
} };
FIXES["wh-f2:ap_world_history-wh2_leq-k0"] = { id: "AP-088+AP-089+AP-090", kind: "wh", notes: [
  "high sample: removed the 'just short of top level' clause that contradicted the 6/6 header; 6/6 kept",
  "mid sample: header and annotations reconciled to thesis 1 + evidence 1 + analysis 1 = 3",
  "low sample: annotations now credit the change-and-continuity framing (analysis 1) that the header gave; no complexity"], apply: (payload) => {
  const p = payload.whap_frq;
  setAnn(p, "high", "the creoles mostly wanted power for themselves", "Qualifies the argument by showing that Enlightenment-inspired goals were still limited. The Latin American example is less developed than the others, but the complexity runs through several paragraphs, so the analysis row earns 2.");
  setScores(p, "mid", { evidence: 1, analysis: 1 });
  setAnn(p, "mid", "So methods could be violent or nonviolent depending on the place.", "Frames the examples as change in goals against continuity in methods, which earns the one reasoning point. It names the variation but does not explain causes of the shift (such as the world wars or mass politics), so there is no complexity point.");
  setAnn(p, "mid", "There was both change and continuity", "Names change and continuity in the conclusion without developing them, so analysis stays at 1.");
  setAnn(p, "low", "Later on, resistance in other places also became bigger and more organized.", "This is a general assertion with no evidence behind it and no explanation of why goals or methods shifted; it does not add to the reasoning credit.");
  setAnn(p, "low", "However, there was still continuity because people kept resisting foreign rule", "The thesis and conclusion do frame the response as change in goals versus continuity in resistance, which earns the one reasoning point. The continuity is only restated, never weighed against change with evidence, so there is no complexity.");
  regen("wh", payload);
} };
FIXES["wh-f1:ap_world_history-wh2_saq1-k0"] = { id: "AP-095", kind: "wh", notes: ["part B window is 1839-1900: the Boxer Protocol (1901) is outside it; the note now accepts only the 1899-1900 Uprising and the 1900 foreign intervention, with the Protocol credited only as a stated later consequence of those 1900 events"], apply: (payload) => {
  const p = payload.whap_frq; const notes: string[] = p.rubric.scoring_notes;
  const i = notes.findIndex((n) => n.includes("Boxer Protocol of 1901"));
  if (i < 0) throw new Error("boxer note");
  const old = notes[i];
  const fresh = "In part B, the Boxer Uprising of 1899 to 1900 and the foreign military intervention of 1900 are inside the stated years and may be accepted if the response ties them to foreign privilege, for example the foreign troops sent to Beijing or the claims of foreign powers in China. The Boxer Protocol (September 1901) is dated after 1900, so it is credited only as a later consequence that the response explains from the 1900 events, never as the main development.";
  sub(payload, old, fresh);
  regen("wh", payload);
} };

// ───────────── US History ─────────────
const ushCheck = (payload: any): string[] => ushViol(payload.ush_frq as UshFrqPayload);
FIXES["ush-p1-b:ap_us_history-leq_3-k0"] = { id: "AP-073", kind: "ush", notes: [
  "mid sample: header and notes reconciled to thesis 1 + context 0 + evidence 1 + analysis 1 = 3 (notes denied context and credited evidence 1)",
  "low sample: header and notes reconciled to evidence 1 (two examples identified, general), analysis 0 -> 1/6"], apply: (payload) => {
  const p = payload.ush_frq;
  setScores(p, "mid", { context: 0, evidence: 1, analysis: 1 });
  setAnn(p, "mid", "Another example is Irish immigration in the 1840s.", "Uses some causation (the famine leading to nativism and the Know-Nothings, Bacon's Rebellion leading to slavery) to frame the examples, which earns the first reasoning point. The examples are still taken one at a time with little comparison, so there is no complexity point.");
  setScores(p, "low", { evidence: 1, analysis: 0 });
  setAnn(p, "low", "Many Irish immigrants came to the United States and they were often Catholic.", "Accurately identifies two relevant examples (Irish immigration in the 1840s and Chinese migration to California), so the first evidence point is earned, but both are described only generally and neither is used to support an argument about the extent of change, so the second evidence point is not earned.");
  setAnn(p, "low", "They worked hard and many Americans did not welcome them either.", "The statement is general and has no specifics such as laws or dates. It does not support a claim about how much society changed, which is why evidence stops at 1.");
  regen("ush", payload);
} };
FIXES["ush-p1-b:ap_us_history-leq_1-k0"] = { id: "AP-075", kind: "ush", notes: ["low sample: header and notes reconciled to evidence 1 (two examples identified, general), analysis 0 -> 1/6; annotation no longer says the federal-power link is absent"], apply: (payload) => {
  const p = payload.ush_frq;
  setScores(p, "low", { evidence: 1, analysis: 0 });
  setAnn(p, "low", "The Southern states left the Union", "Secession is a relevant example but is described only generally, with no dates, specific events or details. It is the main example and is not developed.");
  setAnn(p, "low", "The government passed new amendments after the war", "A second relevant example (the Thirteenth Amendment) is identified, and the next sentence does say the federal government took on more power over the states. Together the two examples earn the first evidence point, but both are thin and neither is developed into an argument about federal and state power, so the second evidence point is not earned.");
  setAnn(p, "low", "After the war the federal government became stronger than it was before.", "States a change in one sentence and gives no causal explanation of how the debates produced it. It also ignores continuity, such as the weakening of federal power by 1877. The essay mostly lists and asserts, so there is no reasoning credit.");
  regen("ush", payload);
} };
FIXES["ush-real-b:ap_us_history-real_b_dbq_market-k0"] = { id: "AP-074", kind: "ush", notes: ["mid sample: added a distinct post-1812 context sentence so the Erie Canal is the separate outside example (context and outside evidence were both credited for the same Erie Canal sentence)"], apply: (payload) => {
  const p = payload.ush_frq; const mid = sample(p, "mid");
  const anchor = "The market revolution changed American lives a lot between 1815 and 1860 because it connected people to markets and gave them new kinds of work.";
  if (!mid.essay.startsWith(anchor)) throw new Error("dbq mid anchor");
  const ctx = "After the War of 1812, Americans embraced a national economy, building roads and banks and putting up a protective tariff to tie the states together.";
  mid.essay = mid.essay.replace(anchor, `${ctx} ${anchor}`);
  ann(p, "mid").unshift({ quote: ctx, comment: "Describes a broader development after the War of 1812 (a national economy, roads, banks and the tariff) and ties it to the market revolution, so it earns the context point. The Erie Canal is not used here; it is kept as the separate outside example below.", row_id: "context" });
  setAnn(p, "mid", "the Erie Canal, finished in 1825", "A specific outside fact that is different from the context sentence above, so it earns the outside-evidence point. It is used as an example rather than as a developed context paragraph.");
  regen("ush", payload);
} };
FIXES["ush-real-a:ap_us_history-real_a_saq3_plains-k0"] = { id: "AP-078", kind: "ush", notes: ["Munn v. Illinois (1877) concerned grain-elevator/warehouse charges, not railroad rates; the reference now separates the Granger railroad laws from Munn"], apply: (payload) => {
  sub(payload, "railroad regulation through Granger laws, Munn v. Illinois, and the Interstate Commerce Act", "regulation of railroad rates through Granger laws and the Interstate Commerce Act, and of grain-warehouse charges in Munn v. Illinois");
  sub(payload, "Farmer pressure led to state Granger laws regulating railroads, which the Supreme Court upheld in Munn v. Illinois in 1877, and later to the Interstate Commerce Act of 1887.", "Farmer pressure led to state Granger laws regulating railroad rates and grain-elevator charges. In Munn v. Illinois (1877), a case about grain-warehouse charges rather than railroads, the Supreme Court upheld state power to regulate businesses that affect the public interest, and Congress later passed the Interstate Commerce Act of 1887.");
  sub(payload, "Munn v. Illinois (1877) upheld state regulation of grain elevators and railroad rates.", "Munn v. Illinois (1877) upheld an Illinois law regulating grain-warehouse (elevator) charges; it was not a railroad-rate case, although the Granger laws also targeted railroad rates.");
  const t = JSON.stringify(payload); if (/Munn[^"]{0,80}railroad/i.test(t.replace(/not a railroad|rather than railroads/g, ""))) throw new Error("Munn/railroad conflation remains");
} };

// ───────────── English Literature ─────────────
const ltCheck = (payload: any, real: boolean): string[] => ltViol(payload.lit_frq as LtFrqPayload, [], { realText: real });
FIXES["lt-real-2:ap_english_literature-real-rf3-k0"] = { id: "AP-047", kind: "lit", notes: ["'scornfully bumping a crest' describes the boat (she), not the sea; the high sample and the sophistication note no longer list it as personification of the sea"], apply: (payload) => {
  sub(payload, "The personification, from \"wrongfully and barbarously\" to \"scornfully bumping a crest\" to \"the snarling of the crests,\" shows the men experiencing the sea as an enemy.", "The sea is personified in \"wrongfully and barbarously\" and \"the snarling of the crests,\" which shows the men experiencing it as an enemy, and even the boat is given a living attitude when she goes \"scornfully bumping a crest.\"");
  sub(payload, "personification of the sea ('wrongfully,' 'snarling,' 'scornfully')", "personification of the sea ('wrongfully,' 'snarling')");
  const t = JSON.stringify(payload.lit_frq.samples) + payload.reference_text; if (/personification[^.]{0,80}scornfully\s+bumping[^.]{0,40}sea/i.test(t)) throw new Error("rf3 still ties scornfully to the sea");
  regen("lit", payload);
} };
FIXES["englit-p1-b:ap_english_literature-fa1-k0"] = { id: "AP-050", kind: "lit", notes: ["mid sample inserted a line break after the first 'Nothing'; in the poem the break falls after the second 'Nothing' (line 15 ends 'Nothing', line 16 begins 'was ever let go of')"], apply: (payload) => {
  sub(payload, "\"Nothing / was ever lost. Nothing / was ever let go of, either.\"", "\"Nothing was ever lost. Nothing / was ever let go of, either.\"");
  sub(payload, "The line break after \"Nothing\" makes the reader stop", "The line break after the second \"Nothing\" makes the reader stop");
  regen("lit", payload);
} };
FIXES["lt-real-1:ap_english_literature-real-rf2-k0"] = { id: "AP-051", kind: "lit", notes: ["the high sample called 'seemed to slip out of his memory', 'some force seemed to draw him' and 'took possession of him' passive; they are active/intransitive constructions with non-human subjects, so the claim is now about subject and agency"], apply: (payload) => {
  sub(payload, "The verb is passive. Gurov doesn't choose to forget, it just happens to him, the same way", "Here the experience is the grammatical subject and Gurov only undergoes the forgetting: he does not choose to forget, it just happens to him, the same way");
  sub(payload, "The verb is passive. Gurov doesn't choose to forget, it just happens to him", "Here the experience is the grammatical subject and Gurov only undergoes the forgetting: he does not choose to forget, it just happens to him");
  sub(payload, "the passive phrasing 'some force seemed to draw him'", "the involuntary phrasing 'some force seemed to draw him'");
  sub(payload, "(passive phrasing, \"seemed\")", "(non-human subjects acting on Gurov, \"seemed\")");
  sub(payload, "The passive wording makes it seem like he has no control.", "The thought is the grammatical subject, acting on him, which makes it seem like he has no control.");
  { const t = JSON.stringify(payload.lit_frq.samples) + payload.reference_text; const m = /passive (phrasing|wording|voice)|verb is passive/i.exec(t); if (m) throw new Error(`rf2 still says passive: ${t.slice(Math.max(0, m.index - 150), m.index + 100)}`); }
  regen("lit", payload);
} };
FIXES["englit-p1-b:ap_english_literature-fa3-k0"] = { id: "AP-052", kind: "lit", notes: ["low sample header gave thesis 1 but the annotation denied it; reconciled to thesis 1 (the essay states a defensible interpretation in the last paragraph; the thesis may appear anywhere), total 3 unchanged"], apply: (payload) => {
  setAnn(payload.lit_frq, "low", "The Helmer house protects her but it also traps her", "The introduction mostly restates the prompt's protect/confine idea. The thesis point is earned only because the essay does state a defensible interpretation later (the home confined Nora the whole time, and Ibsen shows she had to leave to find herself); the rubric allows the thesis anywhere in the essay. It stays a basic claim.");
  regen("lit", payload);
} };

// ───────────── 실행 ─────────────
const out: any[] = []; const log: any[] = []; const failures: string[] = [];
for (const [key, fix] of Object.entries(FIXES)) {
  const orig = stock[key]; if (!orig) throw new Error(`재고에 없음: ${key}`);
  const payload = clone(orig.payload);
  const check = fix.kind === "wh" ? whCheck : fix.kind === "ush" ? ushCheck : fix.kind === "lit" ? (x: any) => ltCheck(x, Boolean(x.real_text)) : () => [];
  const before = fix.kind === "mc" ? [] : check(orig.payload);
  fix.apply(payload);
  const after = fix.kind === "mc" ? [] : check(payload);
  const added = after.filter((v) => !before.includes(v));
  if (added.length) failures.push(`${key}: ${added.join(", ")}`);
  if (/EXTRA/.test(JSON.stringify(payload))) failures.push(`${key}: EXTRA remains`);
  out.push(wrap(orig, payload, fix.notes.join(" | ")));
  log.push({ auditIds: fix.id, key, newKey: `${RUN}:${orig.candidateKey}`, notes: fix.notes, violationsBefore: before, violationsAfter: after });
}
if (failures.length) { console.error(failures.join("\n")); process.exit(1); }
writeFileSync(`data/ap/stock/${RUN}-items.json`, JSON.stringify(out, null, 1) + "\n");
writeFileSync(`data/ap/stock/${RUN}-pass-keys.json`, JSON.stringify(out.map((x) => x.stockKey), null, 1) + "\n");
writeFileSync(`data/ap/stock/${RUN}-summary.json`, JSON.stringify({ run: RUN, generatedAt: DATE, source: "docs/audits/ap-external-audit-20261015-confirmed-fixes.csv", passed: log.map((l) => ({ stockKey: l.newKey, replaces: l.key, auditIds: l.auditIds, notes: l.notes, violationsBefore: l.violationsBefore, violationsAfter: l.violationsAfter })) }, null, 1) + "\n");

// ───────────── 교체안(새 버전 계획) ─────────────
type SwapIn = { section: string; key: string; reason: string; remove: Record<string, unknown>; add: Record<string, unknown> };
const sw = (section: string, key: string, reason: string, extra: Record<string, unknown>): SwapIn => ({ section, key, reason, remove: { ...extra }, add: { ...extra, sameCell: true } });
const reasonOf = (key: string) => FIXES[key].id + ": " + FIXES[key].notes.join("; ");
const mcItems = (key: string) => stock[key].payload.items.length;
const plan = (set: string, name: string, v: number, note: string, rows: [string, string, Record<string, unknown>][]) => {
  const swaps = rows.map(([section, key, extra]) => ({ section, removeKey: key, addKey: `${RUN}:${stock[key].candidateKey}`, tier: "required", reason: reasonOf(key), remove: extra, add: { ...extra, sameCell: true } }));
  const file = `data/ap/stock/${set.toLowerCase()}-v${v + 1}-audit-wuel-swap-plan.json`;
  writeFileSync(file, JSON.stringify({ kind: "ap_new_version_swap_plan", set, sourceSetName: name, sourceVersionNo: v, generatedBy: "scripts/ap-generation/audit-wuel-build.ts (external audit 2026-10-15)", note, swapCount: swaps.length, verifierViolations: [], swaps }, null, 1) + "\n");
  console.log(file, swaps.length);
};
const mcx = (k: string) => ({ kind: "mc_set", items: mcItems(k) });
const frqx = (k: string) => ({ type: stock[k].payload.template ?? stock[k].payload.whap_frq?.template ?? stock[k].payload.ush_frq?.template ?? stock[k].payload.lit_frq?.template });
void sw;
plan("WH1", "AP World History: Modern — Practice Exam 1", 1, "Corrected copies of the WH1 candidates named in the 2026-10-15 external audit (AP-079..086). Batch 'audit-wuel' must be loaded first. sourceVersionNo is the version the WH1 draft was saved as (1); if WH1 was published at another version, the admin 'new version' flow copies the then-published version and these removeKey slots must still match.", [
  ["ap_mc", "wh-m1:ap_world_history-w202-k0", mcx("wh-m1:ap_world_history-w202-k0")],
  ["ap_saq", "wh-f1:ap_world_history-wh1_saq1-k0", frqx("wh-f1:ap_world_history-wh1_saq1-k0")],
  ["ap_frq", "wh-f4:ap_world_history-wh1_dbq-k0", frqx("wh-f4:ap_world_history-wh1_dbq-k0")],
  ["ap_frq", "wh-f4:ap_world_history-wh1_leq-k0", frqx("wh-f4:ap_world_history-wh1_leq-k0")],
]);
plan("WH2", "AP World History: Modern — Practice Exam 2", 1, "Corrected copies of the WH2 candidates named in the 2026-10-15 external audit (AP-087..095). Batch 'audit-wuel' must be loaded first. See the WH1 plan note about sourceVersionNo.", [
  ["ap_mc", "wh-p1:ap_world_history-w108-k0", mcx("wh-p1:ap_world_history-w108-k0")],
  ["ap_mc", "wh-m1:ap_world_history-w205-k0", mcx("wh-m1:ap_world_history-w205-k0")],
  ["ap_mc", "wh-m1:ap_world_history-w111-k0", mcx("wh-m1:ap_world_history-w111-k0")],
  ["ap_mc", "wh-m1:ap_world_history-w211-k0", mcx("wh-m1:ap_world_history-w211-k0")],
  ["ap_saq", "wh-f1:ap_world_history-wh2_saq1-k0", frqx("wh-f1:ap_world_history-wh2_saq1-k0")],
  ["ap_frq", "wh-f1:ap_world_history-wh2_dbq-k0", frqx("wh-f1:ap_world_history-wh2_dbq-k0")],
  ["ap_frq", "wh-f2:ap_world_history-wh2_leq-k0", frqx("wh-f2:ap_world_history-wh2_leq-k0")],
]);
plan("US1", "AP U.S. History — Practice Exam 1", 4, "Corrected LEQ (AP-073). Source = US1 v4 (Stage C/D published). Batch 'audit-wuel' must be loaded first.", [
  ["ap_frq", "ush-p1-b:ap_us_history-leq_3-k0", frqx("ush-p1-b:ap_us_history-leq_3-k0")],
]);
plan("US2", "AP U.S. History — Practice Exam 2", 4, "Corrected DBQ, LEQ and SAQ 3 (AP-074, AP-075, AP-078). Source = US2 v4 (Stage C/D published). Batch 'audit-wuel' must be loaded first.", [
  ["ap_frq", "ush-real-b:ap_us_history-real_b_dbq_market-k0", frqx("ush-real-b:ap_us_history-real_b_dbq_market-k0")],
  ["ap_frq", "ush-p1-b:ap_us_history-leq_1-k0", frqx("ush-p1-b:ap_us_history-leq_1-k0")],
  ["ap_saq", "ush-real-a:ap_us_history-real_a_saq3_plains-k0", frqx("ush-real-a:ap_us_history-real_a_saq3_plains-k0")],
]);
plan("LT1", "AP English Literature — Practice Exam 1", 3, "Corrected Q2 (AP-047). Source = LT1 v3 (Stage 2 published). Batch 'audit-wuel' must be loaded first.", [
  ["ap_frq", "lt-real-2:ap_english_literature-real-rf3-k0", frqx("lt-real-2:ap_english_literature-real-rf3-k0")],
]);
plan("LT2", "AP English Literature — Practice Exam 2", 3, "Corrected Q1, Q2, Q3 (AP-050, AP-051, AP-052). Source = LT2 v3 (Stage 2 published). Batch 'audit-wuel' must be loaded first.", [
  ["ap_frq", "englit-p1-b:ap_english_literature-fa1-k0", frqx("englit-p1-b:ap_english_literature-fa1-k0")],
  ["ap_frq", "lt-real-1:ap_english_literature-real-rf2-k0", frqx("lt-real-1:ap_english_literature-real-rf2-k0")],
  ["ap_frq", "englit-p1-b:ap_english_literature-fa3-k0", frqx("englit-p1-b:ap_english_literature-fa3-k0")],
]);
console.log("items", out.length); for (const l of log) console.log(l.auditIds, l.violationsBefore.length, "->", l.violationsAfter.length);
