import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildCandidateRows, buildHistoryRows, parseDefectScan, planImport } from "./import-plan";
import type { StockItem } from "../ap-generation/stock";
import type { ExistingRow } from "../ap-generation/import-merge";

const items = JSON.parse(readFileSync("data/ap/stock/bc-topup-items.json", "utf-8")) as StockItem[];
const subjectIds = new Map([["ap_calculus_ab", "s-ab"], ["ap_calculus_bc", "s-bc"]]);
const rows = () => buildCandidateRows(items, { subjectIds, batchId: null, scan: parseDefectScan([]) });

describe("planImport", () => {
  it("DB 가 비어 있으면 전부 새 키 insert, 이력 행도 만든다", () => {
    const p = planImport(rows(), new Map());
    expect(p.summary.insert).toBe(items.length); expect(p.summary.update).toBe(0);
    expect(buildHistoryRows(items).length).toBeGreaterThanOrEqual(items.length);
  });
  it("재실행(이미 같은 상태)이면 insert 0 — 멱등", () => {
    const ex = new Map<string, ExistingRow>(rows().map((r) => [r.candidate_key, { candidate_key: r.candidate_key, payload: r.payload, review_state: r.review_state, render_verified: false, screen_verified: false, release_tier: "candidate", problem_id: null, purpose: null, converted_at: null, expert_status: "unreviewed" }]));
    const p = planImport(rows(), ex);
    expect(p.summary.insert).toBe(0);
  });
  it("검증·변환된 기존 행은 검증 필드를 덮어쓰지 않는다(패치에 render/screen/release_tier/problem_id 없음)", () => {
    const r0 = rows()[0];
    const ex = new Map<string, ExistingRow>([[r0.candidate_key, { candidate_key: r0.candidate_key, payload: r0.payload, review_state: "auto_passed", render_verified: true, screen_verified: true, release_tier: "review_env", problem_id: "p1", purpose: "mock_exam", converted_at: "2026-10-01", expert_status: "unreviewed" }]]);
    const p = planImport(rows(), ex);
    const m = p.results.find((x) => x.key === r0.candidate_key)!.m;
    expect(m.action).not.toBe("insert");
    for (const f of ["render_verified", "screen_verified", "release_tier", "problem_id", "purpose", "converted_at", "payload"]) expect(Object.keys(m.patch ?? {})).not.toContain(f);
  });
});
