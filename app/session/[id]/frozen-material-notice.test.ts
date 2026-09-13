import { describe, expect, it } from "vitest";
import { frozenMaterialNotice } from "./material-data";

// 지시 1번 — 고정 자료가 없다고 "당시 자료가 없었다"고 단정할 수 없다.
// 실제로 자료 없이 시작한 수업과 기록을 확인할 수 없는 수업은 다르다.
describe("과거 수업의 고정 교재 표시", () => {
  it("시작 전 수업에는 아무 말도 덧붙이지 않는다", () => {
    expect(frozenMaterialNotice("prep", "no_freeze_record")).toBeNull();
  });

  it("교재가 고정된 수업에는 아무 말도 덧붙이지 않는다", () => {
    expect(frozenMaterialNotice("completed", "frozen_with_materials")).toBeNull();
  });

  it("문제만 있는 수업은 오류가 아니다 — 교재가 없다고만 말한다", () => {
    expect(frozenMaterialNotice("completed", "frozen_without_materials")).toBe(
      "이 수업에는 고정된 교재가 없습니다. 문제만으로 진행한 수업일 수 있습니다."
    );
  });

  it("고정 기록이 없으면 '없었다'가 아니라 '확인할 수 없다'고 말한다", () => {
    expect(frozenMaterialNotice("live", "no_freeze_record")).toBe(
      "이 수업의 고정된 교재 구성을 확인할 수 없습니다."
    );
    expect(frozenMaterialNotice("completed", "no_freeze_record")).toBe(
      "이 수업의 고정된 교재 구성을 확인할 수 없습니다."
    );
  });
});
