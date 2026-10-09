// AP 문항 은행(stock) 순수 로직(2026-10-08, 오너 보정 반영).
//  - 검증 상태(validation)·전문가 상태(expert)·세트/샘플 선택(selection)은 **서로 다른 속성**이다. 과거 selected/reserve 를 자동으로 "품질 통과 재고"로 승격하지 않는다.
//  - 최신 게이트(LATEST_GATE)로 검증된 항목만 auto_passed. 그 이전 게이트 통과분은 needs_revalidation.
//  - 완전 중복(exact)만 canonical 에 연결해 재고에서 제외한다. 숫자·표현 변형은 같은 문항군(item family)으로 묶되 반려하지 않는다.
//  - 칸 부족분은 auto_passed + 문항군 다양성으로 계산한다(낡은 통과·숫자 변형만으로는 칸이 채워지지 않는다).
export type Validation = "rejected" | "needs_revalidation" | "auto_passed" | "exact_duplicate";
/** 게시 후 검수 상태(검수 환경 게시를 막지 않는다). 오류 신고는 기존 problem_error_reports 흐름을 쓴다. */
export type ExpertStatus = "unreviewed" | "in_review" | "approved" | "issues_reported";
export type ReleaseTier = "candidate" | "review_env" | "launch";
export const LATEST_GATE = "v2-code-first-final-2026-10-08";
/** 기존(LLM 직접 생성) 후보가 재검증(독립 풀이 + 과목별 검토 + 최신 결정적 검사 + 생성기 결함 검사)을 통과했을 때의 게이트 라벨. auto_passed 로 인정하되 코드 원형 검증이 아니라는 점을 라벨로 구분한다. */
export const REVALIDATED_GATE = "v2-legacy-revalidated-2026-10-09";
export const GATE_OF_RUN: Record<string, string> = { run1: "v1-llm-generated-2026-10-07", run2: LATEST_GATE, run2bc: LATEST_GATE, "s1a-final": LATEST_GATE, "v1ab-final": LATEST_GATE };
export const VARIANT_CAP = 2; // 한 문항군이 칸 채움에 기여하는 최대 문항 수(원본 + 변형 1)
export type RawCand = {
  candidateKey: string; cellId: string; apSubjectCode: string; kind: "mc" | "frq_bundle"; keywordCode: string; unitCode: string; skillPrimary: string; structure: string; calculator: string;
  reviewState: string; reserve: boolean; rejectionReason: string | null; difficultyProvisional: string | null; archetype?: string; payload: Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
};
export type HistoryEntry = { run: string; gateVersion: string; outcome: "passed" | "rejected"; reasons: string | null };
export type StockItem = RawCand & {
  run: string; stockKey: string; pipeline: "llm_v1" | "code_first_v2"; validation: Validation; gateVersion: string; expertStatus: ExpertStatus; releaseTier: ReleaseTier; renderVerified: boolean; screenVerified: boolean; reviewEnvReady: boolean;
  selectedForSample: boolean; legacyReserve: boolean; family: string; itemFamilyId: string; canonicalKey: string | null; duplicateOf: string | null; duplicateReason: string | null;
  contentKey: string; sharedWith: string[]; stockCell: string; history: HistoryEntry[];
};
export const SUBJECT_FAMILY: Record<string, string> = { ap_calculus_ab: "calculus", ap_calculus_bc: "calculus" };
export const familyOf = (subject: string) => SUBJECT_FAMILY[subject] ?? subject;
const norm = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();
const optText = (o: unknown) => (typeof o === "string" ? o : (o as { text?: string })?.text ?? "");

/** 정규화된 내용 서명(보기 순서와 무관). exact 중복 판정에만 쓴다. */
export function contentSignature(c: Pick<RawCand, "kind" | "payload">): string {
  const p = c.payload;
  if (c.kind === "mc") {
    const items = Array.isArray(p.items) ? (p.items as any[]) : [p]; // eslint-disable-line @typescript-eslint/no-explicit-any
    return norm(items.map((it) => `${it.stem ?? ""}|${((it.options as unknown[]) ?? []).map(optText).map(norm).sort().join("~")}`).join("##") + "|" + JSON.stringify(p.stimulus?.data ?? {}));
  }
  return norm(`${p.title ?? ""}|${((p.parts as any[]) ?? []).map((x) => x.prompt).join("|")}|${JSON.stringify(p.stimulus?.data ?? {})}`); // eslint-disable-line @typescript-eslint/no-explicit-any
}
export const shingleSet = (s: string) => { const t = norm(s).replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(Boolean); const o = new Set<string>(); for (let i = 0; i + 2 < t.length; i++) o.add(t.slice(i, i + 3).join(" ")); return o; };
export const jaccard = (a: Set<string>, b: Set<string>) => { let i = 0; a.forEach((x) => b.has(x) && i++); const u = a.size + b.size - i; return u ? i / u : 0; };
export const VARIANT_SIM = 0.8; // 이 이상이면 "변형"(같은 문항군). 반려 사유가 아니다.

export const pipelineOf = (c: RawCand): "llm_v1" | "code_first_v2" => (c.archetype ? "code_first_v2" : "llm_v1");
export const calcFlag = (c: RawCand) => (c.calculator === "required" || c.calculator === "not_allowed" ? c.calculator : "na");
export const stockCell = (c: RawCand) => `${c.apSubjectCode}|${c.keywordCode}|${c.skillPrimary}|${c.structure}|${calcFlag(c)}`;
export const contentKeyOf = (c: RawCand) => `${familyOf(c.apSubjectCode)}:${c.keywordCode}`;

const rank = (c: StockItem) => [c.validation === "auto_passed" ? 0 : 1, c.pipeline === "code_first_v2" ? 0 : 1, c.difficultyProvisional === "exam_prep" ? 0 : 1, c.stockKey] as const;
const cmp = (a: StockItem, b: StockItem) => { const x = rank(a), y = rank(b); for (let i = 0; i < 4; i++) if (x[i] !== y[i]) return x[i] < y[i] ? -1 : 1; return 0; };

export type BuildOpts = { history?: Record<string, HistoryEntry[]>; expert?: Record<string, ExpertStatus>; rendered?: Set<string>; screened?: Set<string>; historyKey?: (c: RawCand) => string };
/** 모든 런을 하나의 재고로 합친다. 같은 문항 내용은 canonical 하나만 남기고(exact), 변형은 문항군으로 묶는다. AB 재고는 BC 에 공유 태깅(같은 content_key). */
export function buildStock(runs: Record<string, RawCand[]>, opts: BuildOpts = {}): StockItem[] {
  const items: StockItem[] = [];
  for (const [run, list] of Object.entries(runs)) for (const c of list) {
    const gate = (c as { gateOverride?: string }).gateOverride ?? GATE_OF_RUN[run] ?? run; const passedOwn = !c.rejectionReason;
    const validation: Validation = !passedOwn ? "rejected" : gate === LATEST_GATE || gate === REVALIDATED_GATE ? "auto_passed" : "needs_revalidation";
    const sampled = passedOwn && !c.reserve;
    items.push({ ...c, run, stockKey: `${run}:${c.candidateKey}`, pipeline: pipelineOf(c), validation, gateVersion: gate, expertStatus: opts.expert?.[`${run}:${c.candidateKey}`] ?? "unreviewed", releaseTier: "candidate", renderVerified: Boolean(opts.rendered?.has(`${run}:${c.candidateKey}`)), screenVerified: Boolean(opts.screened?.has(`${run}:${c.candidateKey}`)), reviewEnvReady: false,
      selectedForSample: sampled, legacyReserve: passedOwn && Boolean(c.reserve), family: familyOf(c.apSubjectCode), itemFamilyId: "", canonicalKey: null, duplicateOf: null, duplicateReason: null, contentKey: contentKeyOf(c), sharedWith: [], stockCell: stockCell(c),
      history: [...(opts.history?.[opts.historyKey ? opts.historyKey(c) : `${run}:${c.candidateKey}`] ?? []), { run, gateVersion: gate, outcome: passedOwn ? "passed" : "rejected", reasons: c.rejectionReason }] });
  }
  // exact 중복: 반려 아닌 항목끼리, 같은 과목 군·종류에서 서명이 같으면 canonical 하나만 유지
  const live = items.filter((i) => i.validation !== "rejected").sort(cmp);
  const bySig = new Map<string, StockItem>();
  for (const it of live) {
    const k = `${it.family}|${it.kind}|${contentSignature(it)}`; const can = bySig.get(k);
    if (!can) { bySig.set(k, it); it.canonicalKey = it.stockKey; continue; }
    it.validation = "exact_duplicate"; it.duplicateOf = can.stockKey; it.canonicalKey = can.stockKey; it.duplicateReason = `exact content match with ${can.stockKey}`; it.selectedForSample = false; it.legacyReserve = false;
    if (can.apSubjectCode !== it.apSubjectCode && !can.sharedWith.includes(it.apSubjectCode)) can.sharedWith.push(it.apSubjectCode);
  }
  // 문항군(변형 묶음): 같은 원형+토픽(코드 템플릿의 숫자 변형) 또는 문장 3-gram 유사(>0.8). 반려하지 않는다.
  const stock = items.filter((i) => i.validation === "auto_passed" || i.validation === "needs_revalidation");
  const parent = new Map(stock.map((i) => [i.stockKey, i.stockKey])); const find = (k: string): string => { let r = k; while (parent.get(r) !== r) r = parent.get(r)!; parent.set(k, r); return r; };
  const union = (a: string, b: string) => { const ra = find(a), rb = find(b); if (ra !== rb) parent.set(rb < ra ? ra : rb, rb < ra ? rb : ra); };
  const tmpl = new Map<string, string>();
  const sh = new Map(stock.map((i) => [i.stockKey, shingleSet(contentSignature(i))]));
  for (const it of stock) { if (it.archetype) { const k = `${it.family}|${it.archetype}|${it.keywordCode}|${it.kind}`; const f = tmpl.get(k); if (f) union(f, it.stockKey); else tmpl.set(k, it.stockKey); } }
  for (let a = 0; a < stock.length; a++) for (let b = a + 1; b < stock.length; b++) { const x = stock[a], y = stock[b]; if (x.family === y.family && x.kind === y.kind && x.keywordCode === y.keywordCode && jaccard(sh.get(x.stockKey)!, sh.get(y.stockKey)!) > VARIANT_SIM) union(x.stockKey, y.stockKey); }
  for (const it of stock) it.itemFamilyId = `fam:${find(it.stockKey)}`;
  for (const it of items) if (it.validation === "exact_duplicate") it.itemFamilyId = items.find((c) => c.stockKey === it.duplicateOf)?.itemFamilyId ?? "";
  // AB 재고는 BC 에도 쓸 수 있다(공통 content_key). 한 번만 센다(canonical 소유 과목).
  for (const it of items) if ((it.validation === "auto_passed" || it.validation === "needs_revalidation") && it.apSubjectCode === "ap_calculus_ab" && !it.sharedWith.includes("ap_calculus_bc")) it.sharedWith.push("ap_calculus_bc");
  // 검수 환경 게시 가능 = 최신 게이트 통과 + 그래프 렌더링 + 학생 화면 검증. 전문가 승인은 게시 후 상태이며 게이트가 아니다.
  for (const it of items) it.reviewEnvReady = it.validation === "auto_passed" && it.renderVerified && it.screenVerified;
  return items;
}

export type CellRow = { cell: string; subject: string; keyword: string; skill: string; structure: string; calculator: string; autoPassed: number; families: number; effective: number; needsRevalidation: number };
/** 칸 = 토픽 × 주 스킬 × 구조 × 계산기. 채움(effective) = 최신 게이트 통과(auto_passed) 문항군별 min(문항 수, VARIANT_CAP). */
export function cellCounts(items: StockItem[], includeShared = true): CellRow[] {
  type Acc = CellRow & { famCount: Map<string, number> };
  const m = new Map<string, Acc>();
  const touch = (it: StockItem, subject: string) => { const key = `${subject}|${it.keywordCode}|${it.skillPrimary}|${it.structure}|${calcFlag(it)}`; let r = m.get(key); if (!r) { r = { cell: key, subject, keyword: it.keywordCode, skill: it.skillPrimary, structure: it.structure, calculator: calcFlag(it), autoPassed: 0, families: 0, effective: 0, needsRevalidation: 0, famCount: new Map() }; m.set(key, r); } return r; };
  for (const it of items) {
    if (it.validation !== "auto_passed" && it.validation !== "needs_revalidation") continue;
    for (const s of [it.apSubjectCode, ...(includeShared ? it.sharedWith : [])]) { const r = touch(it, s); if (it.validation === "needs_revalidation") { r.needsRevalidation += 1; continue; } r.autoPassed += 1; r.famCount.set(it.itemFamilyId, (r.famCount.get(it.itemFamilyId) ?? 0) + 1); }
  }
  return [...m.values()].map(({ famCount, ...r }) => ({ ...r, families: famCount.size, effective: [...famCount.values()].reduce((a, n) => a + Math.min(n, VARIANT_CAP), 0) }));
}
export type Summary = { subject: string; kind: string; totalRows: number; rejected: number; exactDuplicates: number; itemFamilies: number; needsRevalidation: number; autoPassed: number; reviewEnvReady: number; inReviewEnv: number; expertApproved: number; issuesReported: number; selectedForSample: number; legacyReserve: number; sharedIn: number };
/** 과목 × 종류별 집계. AB→BC 공유 문항은 소유 과목(AB)에서 한 번만 센다(sharedIn 은 BC 가 쓸 수 있는 AB 문항 수, 합산 제외). */
export function summarize(items: StockItem[]): Summary[] {
  const rows = new Map<string, Summary>(); const get = (s: string, k: string) => { const key = `${s}|${k}`; let r = rows.get(key); if (!r) { r = { subject: s, kind: k, totalRows: 0, rejected: 0, exactDuplicates: 0, itemFamilies: 0, needsRevalidation: 0, autoPassed: 0, reviewEnvReady: 0, inReviewEnv: 0, expertApproved: 0, issuesReported: 0, selectedForSample: 0, legacyReserve: 0, sharedIn: 0 }; rows.set(key, r); } return r; };
  const fams = new Map<string, Set<string>>();
  for (const it of items) {
    const r = get(it.apSubjectCode, it.kind); r.totalRows += 1;
    if (it.validation === "rejected") r.rejected += 1; else if (it.validation === "exact_duplicate") r.exactDuplicates += 1;
    else { if (it.validation === "needs_revalidation") r.needsRevalidation += 1; else { r.autoPassed += 1; if (it.expertStatus === "approved") r.expertApproved += 1; if (it.expertStatus === "issues_reported") r.issuesReported += 1; if (it.reviewEnvReady) r.reviewEnvReady += 1; if (it.releaseTier !== "candidate") r.inReviewEnv += 1; }
      const k = `${it.apSubjectCode}|${it.kind}`; (fams.get(k) ?? fams.set(k, new Set()).get(k)!).add(it.itemFamilyId);
      if (it.selectedForSample) r.selectedForSample += 1; if (it.legacyReserve) r.legacyReserve += 1;
      for (const s of it.sharedWith) get(s, it.kind).sharedIn += 1; }
  }
  for (const [k, set] of fams) { const [s, kind] = k.split("|"); get(s, kind).itemFamilies = set.size; }
  return [...rows.values()].sort((a, b) => a.subject.localeCompare(b.subject) || a.kind.localeCompare(b.kind));
}
/** 토픽 단위 목표: 과목 MC 목표를 공식 단원 MC 비중(중앙값)으로 단원에 나누고, 단원 안에서 범위 내 토픽에 균등 배분(최대잔여법). */
export function topicTargets(units: { code: string; topics: { code: string; scope: string }[] }[], unitWeights: Record<string, [number | null, number | null]>, total: number, subject: string): Record<string, number> {
  const inScope = (t: { scope: string }) => (subject === "ap_calculus_ab" ? t.scope !== "bc_only" : true);
  const w = units.map((u) => { const r = unitWeights[u.code]; return r ? ((r[0] ?? 0) + (r[1] ?? r[0] ?? 0)) / 2 : 1; });
  const lr = (ws: number[], n: number) => { const s = ws.reduce((a, b) => a + b, 0) || 1; const raw = ws.map((x) => (x / s) * n); const base = raw.map(Math.floor); let left = n - base.reduce((a, b) => a + b, 0); raw.map((r, i) => [r - Math.floor(r), i] as const).sort((a, b) => b[0] - a[0]).forEach(([, i]) => { if (left-- > 0) base[i] += 1; }); return base; };
  const perUnit = lr(w, total); const out: Record<string, number> = {};
  units.forEach((u, ui) => { const ts = u.topics.filter(inScope); if (!ts.length) return; lr(ts.map(() => 1), perUnit[ui]).forEach((n, i) => (out[ts[i].code] = n)); });
  return out;
}
export const shortfall = (target: number, effective: number) => Math.max(0, target - effective);
