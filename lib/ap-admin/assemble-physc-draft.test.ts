import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { planDraftSet, subjectOfSetIdOrNull, subjectOfSetId, SET_ID_RE, SET_PREFIX_SUBJECT, defaultDraftName, type PoolRow, type SetKeys } from "./assemble-draft";
import { STOCK_BATCHES, readAssignReport } from "./batches";
import { AP_LAYOUTS, AP_SUBJECT_NAME, apSectionLayout } from "../ap-exam/layouts";
import { loadPhysPool } from "../../scripts/ap-generation/phys-pool";
import { STOCK_FILES } from "../../scripts/ap-generation/keys-file";

// Physics C: Mechanics(PM1–PM5)·E&M(EM1–EM5): 커밋된 배정 보고서 + 커밋된 재고로, DB 없이 초안 계획(관리자 '초안 저장' 드라이런과 같은 함수)이 통과하는지 확인한다.
const SUBJECTS = [
  { prefix: "PM", subject: "ap_physics_c_mechanics", name: "AP Physics C: Mechanics", report: "exact-assign-physc-pm1-pm5.json", batch: "physc-" },
  { prefix: "EM", subject: "ap_physics_c_electricity_and_magnetism", name: "AP Physics C: Electricity and Magnetism", report: "exact-assign-physe-em1-em5.json", batch: "physe-" },
];

describe("set prefix registry (single source)", () => {
  it("PM and EM resolve to the Physics C subjects with the official display names", () => {
    for (const s of SUBJECTS) {
      for (let i = 1; i <= 5; i++) { expect(SET_ID_RE.test(`${s.prefix}${i}`)).toBe(true); expect(subjectOfSetIdOrNull(`${s.prefix}${i}`)).toBe(s.subject); }
      expect(defaultDraftName(`${s.prefix}2`)).toBe(`${s.name} — Practice Exam 2`);
    }
    expect(SET_ID_RE.test("PM")).toBe(false); expect(SET_ID_RE.test("PM12")).toBe(false); expect(SET_ID_RE.test("PX1")).toBe(false);
    expect(() => subjectOfSetId("XX1")).toThrow();
  });
  it("every prefix maps to a distinct subject that has a display name and a section layout", () => {
    const subjects = Object.values(SET_PREFIX_SUBJECT);
    expect(new Set(subjects).size).toBe(subjects.length);
    for (const [prefix, subject] of Object.entries(SET_PREFIX_SUBJECT)) { expect(prefix).toMatch(/^[A-Z]{2}$/); expect(AP_SUBJECT_NAME[subject], subject).toBeTruthy(); expect(AP_LAYOUTS[subject], subject).toBeTruthy(); }
  });
  it("a registered subject without a dedicated assembler is rejected instead of being validated with Calculus rules", () => {
    const p = planDraftSet({ setId: "PM1", keys: { mcA: [], mcB: [], frqA: [], frqB: [] }, hasVirtual: false, pool: [], existingFullSets: [], publishedKeys: new Set(), stock: [], physStock: [] } as never);
    expect(p.ok).toBe(false); expect(p.subject).toBe("ap_physics_c_mechanics");
  });
});

describe.each(SUBJECTS)("$name draft plans from the committed assignment report", (s) => {
  const rep = readAssignReport(s.report);
  const stock = loadPhysPool({ subject: s.subject }).pool;
  const by = new Map(stock.map((c) => [c.key, c]));
  const rows = (k: SetKeys): PoolRow[] => [...k.mcA, ...k.mcB, ...k.frqA, ...k.frqB].map((key, i) => {
    const c = by.get(key); const m = c && c.kind === "mc" && c.shared ? c.members.length : 1;
    return { candidate_key: key, kind: c?.kind === "mc" ? "mc" : "frq_bundle", keyword_code: c?.members[0]?.topic ?? "1.1", difficulty_provisional: "exam_prep", purpose: "mock_exam", is_current: true, render_verified: true, screen_verified: true,
      ap_candidate_problems: Array.from({ length: m }, (_, j) => ({ item_index: j, problem_id: `p${i}-${j}`, problem_version_id: `v${i}-${j}` })) };
  });

  it("the report has five sets with the subject prefix, all saveable in the admin list", () => {
    expect(rep.sets.map((x) => x.id)).toEqual([1, 2, 3, 4, 5].map((i) => `${s.prefix}${i}`));
    expect(rep.sets.every((x) => SET_ID_RE.test(x.id) && (x.virtual?.length ?? 0) + (x.frqVirtual?.length ?? 0) === 0)).toBe(true);
  });
  it.each([1, 2, 3, 4, 5])("set %i: dry-run plan is saveable (MC 42, FRQ 4, subject, default name, 2-question sets contiguous)", (i) => {
    const set = rep.sets.find((x) => x.id === `${s.prefix}${i}`)!;
    const keys: SetKeys = { mcA: set.mcA, mcB: set.mcB, frqA: set.frqA, frqB: set.frqB };
    const p = planDraftSet({ setId: set.id, keys, hasVirtual: false, pool: rows(keys), existingFullSets: [], publishedKeys: new Set(), stock: [], physStock: stock } as never);
    expect(p.problems).toEqual([]); expect(p.ok).toBe(true);
    expect(p.subject).toBe(s.subject); expect(p.name).toBe(`${s.name} — Practice Exam ${i}`);
    expect(p.composition).toMatchObject({ mcTotal: 42, frqTotal: 4 });
    expect(p.layout.sections).toEqual(apSectionLayout(s.subject));
    expect(p.items.filter((x) => x.sectionKey === "ap_mc").map((x) => x.position)).toEqual(Array.from({ length: 42 }, (_, k) => k + 1));
  });
  it("the five sets share no candidate and a second save of the same set is refused", () => {
    const all = rep.sets.flatMap((x) => [...x.mcA, ...x.mcB, ...x.frqA, ...x.frqB]); expect(new Set(all).size).toBe(all.length);
    const set = rep.sets[0]; const keys: SetKeys = { mcA: set.mcA, mcB: set.mcB, frqA: set.frqA, frqB: set.frqB };
    const first = planDraftSet({ setId: set.id, keys, hasVirtual: false, pool: rows(keys), existingFullSets: [], publishedKeys: new Set(), stock: [], physStock: stock } as never);
    const again = planDraftSet({ setId: set.id, keys, hasVirtual: false, pool: rows(keys), existingFullSets: [{ id: "x", name: first.name, status: "draft", problemIds: first.items.map((x) => x.problemId), candidateKeys: all.filter((k) => keys.mcA.includes(k) || keys.frqA.includes(k)) }], publishedKeys: new Set(), stock: [], physStock: stock } as never);
    expect(again.ok).toBe(false);
  });
  it("loads from the committed stock batches: every batch file, pass-keys file and evidence file exists and is listed in STOCK_FILES", () => {
    const bs = STOCK_BATCHES.filter((b) => b.id.startsWith(s.batch));
    expect(bs.length).toBeGreaterThan(0);
    for (const b of bs) {
      expect(existsSync(`data/ap/stock/${b.itemsFile}`), b.id).toBe(true); expect(existsSync(`data/ap/stock/${b.passKeysFile}`), b.id).toBe(true);
      expect(existsSync(`data/ap/screen-evidence/${b.evidenceFile}`), b.id).toBe(true); expect(STOCK_FILES).toContain(b.itemsFile!.replace(/\.json$/, ""));
    }
    // 보고서가 쓰는 모든 키는 어떤 배치의 통과 키에 들어 있어야 한다(적재 누락 방지).
    const passed = new Set(bs.flatMap((b) => JSON.parse(readFileSync(`data/ap/stock/${b.passKeysFile}`, "utf-8")) as string[]));
    const used = rep.sets.flatMap((x) => [...x.mcA, ...x.mcB, ...x.frqA, ...x.frqB]);
    expect(used.filter((k) => !passed.has(k))).toEqual([]);
  });
});
