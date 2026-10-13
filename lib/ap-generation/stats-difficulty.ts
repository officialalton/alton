// AP Statistics MC 난이도 신호(2026-10-12, docs/ap/statistics-difficulty.md).
// 문제: 난이도 라벨(difficulty_provisional)은 규칙이 아니라 LLM 판정기(Sonnet)가 문항 겉모습(stem·보기·자료)만 보고 정한다. 설계도의 사고 단계는 최소 2로 고정돼 신호가 없고,
//       판정기는 같은 3단계 문항에 basic 8 / exam_prep 5 로 갈라 답했다(S1~S2-b 통과 MC 실측). 그래서 다단계 문항도 "한 개념"이라며 basic 이 된다.
// 해법: (1) 원형이 코드로 "사실"을 선언한다(단계 목록·결합 개념·읽어야 할 자료 수·오답이 처음 틀어지는 단계). (2) 결정적 게이트가 그 선언을 검증한다(단계가 실제로 필수인지:
//       오답이 단계마다 틀어져야 한다). (3) 판정기에는 이 사실과 기준을 판정 입력으로 준다(문항 풀이 방식은 알려 주지 않는다). (4) 판정 라벨과 구조 기준이 어긋나면 감사 표시만 남기고 라벨은 바꾸지 않는다.
// 라벨을 올리는 규칙이 아니라, 판정기가 못 보던 구조 사실을 보여 주고 "실제로 어려운 구조"를 만드는 원형을 추가하는 방식이다.
import type { McPack } from "./gates";

export type DifficultySignals = {
  /** 학생이 순서대로 내려야 하는 판단·계산 단계(각각 서로 다른 추론). 2~4개. */
  steps: string[];
  /** 한 문항에서 결합되는 서로 다른 CED 개념. 1~3개. */
  concepts: string[];
  /** 서로 관련지어 읽어야 하는 별개 자료 수(시나리오 문장, 표, 그림, 출력 블록). 1~3. */
  representations: number;
  /** 오답 보기 텍스트 -> 그 오답이 처음 틀어지는 단계 번호(1부터). 단계마다 틀어지는 오답이 있어야 그 단계가 필수라는 증거다. */
  distractor_fail_step: Record<string, number>;
  /** 계산량: none | light(손계산 가능한 한두 번의 연산). 긴 산술은 불공정 난이도라 허용하지 않는다. */
  arithmetic: "none" | "light";
};
export type McWithSignals = McPack & { difficulty_signals?: DifficultySignals; blueprint?: { student_thinking?: string[] } };
export type DifficultyBand = "basic_learning" | "exam_prep";

const norm = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();

/** 선언 검증(결정적). 선언이 없으면 [] — 기존(S1~S2-b) 원형은 선언이 없다. 선언이 있으면 모든 항목이 맞아야 한다. */
export function gateDifficultySignals(p: McWithSignals): string[] {
  const s = p.difficulty_signals;
  if (!s) return [];
  const r: string[] = [];
  const steps = Array.isArray(s.steps) ? s.steps : [];
  if (steps.length < 2 || steps.length > 4 || steps.some((x) => typeof x !== "string" || x.trim().length < 15) || new Set(steps.map(norm)).size !== steps.length) r.push("difficulty_signals_steps");
  const concepts = Array.isArray(s.concepts) ? s.concepts : [];
  if (concepts.length < 1 || concepts.length > 3 || concepts.some((x) => typeof x !== "string" || x.trim().length < 8) || new Set(concepts.map(norm)).size !== concepts.length) r.push("difficulty_signals_concepts");
  if (!Number.isInteger(s.representations) || s.representations < 1 || s.representations > 3) r.push("difficulty_signals_representations");
  if (s.arithmetic !== "none" && s.arithmetic !== "light") r.push("difficulty_signals_arithmetic");
  const wrong = p.options.filter((_, i) => i !== p.key_index).map((o) => o.text);
  const map = s.distractor_fail_step ?? {};
  const keys = Object.keys(map);
  if (keys.length !== wrong.length || wrong.some((w) => !(w in map))) r.push("difficulty_signals_distractor_map_mismatch");
  else {
    const vals = wrong.map((w) => map[w]);
    if (vals.some((v) => !Number.isInteger(v) || v < 1 || v > steps.length)) r.push("difficulty_signals_fail_step_out_of_range");
    // 단계가 정말 필수인가: 마지막 단계를 뺀 모든 단계(최소 steps-1 개)에서 틀어지는 오답이 있어야 한다. 단계를 부풀려 신호만 높이는 것을 막는다.
    else if (new Set(vals).size < steps.length - 1) r.push("difficulty_signals_steps_not_load_bearing");
  }
  const bpSteps = p.blueprint?.student_thinking?.length ?? 0;
  if (bpSteps > steps.length) r.push("difficulty_signals_fewer_steps_than_blueprint");
  return r;
}

/** 구조 기준: 3단계 이상이고 둘 이상의 개념 또는 둘 이상의 자료를 결합하면 exam_prep. 그 밖은 basic_learning(MC 에서 advanced_supplement 를 구조로 주지 않는다). */
export function structuralBand(s: DifficultySignals): DifficultyBand {
  return s.steps.length >= 3 && (s.concepts.length >= 2 || s.representations >= 2) ? "exam_prep" : "basic_learning";
}

/** 판정기 입력에 덧붙이는 구조 사실(정답·풀이 단계 문구는 빼고 개수와 이름 없는 요약만 — 판정기는 풀이자가 아니다). */
export function difficultyBrief(s: DifficultySignals): string {
  const late = Object.values(s.distractor_fail_step).filter((v) => v >= 2).length;
  return [
    "CODE-COUNTED STRUCTURE (facts from the item generator, not opinions):",
    `- required sequential steps: ${s.steps.length}`,
    `- distinct concepts combined: ${s.concepts.length} (${s.concepts.join("; ")})`,
    `- separate sources to read and relate: ${s.representations}`,
    `- wrong options that survive the first step and fail only later: ${late} of ${Object.keys(s.distractor_fail_step).length}`,
    `- arithmetic: ${s.arithmetic}`,
    "Rubric for this label: exam_prep = at least 3 required steps AND at least 2 combined concepts or sources (a student must carry a result from one step into the next); basic_learning = 2 or fewer steps or a single concept. A short stem and light arithmetic are by design and are NOT unfair sources. Set reasoning_steps to the counted steps unless the item text clearly shows a different count.",
  ].join("\n");
}

/** 감사: 판정 라벨이 구조 기준과 어긋나는지(라벨은 바꾸지 않는다). 선언이 없으면 null. */
export function auditLabel(label: string | null | undefined, s: DifficultySignals | undefined): "agree" | "judge_below_rubric" | "judge_above_rubric" | null {
  if (!s || !label) return null;
  const band = structuralBand(s);
  const lv = (l: string) => (l === "basic_learning" ? 0 : 1);
  if (lv(label) === lv(band)) return "agree";
  return lv(label) < lv(band) ? "judge_below_rubric" : "judge_above_rubric";
}

/** 판정 요청 본문에 덧붙일 문자열(파이프라인이 호출). Statistics MC 이고 원형이 선언을 가진 경우에만 비어 있지 않다 — 다른 과목·선언 없는 문항은 기존 요청과 바이트 단위로 같다. */
export function difficultyContext(subject: string, kind: string, item: unknown): string {
  if (subject !== "ap_statistics" || kind !== "mc") return "";
  const sg = (item as { difficulty_signals?: DifficultySignals } | null)?.difficulty_signals;
  return sg ? `\n\n${difficultyBrief(sg)}` : "";
}
