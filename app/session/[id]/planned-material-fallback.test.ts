import { describe, expect, it } from "vitest";
import { shouldFallBackToPlannedMaterial } from "./material-data";

// 지시 3번 — "loadPinnedMaterialData 가 없을 때 planned 로 내려가는 동작이 시작 전
// 수업에만 적용되는지 확인해주세요. 시작·완료 수업이 최신 예정 구성으로 대체되면
// 안 됩니다."
describe("고정 자료가 없을 때 예정 구성으로 내려가는 조건", () => {
  it("시작 전 v3 수업에서는 예정 구성을 보여준다", () => {
    expect(shouldFallBackToPlannedMaterial("v3", "prep")).toBe(true);
  });

  it("진행 중인 수업은 최신 예정 구성으로 대체하지 않는다", () => {
    expect(shouldFallBackToPlannedMaterial("v3", "live")).toBe(false);
  });

  it("완료된 수업은 최신 예정 구성으로 대체하지 않는다", () => {
    // 고정 자료가 없는 과거 수업은 비어 있는 채로 둔다 — 없었다는 것이 사실이다.
    expect(shouldFallBackToPlannedMaterial("v3", "completed")).toBe(false);
  });

  it("레거시 수업에는 회차 예정 구성이라는 개념이 없다", () => {
    expect(shouldFallBackToPlannedMaterial("legacy", "prep")).toBe(false);
    expect(shouldFallBackToPlannedMaterial("legacy", "completed")).toBe(false);
  });
});
