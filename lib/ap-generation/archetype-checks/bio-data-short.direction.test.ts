import { describe, expect, it } from "vitest";
import { bioDataShortDesignChecks } from "./bio-data-short";
const D = (hot: boolean, ans: string) => ({ parts: [{ label: "D", concept_needed: true, prompt: hot ? "lower at 70 °C than at 37 °C." : "lower at 10 °C than at 37 °C.", model_answer: ans, rubric_rows: [] }] });
const dir = (p: object) => bioDataShortDesignChecks(p as never).filter((x) => x.code.includes("temp_direction"));
describe("temperature direction", () => {
  it("hot level with too-cold mechanism is flagged", () => expect(dir(D(true, "too cold: fewer effective collisions"))).toHaveLength(1));
  it("hot level with denaturation passes", () => expect(dir(D(true, "heat causes denaturation"))).toHaveLength(0));
  it("cold level with denaturation is flagged", () => expect(dir(D(false, "denaturation of the enzyme"))).toHaveLength(1));
  it("cold level with collisions passes", () => expect(dir(D(false, "fewer effective collisions"))).toHaveLength(0));
});
