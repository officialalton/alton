// 외부 AP 검수(2026-10-15) World History·US History·English Literature 수정본(audit-wuel) 정합성. DB 없이 확인한다:
//  · 수정본은 원본과 같은 칸이고 원본 payload 의 결함 문구가 없다(EXTRA 표식·표 중복·Munn/철도 혼동·수동태 오설명 등).
//  · 샘플 답안의 항목 점수 합 = 표시 점수 = 목표 점수.
//  · 교체안의 removeKey 는 현재 게시 체인(정확 배정 + 이전 교체안)에 실제로 있고 addKey 는 이 배치에 있다.
import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { STOCK_BATCHES } from "./batches";
import { parseSwapPlan } from "./new-version";

const rd = <T,>(p: string) => JSON.parse(readFileSync(p, "utf-8")) as T;
type Item = { stockKey: string; candidateKey: string; run: string; payload: any };
const items = rd<Item[]>("data/ap/stock/audit-wuel-items.json");
const by = new Map(items.map((i) => [i.stockKey, i]));
const batch = STOCK_BATCHES.find((b) => b.id === "audit-wuel")!;

const orig = new Map<string, Item>();
for (const f of readdirSync("data/ap/stock").filter((x) => /^(wh|ush|lt|englit)-.*-items\.json$/.test(x))) for (const it of rd<Item[]>(`data/ap/stock/${f}`)) orig.set(it.stockKey, it);
const origOfCopy = (copy: Item) => [...orig.values()].find((o) => o.candidateKey === copy.candidateKey && o.run !== "audit-wuel")!;

const chain = (set: string): string[] => {
  const files: Record<string, { assign: string; id: string; plans: string[] }> = {
    US1: { assign: "exact-assign-ushistory-us1-us2", id: "US1", plans: ["us1-v2-real-a", "us1-v3-real-b", "us1-v4-real-cd"].map((x) => `${x}-swap-plan`) },
    US2: { assign: "exact-assign-ushistory-us1-us2", id: "US2", plans: ["us2-v2-real-a", "us2-v3-real-b", "us2-v4-real-cd"].map((x) => `${x}-swap-plan`) },
    LT1: { assign: "exact-assign-englit-lt1-lt2", id: "LT1", plans: ["lt1-v2-real-1", "lt1-v3-real-2"].map((x) => `${x}-swap-plan`) },
    LT2: { assign: "exact-assign-englit-lt1-lt2", id: "LT2", plans: ["lt2-v2-real-1", "lt2-v3-real-2"].map((x) => `${x}-swap-plan`) },
    WH1: { assign: "exact-assign-worldhistory-wh1-wh2", id: "WH1", plans: [] },
    WH2: { assign: "exact-assign-worldhistory-wh1-wh2", id: "WH2", plans: [] },
  };
  const c = files[set]; const s = rd<{ sets: { id: string; mcA: string[]; frqA: string[] }[] }>(`data/ap/stock/${c.assign}.json`).sets.find((x) => x.id === c.id)!;
  const keys = new Set([...s.mcA, ...s.frqA]);
  for (const pl of c.plans) for (const sw of rd<{ swaps: { removeKey?: string; addKey: string }[] }>(`data/ap/stock/${pl}.json`).swaps) { if (sw.removeKey) keys.delete(sw.removeKey); keys.add(sw.addKey); }
  return [...keys];
};

describe("audit-wuel 수정본", () => {
  it("배치가 등록돼 있고 키·산출물이 일치한다", () => {
    expect(batch).toMatchObject({ itemsFile: "audit-wuel-items.json", passKeysFile: "audit-wuel-pass-keys.json", supplement: true });
    expect(rd<string[]>("data/ap/stock/audit-wuel-pass-keys.json").sort()).toEqual(items.map((i) => i.stockKey).sort());
    expect(items).toHaveLength(19);
    for (const i of items) { expect(i.run).toBe("audit-wuel"); expect(i.stockKey).toBe(`audit-wuel:${i.candidateKey}`); expect(origOfCopy(i)).toBeTruthy(); }
  });

  it("편집 표식·표 중복·사실 오류 문구가 없다", () => {
    const text = (k: string) => JSON.stringify(by.get(`audit-wuel:${k}`)!.payload);
    expect(JSON.stringify(items.map((i) => i.payload))).not.toMatch(/EXTRA/);
    for (const k of ["ap_world_history-w202-k0", "ap_world_history-w108-k0"]) { const intro = by.get(`audit-wuel:${k}`)!.payload.set_intro as string; expect(intro).not.toMatch(/^\|/m); expect(intro).toContain("The table for this source is shown below."); expect(by.get(`audit-wuel:${k}`)!.payload.stimulus.kind).toBe("table"); }
    expect(text("ap_world_history-w211-k0")).not.toContain("a few days after");
    expect(text("ap_world_history-w211-k0")).toContain("one day before Tsar Nicholas II gave up the throne");
    expect(text("ap_world_history-w205-k0")).toContain("2 feet 7 inches");
    expect(text("ap_us_history-real_a_saq3_plains-k0")).not.toContain("upheld state regulation of grain elevators and railroad rates");
    expect(text("ap_us_history-real_a_saq3_plains-k0")).toContain("grain-warehouse");
    expect(by.get("audit-wuel:ap_english_literature-real-rf2-k0")!.payload.reference_text).not.toMatch(/verb is passive|passive phrasing, "seemed"|passive wording/);
    expect(text("ap_english_literature-fa1-k0")).not.toContain("Nothing / was ever lost");
    expect(by.get("audit-wuel:ap_english_literature-real-rf3-k0")!.payload.reference_text).not.toContain("'wrongfully,' 'snarling,' 'scornfully'");
    // WH1 DBQ: 문서 근거 첫 점수 기준은 3개 설명 하나로 통일.
    expect(text("ap_world_history-wh1_dbq-k0")).not.toContain("or uses only two or three documents");
    // WH2 SAQ 1B: 1901 의정서는 범위(1839-1900) 밖이므로 1900 사건만 인정.
    expect(text("ap_world_history-wh2_saq1-k0")).toContain("dated after 1900");
  });

  it("샘플 점수: 항목 합 = 표시 점수 = 목표 점수, reference_text 머리글과 일치", () => {
    for (const i of items) for (const f of ["whap_frq", "ush_frq", "lit_frq"]) {
      const p = i.payload[f]; if (!p) continue;
      for (const s of p.samples) {
        const rows = Object.entries(s.rubric_scores as Record<string, number>).filter(([k]) => k !== "total").reduce((a, [, v]) => a + v, 0);
        expect(rows, `${i.stockKey} ${s.tier}`).toBe(s.rubric_scores.total); expect(s.target_total).toBe(s.rubric_scores.total);
        expect(i.payload.reference_text).toContain(`${s.rubric_scores.total}/${p.rubric.total_points}`);
        expect(s.word_count).toBe(s.essay.trim().split(/\s+/).length);
      }
    }
  });

  it("수정한 판정: WH DBQ 고득점 6/7·US LEQ 하위 1/6 등", () => {
    const tot = (k: string, tier: string) => { const p = by.get(`audit-wuel:${k}`)!.payload; const f = p.whap_frq ?? p.ush_frq ?? p.lit_frq; return f.samples.find((s: any) => s.tier === tier).rubric_scores.total as number; };
    expect([tot("ap_world_history-wh1_dbq-k0", "high"), tot("ap_world_history-wh2_dbq-k0", "high")]).toEqual([6, 6]);
    expect([tot("ap_world_history-wh1_dbq-k0", "low"), tot("ap_world_history-wh1_dbq-k0", "mid")]).toEqual([2, 4]);
    expect([tot("ap_world_history-wh1_leq-k0", "mid"), tot("ap_world_history-wh2_leq-k0", "mid")]).toEqual([3, 3]);
    expect([tot("ap_us_history-leq_3-k0", "mid"), tot("ap_us_history-leq_3-k0", "low"), tot("ap_us_history-leq_1-k0", "low")]).toEqual([3, 1, 1]);
    // WH1 DBQ 낮은 예시는 문서 3개(1·3·4)를 설명한다.
    const low = by.get("audit-wuel:ap_world_history-wh1_dbq-k0")!.payload.whap_frq.samples.find((s: any) => s.tier === "low").essay as string;
    expect(low).toMatch(/Document 1/); expect(low).toMatch(/Document 3/); expect(low).toMatch(/Document 4/);
    // US2 DBQ 중간 예시: 맥락(1812 이후)과 외부 근거(에리 운하)는 서로 다른 문장.
    const mid = by.get("audit-wuel:ap_us_history-real_b_dbq_market-k0")!.payload.ush_frq.samples.find((s: any) => s.tier === "mid").essay as string;
    expect(mid).toContain("After the War of 1812"); expect(mid).toContain("Erie Canal");
  });
});

describe("audit-wuel 교체안", () => {
  const plans: [string, string, number][] = [["WH1", "wh1-v2-audit-wuel-swap-plan.json", 4], ["WH2", "wh2-v2-audit-wuel-swap-plan.json", 7], ["US1", "us1-v5-audit-wuel-swap-plan.json", 1], ["US2", "us2-v5-audit-wuel-swap-plan.json", 3], ["LT1", "lt1-v4-audit-wuel-swap-plan.json", 1], ["LT2", "lt2-v4-audit-wuel-swap-plan.json", 3]];
  for (const [set, file, n] of plans) {
    it(`${set}: removeKey 가 현재 체인에 있고 addKey 가 배치에 있다`, () => {
      const p = parseSwapPlan(rd(`data/ap/stock/${file}`)); expect(p.set).toBe(set); expect(p.swaps).toHaveLength(n);
      expect((rd<{ verifierViolations: string[] }>(`data/ap/stock/${file}`)).verifierViolations).toEqual([]);
      const cur = new Set(chain(set));
      for (const s of p.swaps) { expect(cur.has(s.removeKey!), `${set} ${s.removeKey}`).toBe(true); expect(by.has(s.addKey), s.addKey).toBe(true); expect(s.addKey).toBe(`audit-wuel:${origOfKey(s.removeKey!).candidateKey}`); }
      expect(new Set(p.swaps.map((s) => s.removeKey)).size).toBe(n);
    });
  }
});
function origOfKey(k: string): Item { const o = orig.get(k); if (!o) throw new Error(`원본 없음 ${k}`); return o; }
