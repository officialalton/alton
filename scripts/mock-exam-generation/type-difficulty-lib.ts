// 문항 유형 × 난이도 커버리지 점검의 순수 집계 로직(IO·생성기 없음). 단위 테스트 대상.
export type Diff = "easy" | "medium" | "hard";
export const DIFFS: Diff[] = ["easy", "medium", "hard"];
export type CellStatus = "OK" | "WEAK" | "EMPTY";
export const WEAK_BELOW = 3;

/** 생성기 시도 한 건(원형 하나·시드 하나). source: 원형 레지스트리 / lite(easy·medium 틀) / compiler(계산형 컴파일러). */
export type Attempt = {
  source: "archetype" | "lite" | "compiler"; archetypeId: string; difficulty: Diff;
  outcome: "produced" | "genfail" | "throw" | "verifyfail"; qaFail?: boolean; variant?: string; shingles?: Set<string>;
};
export type GenCell = {
  archetypes: number; attempts: number; produced: number; genFail: number; thrown: number; verifyFail: number; qaFail: number;
  variants: number; independent: number; bySource: Record<string, number>; status: CellStatus; reasons: string[];
};

export const jaccard = (a: Set<string>, b: Set<string>) => { if (!a.size || !b.size) return 0; let x = 0; for (const v of a) if (b.has(v)) x++; return x / (a.size + b.size - x); };
/** 본문 유사도 0.6 미만만 독립으로 센다(탐욕). */
export function independentCount(sets: Set<string>[], threshold = 0.6): number {
  const keep: Set<string>[] = []; for (const s of sets) if (keep.every((k) => jaccard(k, s) < threshold)) keep.push(s); return keep.length;
}

export function classifyGen(c: Omit<GenCell, "status" | "reasons">): { status: CellStatus; reasons: string[] } {
  const reasons: string[] = [];
  if (c.archetypes === 0 && c.attempts === 0) return { status: "EMPTY", reasons: ["생성기 없음(원형·틀·컴파일러 모두 해당 난이도 없음)"] };
  if (c.produced === 0) return { status: "EMPTY", reasons: [`산출 0(시도 ${c.attempts}: genfail ${c.genFail}·throw ${c.thrown}·검증실패 ${c.verifyFail})`] };
  if (c.verifyFail || c.thrown) reasons.push(`검증실패 ${c.verifyFail}·예외 ${c.thrown}`);
  if (c.qaFail) reasons.push(`렌더 구조검사 실패 ${c.qaFail}`);
  if (c.independent < WEAK_BELOW) reasons.push(`독립 변형 ${c.independent} < ${WEAK_BELOW}`);
  return { status: reasons.length ? "WEAK" : "OK", reasons };
}

export function aggregateGen(attempts: Attempt[], archetypeIds: Set<string>): GenCell {
  const c = { archetypes: archetypeIds.size, attempts: attempts.length, produced: 0, genFail: 0, thrown: 0, verifyFail: 0, qaFail: 0, variants: 0, independent: 0, bySource: {} as Record<string, number> };
  const vars = new Set<string>(); const sh: Set<string>[] = [];
  for (const a of attempts) {
    if (a.outcome === "genfail") c.genFail++; else if (a.outcome === "throw") c.thrown++; else if (a.outcome === "verifyfail") c.verifyFail++;
    else { c.produced++; c.bySource[a.source] = (c.bySource[a.source] ?? 0) + 1; if (a.variant) vars.add(`${a.archetypeId}/${a.variant}`); if (a.shingles) sh.push(a.shingles); if (a.qaFail) c.qaFail++; }
  }
  c.variants = vars.size; c.independent = independentCount(sh);
  return { ...c, ...classifyGen(c) };
}

/* ---- 은행 집계 ---- */
export type BankProblem = { id: string; skill_code: string; difficulty: string | null; status: string; usage_scope: string | null; archived_at: string | null; published_version_id: string | null };
export type BankVersion = { id: string; problem_id: string; explanation_en: string | null };
export type BankSetItem = { exam_set_id: string; problem_id: string };
export type BankSet = { id: string; status: string; archived_at: string | null };
export type BankCell = { live: number; published: number; explEnOk: number; explEnMissing: number; mockScope: number; exposedInSets: number; status: CellStatus; reasons: string[] };

/** 게시 = 보관되지 않은 문항 중 published_version_id 가 있는 것. 노출 = 게시된(비보관) 모의고사 세트의 문항에 들어간 문항. */
export function aggregateBank(problems: BankProblem[], versions: BankVersion[], sets: BankSet[], items: BankSetItem[]): Map<string, BankCell> {
  const verById = new Map(versions.map((v) => [v.id, v]));
  const liveSets = new Set(sets.filter((s) => s.status === "published" && !s.archived_at).map((s) => s.id));
  const exposed = new Set(items.filter((i) => liveSets.has(i.exam_set_id)).map((i) => i.problem_id));
  const out = new Map<string, BankCell>();
  for (const p of problems) {
    if (p.archived_at || !p.difficulty) continue;
    const key = `${p.skill_code}|${p.difficulty}`;
    const c = out.get(key) ?? { live: 0, published: 0, explEnOk: 0, explEnMissing: 0, mockScope: 0, exposedInSets: 0, status: "EMPTY" as CellStatus, reasons: [] };
    c.live++;
    const v = p.published_version_id ? verById.get(p.published_version_id) : undefined;
    if (v) {
      c.published++;
      if (v.explanation_en && v.explanation_en.trim().length > 0) c.explEnOk++; else c.explEnMissing++;
      if (p.usage_scope === "mock_exam" || p.usage_scope === "both") c.mockScope++;
      if (exposed.has(p.id)) c.exposedInSets++;
    }
    out.set(key, c);
  }
  return out;
}
export function classifyBank(c: BankCell | undefined): BankCell {
  const base = c ?? { live: 0, published: 0, explEnOk: 0, explEnMissing: 0, mockScope: 0, exposedInSets: 0, status: "EMPTY" as CellStatus, reasons: [] };
  const reasons: string[] = [];
  if (base.published === 0) return { ...base, status: "EMPTY", reasons: ["게시 문항 0"] };
  if (base.published < WEAK_BELOW) reasons.push(`게시 ${base.published} < ${WEAK_BELOW}`);
  if (base.explEnMissing) reasons.push(`explanation_en 누락 ${base.explEnMissing}`);
  return { ...base, status: reasons.length ? "WEAK" : "OK", reasons };
}

export type WeakEntry = { matrix: string; id: string; difficulty: Diff; status: CellStatus; reasons: string[] };
export const collectWeak = (matrix: string, rows: { id: string; cells: Record<Diff, { status: CellStatus; reasons: string[] }> }[]): WeakEntry[] =>
  rows.flatMap((r) => DIFFS.filter((d) => r.cells[d].status !== "OK").map((d) => ({ matrix, id: r.id, difficulty: d, status: r.cells[d].status, reasons: r.cells[d].reasons })));
export const countStatus = (rows: { cells: Record<Diff, { status: CellStatus }> }[]) => {
  const t = { OK: 0, WEAK: 0, EMPTY: 0, cells: 0 }; for (const r of rows) for (const d of DIFFS) { t[r.cells[d].status]++; t.cells++; } return t;
};
