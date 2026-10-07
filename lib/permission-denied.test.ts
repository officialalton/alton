import { describe, expect, it } from "vitest";
import { emptyOnPermissionDenied, isPermissionDeniedError } from "./permission-denied";

describe("emptyOnPermissionDenied", () => {
  it("권한 거부는 fallback 으로 낮춘다", async () => {
    const r = await emptyOnPermissionDenied(Promise.reject(new Error("이 학생의 모의고사 기록을 볼 권한이 없습니다.")), [] as string[]);
    expect(r).toEqual([]);
  });
  it("정상 값은 그대로", async () => {
    expect(await emptyOnPermissionDenied(Promise.resolve([1]), [] as number[])).toEqual([1]);
  });
  it("다른 오류는 다시 던진다", async () => {
    await expect(emptyOnPermissionDenied(Promise.reject(new Error("connection reset")), [])).rejects.toThrow("connection reset");
  });
  it("판별", () => {
    expect(isPermissionDeniedError(new Error("이 학생의 과제를 볼 권한이 없습니다."))).toBe(true);
    expect(isPermissionDeniedError(new Error("You do not have permission to view this student's homework."))).toBe(true);
    expect(isPermissionDeniedError(new Error("boom"))).toBe(false);
    expect(isPermissionDeniedError(null)).toBe(false);
  });
});
