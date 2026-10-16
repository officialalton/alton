import { describe, expect, it } from "vitest";
import { contentDiffers, mergeRow, summarizeMerge, type ExistingRow, type NewRow } from "./import-merge";
const pl = { stem: "s", options: [{ text: "a" }], key_index: 0, stimulus: { kind: "none" }, cellId: "c1" };
const row = (o: Partial<NewRow> = {}): NewRow => ({ candidate_key: "k", payload: { ...pl }, review_state: "auto_passed", render_verified: false, screen_verified: false, release_tier: "candidate", expert_status: "unreviewed", rejection_reason: null, gate_version: "g2", defect_flags: [], is_current: true, ...o });
const ex = (o: Partial<ExistingRow> = {}): ExistingRow => ({ candidate_key: "k", payload: { ...pl }, review_state: "auto_passed", render_verified: false, screen_verified: false, release_tier: "candidate", problem_id: null, purpose: null, converted_at: null, expert_status: "unreviewed", ...o });
describe("import 병합(검증·변환 필드 보존)", () => {
  it("새 키는 전체 행을 insert", () => { const r = mergeRow(row(), null); expect(r.action).toBe("insert"); expect(r.row).toBeTruthy(); });
  it("검증된 행: render/screen/release_tier/expert_status 는 patch 에 절대 없다", () => {
    const r = mergeRow(row({ gate_version: "g3" }), ex({ render_verified: true, screen_verified: true, release_tier: "review_env" })); const keys = Object.keys(r.patch ?? {});
    for (const f of ["render_verified", "screen_verified", "release_tier", "render_evidence", "screen_evidence", "problem_id", "problem_version_id", "purpose", "converted_at", "converted_by", "expert_status"]) expect(keys).not.toContain(f);
    expect(r.flags.verified).toBe(true);
  });
  it("변환된 행의 승격(needs_revalidation→auto_passed)은 판정·게이트·사유 3필드만 갱신한다", () => {
    const r = mergeRow(row({ review_state: "auto_passed", gate_version: "g9", item_family_id: "fam:z" }), ex({ review_state: "needs_revalidation", problem_id: "p1", purpose: "mock_exam", converted_at: "t", release_tier: "review_env", render_verified: true, screen_verified: true }));
    expect(Object.keys(r.patch ?? {}).sort()).toEqual(["gate_version", "rejection_reason", "review_state"]);
  });
  it("변환된 행은 review_state 를 바꾸지 않고(강등 금지) payload·상태 필드도 건드리지 않는다", () => {
    const r = mergeRow(row({ review_state: "exact_duplicate", payload: { ...pl, stem: "changed" } }), ex({ problem_id: "p1", purpose: "mock_exam", converted_at: "t", release_tier: "review_env", render_verified: true, screen_verified: true }));
    expect(r.patch).toBeNull(); expect(r.flags.stateConflictKept).toBe(true); expect(r.flags.payloadSkipped).toBe(true); expect(r.action).toBe("preserve_only");
  });
  it("검증된(미변환) 행: 강등은 유지·보고, 같은 등급 이상은 허용", () => {
    const down = mergeRow(row({ review_state: "rejected" }), ex({ render_verified: true })); expect(down.patch?.review_state).toBeUndefined(); expect(down.flags.stateConflictKept).toBe(true);
    const same = mergeRow(row({ item_family_id: "fam:x" }), ex({ render_verified: true })); expect(same.patch?.item_family_id).toBe("fam:x");
  });
  it("재검증 승격(needs_revalidation→auto_passed)은 미검증·미변환 행에만 적용되고 payload 는 내용이 같으면 쓰지 않는다", () => {
    const r = mergeRow(row({ review_state: "auto_passed", gate_version: "v2-legacy-revalidated-2026-10-09" }), ex({ review_state: "needs_revalidation" }));
    expect(r.patch?.review_state).toBe("auto_passed"); expect(r.patch?.gate_version).toBe("v2-legacy-revalidated-2026-10-09"); expect(r.patch?.payload).toBeUndefined(); expect(r.flags.stateUpgrade).toBe(true);
  });
  it("미검증 행은 내용이 바뀌면 payload 갱신, 같으면 갱신하지 않는다", () => {
    expect(mergeRow(row({ payload: { ...pl, stem: "new" } }), ex()).patch?.payload).toBeTruthy(); expect(mergeRow(row({ payload: { ...pl, cellId: "other" } }), ex()).patch?.payload).toBeUndefined();
    expect(contentDiffers(pl, { ...pl, key_index: 1 })).toBe(true);
  });
  it("요약: 검증 보존·변환 보존·승격 건수", () => {
    const rs = [mergeRow(row(), null), mergeRow(row(), ex({ render_verified: true, screen_verified: true, release_tier: "review_env" })), mergeRow(row({ review_state: "auto_passed" }), ex({ review_state: "needs_revalidation" }))];
    const s = summarizeMerge(rs); expect(s.insert).toBe(1); expect(s.verifiedPreserved).toBe(1); expect(s.stateUpgrades).toBe(1); expect(s.upgradesOnVerifiedOrConverted).toBe(0);
  });
});
