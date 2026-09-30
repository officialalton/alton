import { describe, expect, it } from "vitest";
import { decideRoute, describePolicy, selectPolicyForAttempt, type RoutingPolicy } from "./routing";

// 임계값은 테스트 안에서 정책 객체로 주입한다(코드에 기본값 없음). DB 함수 _mock_exam_route_m2 와 같은 판정.
const ratio = (v: number) => ({ thresholdType: "correct_ratio" as const, thresholdValue: v });
const count = (v: number) => ({ thresholdType: "correct_count" as const, thresholdValue: v });

describe("decideRoute — correct_ratio", () => {
  it("R&W 27문항, 0.65: 17개는 lower, 18개는 higher(17.55 이상)", () => {
    expect(decideRoute(ratio(0.65), 17, 27)).toBe("lower");
    expect(decideRoute(ratio(0.65), 18, 27)).toBe("higher");
  });
  it("Math 22문항, 0.65: 14개는 lower, 15개는 higher(14.3 이상)", () => {
    expect(decideRoute(ratio(0.65), 14, 22)).toBe("lower");
    expect(decideRoute(ratio(0.65), 15, 22)).toBe("higher");
  });
  it("R&W 27문항, 0.70(오너 확정): 18개는 lower, 19개는 higher(18.9 이상)", () => {
    expect(decideRoute(ratio(0.7), 18, 27)).toBe("lower");
    expect(decideRoute(ratio(0.7), 19, 27)).toBe("higher");
  });
  it("Math 22문항, 0.70(오너 확정): 15개는 lower, 16개는 higher(15.4 이상)", () => {
    expect(decideRoute(ratio(0.7), 15, 22)).toBe("lower");
    expect(decideRoute(ratio(0.7), 16, 22)).toBe("higher");
  });
  it("정확히 임계값과 같으면 higher(이상): 20문항에서 13개 = 0.65", () => {
    expect(decideRoute(ratio(0.65), 13, 20)).toBe("higher");
    expect(decideRoute(ratio(0.65), 12, 20)).toBe("lower");
  });
  it("0 정답·만점·경계 0/1", () => {
    expect(decideRoute(ratio(0.65), 0, 27)).toBe("lower");
    expect(decideRoute(ratio(0.65), 27, 27)).toBe("higher");
    expect(decideRoute(ratio(0), 0, 27)).toBe("higher");
    expect(decideRoute(ratio(1), 26, 27)).toBe("lower");
    expect(decideRoute(ratio(1), 27, 27)).toBe("higher");
  });
  it("문항이 0개면 lower", () => {
    expect(decideRoute(ratio(0), 0, 0)).toBe("lower");
  });
});

describe("decideRoute — correct_count", () => {
  it("정답 수가 임계값 이상이면 higher", () => {
    expect(decideRoute(count(15), 14, 22)).toBe("lower");
    expect(decideRoute(count(15), 15, 22)).toBe("higher");
    expect(decideRoute(count(15), 22, 22)).toBe("higher");
  });
  it("문항 수와 무관", () => {
    expect(decideRoute(count(10), 10, 27)).toBe("higher");
    expect(decideRoute(count(10), 9, 5)).toBe("lower");
  });
});

describe("selectPolicyForAttempt — 정책 버전 변경은 새 응시에만", () => {
  const v1: RoutingPolicy = { section: "rw", thresholdType: "correct_ratio", thresholdValue: 0.65, version: 1, active: false };
  const v2: RoutingPolicy = { section: "rw", thresholdType: "correct_ratio", thresholdValue: 0.8, version: 2, active: true };
  const mathV1: RoutingPolicy = { section: "math", thresholdType: "correct_ratio", thresholdValue: 0.5, version: 1, active: true };
  const all = [v1, v2, mathV1];

  it("시작 때 고정된 버전이 있으면 이후 활성이 바뀌어도 그 정책을 쓴다", () => {
    const pinned = selectPolicyForAttempt(all, "rw", 1);
    expect(pinned?.version).toBe(1);
    expect(decideRoute(pinned!, 18, 27)).toBe("higher"); // 0.65 기준
    const fresh = selectPolicyForAttempt(all, "rw", null);
    expect(fresh?.version).toBe(2);
    expect(decideRoute(fresh!, 18, 27)).toBe("lower"); // 0.8 기준
  });
  it("고정 버전이 없어졌거나 없으면 활성으로, 섹션은 섞이지 않는다", () => {
    expect(selectPolicyForAttempt(all, "rw", 99)?.version).toBe(2);
    expect(selectPolicyForAttempt(all, "math", null)?.thresholdValue).toBe(0.5);
    expect(selectPolicyForAttempt([], "rw", null)).toBeNull();
  });
});

describe("describePolicy", () => {
  it("표시용 문구", () => {
    expect(describePolicy({ section: "rw", thresholdType: "correct_ratio", thresholdValue: 0.65, version: 1, active: true })).toContain("65%");
    expect(describePolicy({ section: "math", thresholdType: "correct_count", thresholdValue: 15, version: 1, active: true })).toContain("15개");
  });
});
