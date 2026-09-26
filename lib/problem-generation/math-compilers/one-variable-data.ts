// 2026-09-17(제품 오너 지시) — 문제 해결·데이터 분석 공통 엔진 세 번째 세부 기술:
// "One-variable data: distributions and measures of center and spread". 정수 목록에서
// mean/median/range를 묻는다. AI를 전혀 부르지 않는다.
//
// 2026-09-17(제품 오너 지시, 중간 우선순위 항목) — 같은 스킬 코드에 "그룹화 도수분포표에서
// 중앙값이 속한 구간" 세부 유형을 추가한다. 그룹화 도수분포(값이 아니라 값의 "구간"과
// 그 구간의 도수만 주어짐)에서는 정확한 중앙값을 계산할 수 없다(구간 안의 분포를 모르므로) —
// 실기출에서도 항상 "중앙값이 속한 구간"을 묻는다. 전부 결정적 코드 계산 — AI 호출 없음.
import type { DistractorRationale, DistractorKind } from "../review";
import type { DataSpec } from "@/lib/problem-figures/templates/data";

export type OneVarDataQuestionKind = "mean" | "median" | "range" | "grouped_median_interval";
export type OneVarDataDifficulty = "easy" | "medium" | "hard";

export type ListDataModel = {
  skillCode: "one_variable_data";
  difficulty: OneVarDataDifficulty;
  questionKind: "mean" | "median" | "range";
  values: number[];
  correctAnswer: string;
  distractors: { value: string; kind: DistractorKind; reason: string }[];
};

/** 불변 정답 모델 — 그룹화 도수분포표: [lower, upper] 구간마다 도수(frequency)가 있다.
 * 구간 안의 실제 값은 알 수 없으므로 "중앙값이 속한 구간"만 결정할 수 있다. */
export type GroupedMedianIntervalModel = {
  skillCode: "one_variable_data";
  difficulty: OneVarDataDifficulty;
  questionKind: "grouped_median_interval";
  intervals: { label: string; lower: number; upper: number; frequency: number }[];
  totalCount: number;
  medianRank: number;
  medianIntervalIndex: number;
  correctAnswer: string;
  distractors: { value: string; kind: DistractorKind; reason: string }[];
};

export type OneVarDataModel = ListDataModel | GroupedMedianIntervalModel;

function randInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}
function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, "");
}

const SIZE_BY_DIFFICULTY: Record<OneVarDataDifficulty, number> = { easy: 5, medium: 7, hard: 9 };
const RANGE_BY_DIFFICULTY: Record<OneVarDataDifficulty, number> = { easy: 20, medium: 40, hard: 60 };

function pickUnique(
  cands: { value: number; kind: DistractorKind; reason: string }[],
  correctAnswer: string
): { value: string; kind: DistractorKind; reason: string }[] {
  const seen = new Set<string>([correctAnswer]);
  const out: { value: string; kind: DistractorKind; reason: string }[] = [];
  for (const c of cands) {
    if (out.length >= 3) break;
    if (!Number.isFinite(c.value)) continue;
    const text = fmt(c.value);
    if (seen.has(text)) continue;
    seen.add(text);
    out.push({ value: text, kind: c.kind, reason: c.reason });
  }
  return out;
}

/** pickUnique 의 문자열 버전 — 구간 라벨("20-29")은 fmt(숫자)로 정규화할 수 없다(two-variable-data.ts의 pickUniqueText와 동일 패턴). */
function pickUniqueText(
  cands: { value: string; kind: DistractorKind; reason: string }[],
  correctAnswer: string
): { value: string; kind: DistractorKind; reason: string }[] {
  const seen = new Set<string>([correctAnswer]);
  const out: { value: string; kind: DistractorKind; reason: string }[] = [];
  for (const c of cands) {
    if (out.length >= 3) break;
    if (seen.has(c.value)) continue;
    seen.add(c.value);
    out.push(c);
  }
  return out;
}

function generateListDataModel(params: {
  difficulty: OneVarDataDifficulty;
  questionKind: "mean" | "median" | "range";
}): ListDataModel {
  const questionKind = params.questionKind;
  const size = SIZE_BY_DIFFICULTY[params.difficulty]; // 항상 홀수 — 중앙값이 목록 값 하나로 딱 떨어지게.
  const range = RANGE_BY_DIFFICULTY[params.difficulty];

  // 시도 횟수: "mean"은 정수 평균 조건(대략 1/size 확률)과 오답 3개 유일성 조건을 동시에
  // 만족해야 하므로 hard(9개, 범위 60)에서는 시도당 성공 확률이 낮아(~10%) 50회로는
  // 간헐적으로(테스트 전체에서 눈에 띄는 빈도로) 실패할 수 있었다. 500회로 늘려 실패
  // 확률을 사실상 0으로 낮춘다.
  for (let attempt = 0; attempt < 500; attempt++) {
    const values: number[] = [];
    for (let i = 0; i < size; i++) values.push(randInt(0, range));
    const sorted = [...values].sort((x, y) => x - y);
    const sum = values.reduce((s, v) => s + v, 0);
    const mean = sum / size;
    const median = sorted[(size - 1) / 2];
    const rangeVal = sorted[size - 1] - sorted[0];

    if (questionKind === "mean") {
      if (!Number.isInteger(mean)) continue;
      const cands: { value: number; kind: DistractorKind; reason: string }[] = [
        { value: median, kind: "condition_ignored", reason: "평균이 아니라 중앙값을 답으로 썼다(평균·중앙값 혼동)." },
        { value: sum / (size - 1), kind: "formula_misuse", reason: "합을 개수보다 하나 적은 값으로 나누었다." },
        { value: sum, kind: "unit_error", reason: "합계를 개수로 나누는 것을 잊고 총합을 그대로 답했다." },
        { value: sorted[size - 1], kind: "condition_ignored", reason: "평균 대신 데이터의 최댓값을 답으로 썼다." },
      ];
      const distractors = pickUnique(cands, fmt(mean));
      if (distractors.length < 3) continue;
      return { skillCode: "one_variable_data", difficulty: params.difficulty, questionKind, values, correctAnswer: fmt(mean), distractors };
    }

    if (questionKind === "median") {
      const cands: { value: number; kind: DistractorKind; reason: string }[] = [
        { value: Math.round(mean), kind: "condition_ignored", reason: "중앙값이 아니라 평균을 답으로 썼다(평균·중앙값 혼동)." },
        { value: values[Math.floor(size / 2)], kind: "step_missing", reason: "정렬하지 않은 원래 순서에서 가운데 위치의 값을 그대로 답했다." },
        { value: sorted[size - 2], kind: "step_missing", reason: "가운데 값이 아니라 그 옆 값을 답했다." },
        { value: sorted[1], kind: "step_missing", reason: "가운데 값이 아니라 앞쪽의 다른 값을 답했다." },
      ];
      const distractors = pickUnique(cands, fmt(median));
      if (distractors.length < 3) continue;
      return { skillCode: "one_variable_data", difficulty: params.difficulty, questionKind, values, correctAnswer: fmt(median), distractors };
    }

    // range
    if (rangeVal === 0) continue;
    const cands: { value: number; kind: DistractorKind; reason: string }[] = [
      { value: sorted[0] - sorted[size - 1], kind: "sign_error", reason: "최댓값에서 최솟값을 빼지 않고 반대로 빼서 부호가 반대가 됐다." },
      { value: sorted[size - 1], kind: "condition_ignored", reason: "범위가 아니라 최댓값 자체를 답으로 썼다." },
      { value: mean, kind: "condition_ignored", reason: "범위가 아니라 평균을 답으로 썼다." },
      { value: sorted[size - 1] + sorted[0], kind: "formula_misuse", reason: "최댓값과 최솟값을 빼지 않고 더했다." },
    ];
    const distractors = pickUnique(cands, fmt(rangeVal));
    if (distractors.length < 3) continue;
    return { skillCode: "one_variable_data", difficulty: params.difficulty, questionKind, values, correctAnswer: fmt(rangeVal), distractors };
  }
  throw new Error("one_variable_data: 오답 후보 생성에 실패했습니다.");
}

const INTERVAL_COUNT_BY_DIFFICULTY: Record<OneVarDataDifficulty, number> = { easy: 4, medium: 5, hard: 6 };
const INTERVAL_FREQ_MAX_BY_DIFFICULTY: Record<OneVarDataDifficulty, number> = { easy: 6, medium: 9, hard: 12 };
const INTERVAL_WIDTH = 10;

/** 구간의 도수(frequency) 목록으로부터 "중앙값이 속한 구간"의 인덱스를 결정한다.
 * N개 값 중 순위 rank번째 값이 속한 구간 = 누적도수가 rank 이상이 되는 첫 구간. */
function findRankInterval(frequencies: number[], rank: number): number {
  let cum = 0;
  for (let i = 0; i < frequencies.length; i++) {
    cum += frequencies[i];
    if (cum >= rank) return i;
  }
  return frequencies.length - 1;
}

function generateGroupedMedianIntervalModel(params: { difficulty: OneVarDataDifficulty }): GroupedMedianIntervalModel {
  const count = INTERVAL_COUNT_BY_DIFFICULTY[params.difficulty];
  const freqMax = INTERVAL_FREQ_MAX_BY_DIFFICULTY[params.difficulty];

  for (let attempt = 0; attempt < 200; attempt++) {
    const startBase = randInt(0, 5) * 10; // 0, 10, 20, ... 50부터 시작 — "10-19"류 구간이 되게.
    const frequencies: number[] = [];
    for (let i = 0; i < count; i++) frequencies.push(randInt(1, freqMax));
    // N을 항상 홀수로 강제한다 — N이 짝수면 중앙값이 두 순위값의 평균이라 두 순위가 서로
    // 다른 구간에 걸치는 경계 사례가 생길 수 있어(모호함), 실기출과 같은 "구간 하나로
        // 딱 떨어지는" 조건을 보장한다.
    let total = frequencies.reduce((s, v) => s + v, 0);
    if (total % 2 === 0) { frequencies[count - 1] += 1; total += 1; }

    const intervals = frequencies.map((frequency, i) => {
      const lower = startBase + i * INTERVAL_WIDTH;
      const upper = lower + INTERVAL_WIDTH - 1;
      return { label: `${lower}-${upper}`, lower, upper, frequency };
    });

    const medianRank = (total + 1) / 2; // N 홀수이므로 정수.
    const medianIntervalIndex = findRankInterval(frequencies, medianRank);
    const correctAnswer = intervals[medianIntervalIndex].label;

    const cumulative: number[] = [];
    frequencies.reduce((s, v, i) => (cumulative[i] = s + v), 0);

    // 오답 1: 누적도수 계산의 off-by-one — 목표 순위를 하나 낮게(또는 하나 높게) 잡아
    // 경계에서 한 구간 어긋난 결과를 만든다.
    let offByOneRank = medianRank - 1;
    let offByOneIndex = findRankInterval(frequencies, Math.max(1, offByOneRank));
    if (offByOneIndex === medianIntervalIndex) {
      offByOneRank = medianRank + 1;
      offByOneIndex = findRankInterval(frequencies, offByOneRank);
    }

    // 오답 2: 평균 위치와 중앙값 위치 혼동 — 구간 중점(midpoint)의 가중평균이 속한 구간을 답한다.
    const weightedMean = intervals.reduce((s, iv) => s + ((iv.lower + iv.upper) / 2) * iv.frequency, 0) / total;
    const meanIntervalIndex = intervals.findIndex((iv) => weightedMean >= iv.lower && weightedMean <= iv.upper + 1);
    const meanIndex = meanIntervalIndex === -1 ? intervals.length - 1 : meanIntervalIndex;

    // 오답 3: 최빈구간(도수가 가장 큰 구간) — 중앙값 구간이 아니라 도수가 가장 높은 구간을 답한다.
    let modalIndex = 0;
    for (let i = 1; i < frequencies.length; i++) if (frequencies[i] > frequencies[modalIndex]) modalIndex = i;

    // 오답 4: 전체 개수(N) 오산 — 마지막 행을 빠뜨리고 세어(N' = N - 마지막 구간 도수),
    // 그 잘못된 N'으로 순위를 다시 계산한다(누적도수 배열 자체는 그대로 사용).
    const missingRowTotal = total - frequencies[frequencies.length - 1];
    const missingRowRank = Math.max(1, Math.ceil((missingRowTotal + 1) / 2));
    const missingRowIndex = findRankInterval(frequencies, missingRowRank);

    const cands: { value: string; kind: DistractorKind; reason: string }[] = [
      { value: intervals[offByOneIndex].label, kind: "step_missing", reason: "누적도수를 셀 때 경계에서 하나 어긋나게(off-by-one) 세어 중앙값 순위가 실제로 도달하는 구간보다 한 구간 이르거나 늦은 구간을 답했다." },
      { value: intervals[meanIndex].label, kind: "condition_ignored", reason: "중앙값 위치가 아니라 평균(가중 중점 평균)이 속한 구간을 답했다(평균·중앙값 위치 혼동)." },
      { value: intervals[modalIndex].label, kind: "condition_ignored", reason: "중앙값 구간이 아니라 도수가 가장 큰(최빈) 구간을 답했다." },
      { value: intervals[missingRowIndex].label, kind: "step_missing", reason: "마지막 구간의 도수를 전체 개수(N)에 반영하지 않고 세어, 잘못된 총 개수로 중앙값 순위를 계산했다." },
    ];
    const distractors = pickUniqueText(cands, correctAnswer);
    // 구간 개수가 적은 난이도(easy=4구간)에서는 네 오류 경로가 서로 같은 구간으로 수렴해
    // 유일한 오답이 3개에 못 미칠 수 있다 — 남은 구간(정답이 아닌 구간)에서 아직 쓰이지
    // 않은 라벨을 순서대로 채워 항상 3개를 채운다(구간 수가 4 이상이므로 항상 가능하다).
    if (distractors.length < 3) {
      const used = new Set<string>([correctAnswer, ...distractors.map((d) => d.value)]);
      for (let i = 0; i < intervals.length && distractors.length < 3; i++) {
        if (i === medianIntervalIndex) continue;
        const label = intervals[i].label;
        if (used.has(label)) continue;
        used.add(label);
        distractors.push({ value: label, kind: "other", reason: "중앙값 구간이 아니라 인접한 다른 구간을 답으로 혼동했다." });
      }
    }
    if (distractors.length < 3) continue;
    return {
      skillCode: "one_variable_data", difficulty: params.difficulty, questionKind: "grouped_median_interval",
      intervals, totalCount: total, medianRank, medianIntervalIndex, correctAnswer, distractors,
    };
  }
  throw new Error("one_variable_data(grouped_median_interval): 오답 후보 생성에 실패했습니다.");
}

export function generateOneVarDataModel(params: {
  difficulty: OneVarDataDifficulty;
  questionKind?: OneVarDataQuestionKind;
}): OneVarDataModel {
  const kinds: OneVarDataQuestionKind[] = ["mean", "median", "range", "grouped_median_interval"];
  const questionKind = params.questionKind ?? kinds[randInt(0, kinds.length - 1)];
  if (questionKind === "grouped_median_interval") return generateGroupedMedianIntervalModel({ difficulty: params.difficulty });
  return generateListDataModel({ difficulty: params.difficulty, questionKind });
}

export function validateOneVarDataModel(model: OneVarDataModel): { ok: true } | { ok: false; reason: string } {
  const values = [model.correctAnswer, ...model.distractors.map((d) => d.value)];
  if (new Set(values).size !== values.length) return { ok: false, reason: "정답과 오답 중 값이 중복됩니다." };
  if (model.distractors.length !== 3) return { ok: false, reason: "오답이 정확히 3개가 아닙니다." };

  if (model.questionKind === "grouped_median_interval") {
    const frequencies = model.intervals.map((iv) => iv.frequency);
    const total = frequencies.reduce((s, v) => s + v, 0);
    if (total !== model.totalCount) return { ok: false, reason: "구간 도수의 합이 totalCount와 일치하지 않습니다." };
    if (total % 2 === 0) return { ok: false, reason: "전체 개수(N)가 홀수가 아닙니다(중앙값 구간이 모호할 수 있습니다)." };
    const expectedRank = (total + 1) / 2;
    if (expectedRank !== model.medianRank) return { ok: false, reason: "중앙값 순위가 일치하지 않습니다." };
    const expectedIndex = findRankInterval(frequencies, expectedRank);
    if (expectedIndex !== model.medianIntervalIndex) return { ok: false, reason: "중앙값 구간 인덱스가 일치하지 않습니다." };
    if (model.intervals[expectedIndex].label !== model.correctAnswer) return { ok: false, reason: "중앙값 구간 라벨이 일치하지 않습니다." };
    const labels = model.intervals.map((iv) => iv.label);
    if (new Set(labels).size !== labels.length) return { ok: false, reason: "구간 라벨이 중복됩니다." };
    return { ok: true };
  }

  const sorted = [...model.values].sort((x, y) => x - y);
  const sum = model.values.reduce((s, v) => s + v, 0);
  if (model.questionKind === "mean" && fmt(sum / model.values.length) !== model.correctAnswer) return { ok: false, reason: "평균 계산이 일치하지 않습니다." };
  if (model.questionKind === "median" && fmt(sorted[(sorted.length - 1) / 2]) !== model.correctAnswer) return { ok: false, reason: "중앙값 계산이 일치하지 않습니다." };
  if (model.questionKind === "range" && fmt(sorted[sorted.length - 1] - sorted[0]) !== model.correctAnswer) return { ok: false, reason: "범위 계산이 일치하지 않습니다." };
  return { ok: true };
}

export type CompiledMathProblem = {
  passage: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  explanationEn: string;
  figure: DataSpec;
  distractorRationales: DistractorRationale[];
};

const QUESTION_TEXT: Record<"mean" | "median" | "range", string> = {
  mean: "What is the mean of the data set shown?",
  median: "What is the median of the data set shown?",
  range: "What is the range of the data set shown?",
};

function renderGroupedMedianIntervalProblem(model: GroupedMedianIntervalModel): CompiledMathProblem {
  const passage = `The frequency table below shows the distribution of a data set of ${model.totalCount} values, grouped into intervals.`;
  const figure: DataSpec = {
    type: "data", kind: "table",
    columns: ["Interval", "Frequency"],
    rows: model.intervals.map((iv) => [iv.label, iv.frequency]),
  };
  const question = "Based on the frequency table shown below, which interval contains the median of the data set?";
  const options = [model.correctAnswer, ...model.distractors.map((d) => d.value)];
  const order = [0, 1, 2, 3].sort(() => Math.random() - 0.5);
  const shuffled = order.map((i) => options[i]);
  const correctIndex = order.indexOf(0);

  const cumParts: string[] = [];
  let cum = 0;
  for (const iv of model.intervals) {
    cum += iv.frequency;
    cumParts.push(`${iv.label}: ${iv.frequency}명(누적 ${cum}명)`);
  }
  const explanation = `전체 개수는 ${model.intervals.map((iv) => iv.frequency).join(" + ")} = ${model.totalCount}개(홀수)이므로, 중앙값은 크기순으로 나열했을 때 ${model.medianRank}번째 값이다. 구간별 누적도수는 ${cumParts.join(", ")}이다. 누적도수가 ${model.medianRank} 이상이 되는 첫 구간은 "${model.correctAnswer}"이므로, 중앙값이 속한 구간은 "${model.correctAnswer}"이다. 구간별 자료만으로는 실제 값을 알 수 없으므로 정확한 중앙값이 아니라 "구간"만 결정할 수 있다.`;
  const explanationEn = `The total count is ${model.intervals.map((iv) => iv.frequency).join(" + ")} = ${model.totalCount} (odd), so the median is the ${model.medianRank}th value when the data is ordered. The running (cumulative) frequencies are ${cumParts.join(", ")}. The first interval whose cumulative frequency reaches ${model.medianRank} is "${model.correctAnswer}", so the median falls in the interval "${model.correctAnswer}". Because only interval counts (not individual values) are known, only the interval — not an exact value — can be determined.`;

  const distractorRationales: DistractorRationale[] = model.distractors.map((d, i) => ({
    index: order.indexOf(i + 1),
    plausibleBecause: "같은 도수분포표에서 나올 수 있는 실제 집계·해석 오류다.",
    matches: "같은 도수분포표 값으로 계산되었다.",
    whyWrong: d.reason,
    kind: d.kind,
    obvious: false,
  }));

  return { passage, question, options: shuffled, correctIndex, explanation, explanationEn, figure, distractorRationales };
}

function renderListDataProblem(model: ListDataModel): CompiledMathProblem {
  // 2026-09-17 버그 수정 — 이 유형은 표/그래프가 필수인데(자료 없는 초안 저장 금지) 컴파일러가
  // figure를 만들지 않고 checkFigure는 지문에 "as shown" 류 문구가 없으면 그냥 통과시켰다.
  // 실제 자료를 number_list 그림으로 만들고, 지문에도 "as shown below"를 넣어 그림을 가리키게 한다.
  const passage = `A data set is shown below.`;
  const figure: DataSpec = { type: "data", kind: "number_list", values: model.values, label: "Value" };
  const question = QUESTION_TEXT[model.questionKind];
  const options = [model.correctAnswer, ...model.distractors.map((d) => d.value)];
  const order = [0, 1, 2, 3].sort(() => Math.random() - 0.5);
  const shuffled = order.map((i) => options[i]);
  const correctIndex = order.indexOf(0);

  const sorted = [...model.values].sort((x, y) => x - y);
  const sum = model.values.reduce((s, v) => s + v, 0);
  let explanation: string;
  let explanationEn: string;
  if (model.questionKind === "mean") {
    explanation = `모든 값의 합은 ${sum}이고 값의 개수는 ${model.values.length}개이므로, 평균은 ${sum}÷${model.values.length} = ${model.correctAnswer}이다.`;
    explanationEn = `The sum of all values is ${sum} and there are ${model.values.length} values, so the mean is ${sum}÷${model.values.length} = ${model.correctAnswer}.`;
  } else if (model.questionKind === "median") {
    explanation = `값을 크기순으로 정렬하면 ${sorted.join(", ")}이고, 개수가 ${model.values.length}개(홀수)이므로 정가운데 값이 중앙값이다. 따라서 중앙값은 ${model.correctAnswer}이다.`;
    explanationEn = `Sorting the values gives ${sorted.join(", ")}. Since there are ${model.values.length} values (odd), the median is the middle value: ${model.correctAnswer}.`;
  } else {
    explanation = `최댓값은 ${sorted[sorted.length - 1]}이고 최솟값은 ${sorted[0]}이므로, 범위는 ${sorted[sorted.length - 1]} - ${sorted[0]} = ${model.correctAnswer}이다.`;
    explanationEn = `The maximum is ${sorted[sorted.length - 1]} and the minimum is ${sorted[0]}, so the range is ${sorted[sorted.length - 1]} - ${sorted[0]} = ${model.correctAnswer}.`;
  }

  const distractorRationales: DistractorRationale[] = model.distractors.map((d, i) => ({
    index: order.indexOf(i + 1),
    plausibleBecause: "같은 데이터에서 나올 수 있는 실제 계산 오류다.",
    matches: "같은 데이터 집합으로 계산되었다.",
    whyWrong: d.reason,
    kind: d.kind,
    obvious: false,
  }));

  return { passage, question, options: shuffled, correctIndex, explanation, explanationEn, figure, distractorRationales };
}

export function renderOneVarDataProblem(model: OneVarDataModel): CompiledMathProblem {
  if (model.questionKind === "grouped_median_interval") return renderGroupedMedianIntervalProblem(model);
  return renderListDataProblem(model);
}
