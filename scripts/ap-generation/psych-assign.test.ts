import { describe, expect, it } from "vitest";
import { PSYCH_SET_COUNT, PSYCH_SET_SIZE } from "../../lib/ap-exam/psych-rules";
import { LIB_FRQ, LIB_SETS, LIB_SINGLES, buildPsychOrder, solvePsychSets, toReportSet, verifyPsychAssignment } from "./psych-assign";
import type { PsychItem } from "./psych-pool";

let n = 0;
const single = (e: { id: string; topic: string; skill: string }, copy: number): PsychItem => ({ key: `m${n++}`, kind: "mc", shared: false, members: [{ unit: Number(e.topic.split(".")[0]), skill: e.skill, topic: e.topic }], fam: `${e.id}|${e.topic}`, frqType: "", archetype: e.id, screen: true, batch: "t", renderType: "none", stimKind: "none", sig: `${e.id}|${copy}`, exam: 0, keyUnit: Number(e.topic.split(".")[0]) });
const set = (e: (typeof LIB_SETS)[number]): PsychItem => ({ key: `s${n++}`, kind: "mc", shared: true, members: e.members.map((m, i) => ({ unit: m.unit, skill: m.skill, topic: `${m.unit}.1#${i}` })), fam: e.id, frqType: "", archetype: e.id, screen: true, batch: "t", renderType: "none", stimKind: "none", sig: e.id, exam: 0, keyUnit: e.unit });
const frq = (e: (typeof LIB_FRQ)[number]): PsychItem => ({ key: `f${n++}`, kind: "frq", shared: false, members: [], fam: e.id, frqType: e.type, archetype: e.id, screen: true, batch: "t", renderType: "table", stimKind: "table", sig: "", exam: 0, keyUnit: 0 });
const stock = () => { n = 0; return [...LIB_SINGLES.flatMap((e) => [single(e, 0), single(e, 1)]), ...LIB_SETS.map(set), ...LIB_FRQ.map(frq)]; };

describe("psych exact assignment (ILP + independent verifier)", () => {
  it("a complete library fills two exams with no virtual items, no overlap, official ranges satisfied", () => {
    const st = stock(); const out: ReturnType<typeof solvePsychSets>["out"] = []; const bl = new Set<string>(); const blA = new Set<string>(); const blS = new Set<string>();
    for (const id of ["PS1", "PS2"]) {
      const one = solvePsychSets([id], st, { timeMs: 90000, blocked: bl, blockedArchetypes: blA, blockedSigs: blS });
      expect(one.res.status).toBe("optimal"); out.push(...one.out); const r0 = one.out[0];
      for (const it of [...r0.singles, ...r0.sets, ...r0.frq]) { bl.add(it.key); if (it.sig) blS.add(it.sig); }
      for (const a of [...r0.sets.map((c) => c.archetype), ...r0.frq.map((c) => c.archetype)]) blA.add(a);
    }
    for (const r of out) { expect(r.virtual).toEqual([]); expect(r.virtualSets).toEqual([]); expect(r.frqVirtual).toEqual([]); expect(r.sets).toHaveLength(PSYCH_SET_COUNT); expect(r.singles.length + r.sets.length * PSYCH_SET_SIZE).toBe(75); expect(r.frq).toHaveLength(2); }
    expect(verifyPsychAssignment(out)).toEqual([]);
    expect(toReportSet(out[0]).frqA).toHaveLength(2);
    expect(buildPsychOrder(out[0])).toHaveLength(75);
  }, 300000);
  it("reports missing slots as virtual items when the stock has no AAQ", () => {
    const keep = stock().filter((c) => !(c.kind === "frq" && c.frqType === "aaq")).filter((c, i) => c.kind !== "mc" || i % 3 !== 0);
    const { res, out } = solvePsychSets(["PS1"], keep, { timeMs: 60000 });
    expect(res.status).toBe("optimal"); expect(out[0].frqVirtual.map((v) => v.type)).toContain("aaq");
    expect(verifyPsychAssignment(out)).toEqual([]);
  }, 120000);
});
