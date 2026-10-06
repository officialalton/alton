import { describe, expect, it } from "vitest";
import { CONSULT_STAGES, consultStageLabel } from "./consult-stage";
import { factsFromRpcRows, type FactsRpcRow } from "./facts";
import { buildScorePoints, estimateAttempt } from "@/lib/mock-exam/score-aggregate";

const row = (o: Partial<FactsRpcRow> = {}): FactsRpcRow => ({
  attempt_id: "a1", exam_name: "Set", exam_track: "sat", ap_subject: null, difficulty_tier: "standard", format: "mst",
  status: "graded", started_at: "2026-10-01T00:00:00Z", submitted_at: null, graded_at: "2026-10-01T02:00:00Z", attempt_seq: 1, score_adjusted: false,
  rw_total: 6, rw_correct: 5, rw_complete: true, rw_route: "higher", math_total: 4, math_correct: 4, math_complete: true, math_route: "higher", ...o,
});

describe("factsFromRpcRows", () => {
  it("RPC 행을 공유 모듈 입력으로 변환(경로·섹션·재응시 순번)", () => {
    const [f] = factsFromRpcRows([row({ attempt_seq: 2, math_route: "lower" })]);
    expect(f).toMatchObject({ attemptId: "a1", track: "sat", format: "mst", attemptSeq: 2 });
    expect(f.sections.math).toMatchObject({ total: 4, route: "lower" });
  });
  it("graded MST 는 점수 범위, 진행 중·고정형은 점수 없음(0 아님)", () => {
    expect(buildScorePoints(factsFromRpcRows([row()]))).toHaveLength(1);
    expect(estimateAttempt(factsFromRpcRows([row({ status: "in_progress", graded_at: null, rw_correct: null, rw_complete: false })])[0]).reason).toBe("not_graded");
    expect(estimateAttempt(factsFromRpcRows([row({ format: "fixed" })])[0]).reason).toBe("no_estimate_fixed");
  });
  it("알 수 없는 경로 문자열은 null", () => {
    expect(factsFromRpcRows([row({ rw_route: "weird" })])[0].sections.rw.route).toBeNull();
  });
});

describe("consult stage labels", () => {
  it("모든 단계에 영어 라벨이 있다", () => {
    for (const s of CONSULT_STAGES) expect(consultStageLabel(s)).not.toBe(s);
    expect(consultStageLabel("converted")).toBe("Converted to Tutoring");
    expect(consultStageLabel("unknown_x")).toBe("unknown_x");
  });
});
