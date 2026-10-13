// 외부 감사 수정 계획 테스트(순수, DB 없음). 선택지 텍스트 대응·멱등·드리프트·해설 글자 정합·빈칸 중복 검증과, 저장된 DB 스냅샷(data/audit/2026-10-13-db-readout.json)에 대한 전체 계획.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { blankJunctionIssues, formatDiff, mathDelimitersBalanced, planPatch, planSets, statedAnswerLetters, type Patch, type ProblemReadout, type SetRow, type VersionRow } from "./plan";

const ver = (over: Partial<VersionRow> = {}): VersionRow => ({
  id: "v1", version_no: 1, status: "published", passage: "Which is right?", question: null, options: ["a", "b", "c", "d"], correct_index: 1, answers: null,
  explanation: "정답은 B이다.", explanation_en: "The answer is B.", difficulty: "medium", figure: null, figure_checked: false, statements: null, render_check: { ok: true }, quality: { mockExamGeneration: { gid: "g1" } },
  evidence_target: null, evidence_span: null, answer_rationale: null, distractor_error_types: null, ...over,
});
const prob = (pub: VersionRow, over: Partial<ProblemReadout> = {}): ProblemReadout => ({
  gid: "g1", problem_id: "p1", published_version_id: pub.id, pstatus: "confirmed", pformat: "mc", usage_scope: "mock_exam", exam_system: "sat_math", skill_code: null,
  versions: [{ id: pub.id, no: 1, status: "published" }], pub,
  placements: [{ set_id: "s1", set_name: "SAT Practice Test 1", set_version: 2, set_status: "published", format: "mst", section: "math", position: 3, module_key: "math_m1", route: null, item_version_id: pub.id }], ...over,
});
const P = (changes: Patch["changes"], id = "T-1"): Patch => ({ id, gid: "g1", changes });

describe("선택지는 글자가 아니라 텍스트로 대조한다", () => {
  it("DB 순서가 패치(저장소) 순서와 달라도 같은 텍스트를 바꾸고 정답 텍스트를 지킨다", () => {
    // 저장소 순서 [x, y, z, w] / DB 순서(position-fix 후) [z, x, w, y], 정답 y
    const pub = ver({ options: ["z", "x", "w", "y"], correct_index: 3, explanation: "정답은 D이다.", explanation_en: "The answer is D." });
    const plan = planPatch(P([{ field: "options", old: ["x", "y", "z", "w"], new: ["x", "y", "z", "q"] }]), prob(pub));
    expect(plan.status).toBe("apply");
    expect(plan.args?.options).toEqual(["z", "x", "q", "y"]);
    expect(plan.args?.correct_index).toBe(3); // 정답 텍스트 y 는 그대로
  });
  it("정답 선택지를 바꾸는 패치는 새 정답 텍스트의 DB 위치로 정답 번호를 옮긴다", () => {
    const pub = ver({ options: ["z", "x", "w", "y"], correct_index: 3, explanation: "정답은 D이다.", explanation_en: "The answer is D." });
    const plan = planPatch(P([{ field: "options", old: ["x", "y", "z", "w"], new: ["x", "y2", "z", "w"] }]), prob(pub));
    expect(plan.args?.options).toEqual(["z", "x", "w", "y2"]);
    expect(plan.args?.correct_index).toBe(3);
  });
  it("이미 새 선택지 집합이면 already, 옛·새 어느 쪽도 아니면 needs_owner", () => {
    expect(planPatch(P([{ field: "options", old: ["x", "y", "z", "w"], new: ["x", "y", "z", "q"] }]), prob(ver({ options: ["q", "z", "y", "x"], correct_index: 2 }))).status).toBe("already");
    const drift = planPatch(P([{ field: "options", old: ["x", "y", "z", "w"], new: ["x", "y", "z", "q"] }]), prob(ver({ options: ["m", "n", "o", "p"] })));
    expect(drift.status).toBe("needs_owner"); expect(drift.reasons[0]).toContain("텍스트 집합");
  });
  it("선택지가 중복되면 막는다", () => {
    const plan = planPatch(P([{ field: "options", old: ["a", "b", "c", "d"], new: ["a", "b", "b", "d"] }]), prob(ver()));
    expect(plan.status).toBe("blocked"); expect(plan.reasons.join(" ")).toContain("중복");
  });
});

describe("정답 번호 변경과 해설 글자 정합", () => {
  it("correct_index 변경은 keyText 로만 정하고 옛 값과 다르면 막는다", () => {
    const pub = ver({ options: ["$x=12$", "$x=20$", "$x=10$", "$x=15$"], correct_index: 2, explanation: "정답은 C이다.", explanation_en: "The answer is C." });
    const noKey = planPatch(P([{ field: "correct_index", old: 2, new: 1 }]), prob(pub));
    expect(noKey.status).toBe("needs_owner");
    const ok = planPatch(P([{ field: "correct_index", old: 2, new: 1 }, { field: "explanation_en", old: "x", new: "So the answer is B." }, { field: "explanation", old: "정답은 C이다.", new: "정답은 B번이다." }]), prob(pub), { overrides: { "T-1": { keyText: "$x=20$" } } });
    expect(ok.status).toBe("apply"); expect(ok.args?.correct_index).toBe(1);
  });
  it("새 해설이 정답을 다른 글자로 말하면 막는다(글자 어긋남)", () => {
    const pub = ver({ options: ["a", "b", "c", "d"], correct_index: 3 });
    const plan = planPatch(P([{ field: "explanation_en", old: "The answer is B.", new: "Therefore, the correct answer is A." }]), prob(pub));
    expect(plan.status).toBe("blocked"); expect(plan.reasons.join(" ")).toContain("정답 글자는 D");
  });
  it("statedAnswerLetters 가 한·영 정답 선언을 읽는다", () => {
    expect(statedAnswerLetters("so the answer is A. Choice B changes")).toEqual(["A"]);
    expect(statedAnswerLetters("Therefore, B is correct.")).toEqual(["B"]);
    expect(statedAnswerLetters("이므로 정답은 C이다.")).toEqual(["C"]);
    expect(statedAnswerLetters("A participle is needed.")).toEqual([]);
  });
});

describe("문자열 필드: 멱등·드리프트·부분 치환", () => {
  it("지문이 옛 값과 같으면 apply, 새 값과 같으면 already, 둘 다 아니면 needs_owner", () => {
    const ch = [{ field: "passage", old: "Which is right?", new: "Which one is right?" }];
    expect(planPatch(P(ch), prob(ver())).status).toBe("apply");
    expect(planPatch(P(ch), prob(ver({ passage: "Which one is right?" }))).status).toBe("already");
    const d = planPatch(P(ch), prob(ver({ passage: "Something else" })));
    expect(d.status).toBe("needs_owner"); expect(d.reasons[0]).toContain("passage");
  });
  it("줄바꿈·앞뒤 공백 차이는 같은 값으로 본다", () => {
    expect(planPatch(P([{ field: "passage", old: "Which is right?\n", new: "X" }]), prob(ver({ passage: "Which is right?" }))).status).toBe("apply");
  });
  it("ops 치환: 정확히 한 번 있으면 바꾸고, 이미 바꿨으면 건너뛰고, 두 번이면 거부", () => {
    const pub = ver({ explanation_en: "Dates are a week ahead of the real ones. The answer is B." });
    const ch = [{ field: "explanation_en", ops: [{ from: "a week ahead of", to: "a week earlier than" }] }];
    const a = planPatch(P(ch), prob(pub)); expect(a.status).toBe("apply"); expect(a.args?.explanation_en).toBe("Dates are a week earlier than the real ones. The answer is B.");
    expect(planPatch(P(ch), prob(ver({ explanation_en: "Dates are a week earlier than the real ones. The answer is B." }))).status).toBe("already");
    expect(planPatch(P([{ field: "explanation_en", ops: [{ from: "the", to: "THE" }] }]), prob(ver({ explanation_en: "the cat the dog. The answer is B." }))).status).toBe("needs_owner");
  });
  it("영어 해설이 한글을 포함하거나 비면 막는다", () => {
    expect(planPatch(P([{ field: "explanation_en", old: "x", new: "정답은 B" }]), prob(ver())).status).toBe("blocked");
    expect(planPatch(P([{ field: "explanation_en", old: "x", new: "  " }]), prob(ver())).status).toBe("blocked");
  });
  it("수식 구분자 $ 쌍이 안 맞으면 막고, 빈칸 개수가 바뀌면 막는다", () => {
    expect(mathDelimitersBalanced("a $x$ b \\$5 c $$y$$")).toBe(true);
    expect(mathDelimitersBalanced("a $x b")).toBe(false);
    const pub = ver({ passage: "The cat ______ happily.", options: [", it", "it", "so it", "and it"] });
    expect(planPatch(P([{ field: "passage", old: "The cat ______ happily.", new: "The cat happily." }]), prob(pub)).status).toBe("blocked");
  });
});

describe("빈칸 뒤 중복(RW)", () => {
  const opts = [", the floodwaters", "and the floodwaters", "; the floodwaters", "the floodwaters"];
  it("옛 지문은 여러 단어 중복을 검출하고, 패치 지문은 깨끗하다", () => {
    const oldP = "rains fall in summer______ the floodwaters must travel slowly.";
    expect(blankJunctionIssues(oldP, opts).length).toBe(4);
    expect(blankJunctionIssues("rains fall in summer______ must travel slowly.", opts)).toEqual([]);
  });
  it("리터럴 쉼표 + 쉼표로 끝나는 선택지(이중 쉼표)를 검출한다", () => {
    expect(blankJunctionIssues("sentence. ______ , they maintain that", ["Even so,", "For example,"]).length).toBe(2);
    expect(blankJunctionIssues("sentence. ______ they maintain that", ["Even so,", "For example,"])).toEqual([]);
  });
  it("패치 후에도 중복이 남으면 blocked", () => {
    const pub = ver({ passage: "in summer______ the floodwaters must travel.", options: opts, correct_index: 2 });
    const plan = planPatch(P([{ field: "passage", old: "in summer______ the floodwaters must travel.", new: "in summer______ the floodwaters must travel far." }], "R-x"), prob(pub));
    expect(plan.status).toBe("blocked"); expect(plan.reasons.join(" ")).toContain("빈칸 뒤 중복");
  });
});

describe("진행 중 초안·미확정·없는 문항", () => {
  it("열린 초안/검수 버전이 있으면 blocked(새 버전이 아니라 그 초안을 덮어쓰기 때문)", () => {
    const pub = ver();
    expect(planPatch(P([{ field: "passage", old: "Which is right?", new: "X?" }]), prob(pub, { versions: [{ id: "v1", no: 1, status: "published" }, { id: "v2", no: 2, status: "draft" }] })).status).toBe("blocked");
  });
  it("DB 에 없으면 not_in_db, 기대 버전 id 가 다르면 needs_owner", () => {
    expect(planPatch(P([{ field: "passage", old: "a", new: "b" }]), null).status).toBe("not_in_db");
    expect(planPatch({ ...P([{ field: "passage", old: "Which is right?", new: "X?" }]), expectVersionId: "other" }, prob(ver())).status).toBe("needs_owner");
  });
  it("그림이 바뀌면 figure_checked=false 로 저장하고 render_check 를 다시 계산한다", () => {
    const fig = { type: "plane", axes: { x: { min: -10, max: 10, step: 2, title: "x" }, y: { min: -10, max: 10, step: 2, title: "y" } }, objects: [{ id: "l1", kind: "line", slope: 1, intercept: 0, label: "a" }] };
    const fig2 = { ...fig, axes: { x: { min: -20, max: 20, step: 5, title: "x" }, y: { min: -20, max: 20, step: 5, title: "y" } } };
    const pub = ver({ figure: fig, figure_checked: true, passage: "The line is shown." });
    const plan = planPatch(P([{ field: "figure", old: fig, new: fig2 }]), prob(pub));
    expect(plan.status).toBe("apply"); expect(plan.args?.figure_checked).toBe(false); expect((plan.renderCheck as { ok: boolean }).ok).toBe(true);
    expect(plan.warnings.join(" ")).toContain("figure_checked");
  });
  it("품질 메타데이터를 보존하고 auditFix 표식을 더한다", () => {
    const plan = planPatch(P([{ field: "passage", old: "Which is right?", new: "Which one is right?" }], "S-99"), prob(ver()));
    expect(plan.quality).toMatchObject({ mockExamGeneration: { gid: "g1" }, auditFix: { patch: "S-99", fromVersionId: "v1", fromVersionNo: 1 } });
    expect(plan.expect.passage).toBe("Which is right?"); expect(plan.target.passage).toBe("Which one is right?");
  });
});

describe("세트 계획", () => {
  const sets: SetRow[] = [{ id: "s1", set_group_id: "g", name: "SAT Practice Test 1", version_no: 2, status: "published", format: "mst", access_tier: "free", published_at: "2026-10-08T00:00:00Z", published_by: "u", archived_at: null }];
  it("apply 문항이 있는 공개 세트를 모으고, 세트가 이미 최신인 already 문항은 건너뛴다", () => {
    const a = planPatch(P([{ field: "passage", old: "Which is right?", new: "Which one is right?" }]), prob(ver()));
    const r = planSets([a], sets, new Map([["p1", "v1"]]));
    expect(r.sets.length).toBe(1); expect(r.sets[0].problemIds).toEqual(["p1"]); expect(r.sets[0].slots[0]).toMatchObject({ section: "math", position: 3, module_key: "math_m1" });
    const done = planPatch(P([{ field: "passage", old: "x", new: "Which is right?" }]), prob(ver()));
    expect(done.status).toBe("already");
    expect(planSets([done], sets, new Map([["p1", "v1"]])).sets.length).toBe(0); // 세트 항목 버전 == 문제 공개 버전
    expect(planSets([done], sets, new Map([["p1", "vNEW"]])).sets.length).toBe(1); // 문제는 새 버전인데 세트가 아직 옛 버전
  });
  it("formatDiff 는 변경 필드와 세트 위치를 보여준다", () => {
    const a = planPatch(P([{ field: "passage", old: "Which is right?", new: "Which one is right?" }]), prob(ver()));
    const t = formatDiff(a); expect(t).toContain("[T-1] apply"); expect(t).toContain("- Which is right?"); expect(t).toContain("+ Which one is right?"); expect(t).toContain("in: SAT Practice Test 1 v2 math/math_m1#3");
  });
});

// 저장된 DB 스냅샷(2026-10-13 읽기 전용 조회)에 대한 전체 계획: 결과는 스냅샷 시점 기준이며 파일이 바뀌지 않는 한 결정적이다.
describe("2026-10-13 DB 스냅샷 전체 계획", () => {
  const ro = JSON.parse(readFileSync("data/audit/2026-10-13-db-readout.json", "utf-8")) as { generatedAt: string; patchStatus: { patchId: string; status: string; reasons: string[] }[]; problems: ProblemReadout[]; sets: SetRow[] };
  it("스냅샷의 패치 상태: apply 가 대부분이고 막힌 것은 사유가 있다", () => {
    const tally: Record<string, number> = {}; for (const p of ro.patchStatus) tally[p.status] = (tally[p.status] ?? 0) + 1;
    expect((tally.apply ?? 0) + (tally.already ?? 0)).toBeGreaterThanOrEqual(60);
    for (const p of ro.patchStatus.filter((x) => x.status !== "apply" && x.status !== "already")) expect(p.reasons.length).toBeGreaterThan(0);
    expect(ro.patchStatus.find((p) => p.patchId === "S-07")?.status).toBe("apply"); // 7점 다각형으로 바꾼 호 그림
  });
});
