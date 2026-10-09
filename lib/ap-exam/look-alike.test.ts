import { describe, expect, it } from "vitest";
import { clusterLookAlikes, lookAlikeReason, type LookAlikeInput } from "./look-alike";
const mk = (key: string, o: Partial<LookAlikeInput>): LookAlikeInput => ({ key, family: `fam:${key}`, topic: "4.6", stimKind: "none", stem: "x", ...o });
describe("look-alike", () => {
  it("숫자·함수만 다른 같은 문장 틀은 문항군 ID 가 달라도 같은 군으로 센다", () => {
    const a = mk("a", { stem: "Let $f(x)=\\sqrt{x}$. The tangent at $x=25$ is used to approximate $f(26)$." }), b = mk("b", { stem: "Let $f(x)=\\sqrt{x}$. The tangent at $x=49$ is used to approximate $f(50)$." });
    expect(lookAlikeReason(a, b)).toBe("template");
  });
  it("같은 개념이라도 표현·질문이 다르면 look-alike 가 아니다", () => {
    const a = mk("a", { topic: "6.4", stimKind: "graph", stem: "The graph of $f$ is shown. Let $g(x)=4+\\int_0^x f$. What is $g(6)$?" }), b = mk("b", { topic: "8.2", stimKind: "graph", stem: "A cyclist's velocity is shown. What is her position at $t=6$?" });
    expect(lookAlikeReason(a, b)).toBeNull();
  });
  it("군집은 연결 요소로 묶고 대표 군 ID 를 돌려준다", () => {
    const r = clusterLookAlikes([mk("a", { family: "F" }), mk("b", { family: "F" }), mk("c", { stem: "other" })]);
    expect(r.clusters).toHaveLength(1); expect(r.effectiveFamily.get("a")).toBe(r.effectiveFamily.get("b")); expect(r.effectiveFamily.get("c")).not.toBe(r.effectiveFamily.get("a"));
  });
});
