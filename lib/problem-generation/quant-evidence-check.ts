// 2026-09-17 — command_of_evidence_quant(정량 근거) 결정적 검증기.
//
// 지금까지 이 스킬은 "figure(type:'data')가 존재한다"까지만 검사했다(rw-stimulus.ts checkRwStructure,
// problem-quality-contract.ts의 정답 수치 대조). 여기서는 evidence-model-check.ts와 같은 설계로,
// AI가 "이 값을 표에서 읽었다"고 자기보고하는 것을 신뢰하지 않고 실제 figure 데이터를 직접 훑어
// (1) 정답 선택지의 수치가 실제로 자료에 있거나(정확한 셀) 자료에서 파생 가능한 단순 통계(행/열 합·최댓값·
// 최솟값)인지, (2) 오답들의 수치가 자료와 "그냥 다른 숫자"가 아니라 그럴듯한 오독(다른 행/열, 인접 셀,
// 인덱스 한 칸 밀림)인지를 결정적으로 확인한다.

/**
 * 부동소수점 오차 보정(2026-09-18 hard 재검증에서 발견) — 5.4-3.2를 JS로 계산하면
 * 2.1999999999999997이 나온다(정확한 2.2가 아님). Set.has()는 정확히 같은 값만 찾으므로, 지문이
 * "2.2"라고 쓴 정당한 정답이 파생 통계 Set에 있는 값과 비트 단위로 달라 "자료에 없음"으로 오탐
 * 거부됐다. 저장·비교 양쪽에서 소수 9자리로 반올림해 이런 부동소수점 오차를 흡수한다.
 */
const r9 = (n: number): number => Math.round(n * 1e9) / 1e9;

export const QUANT_OPERATIONS = ["EXACT_LOOKUP", "ROW_SUM", "COLUMN_SUM", "MAX", "MIN", "DIFFERENCE"] as const;
export type QuantOperation = (typeof QUANT_OPERATIONS)[number];

export const QUANT_DISTRACTOR_ERROR_TYPES = ["WRONG_ROW", "WRONG_COLUMN", "OFF_BY_ONE_INDEX", "ADJACENT_CELL"] as const;
export type QuantDistractorErrorType = (typeof QUANT_DISTRACTOR_ERROR_TYPES)[number];

export const QUANT_EVIDENCE_SKILLS = ["command_of_evidence_quant"] as const;
export type QuantEvidenceSkill = (typeof QUANT_EVIDENCE_SKILLS)[number];

export function isQuantEvidenceSkill(skillCode: string | null | undefined): skillCode is QuantEvidenceSkill {
  return Boolean(skillCode) && (QUANT_EVIDENCE_SKILLS as readonly string[]).includes(skillCode as string);
}

export type QuantEvidenceFields = {
  /** 정답이 자료에서 값을 얻는 방식(고정 enum). */
  operation: string | null;
  /** 정답 근거 위치 설명(자유 문구 — 사람이 읽는 용도, 검증은 수치 자체로 한다). */
  answerRationale: string | null;
  /** 오답(정답 제외) 옵션 순서대로 하나씩 — 그 오답이 자료를 어떻게 잘못 읽었는지(고정 enum). */
  distractorErrorTypes: string[] | null;
};

export type QuantEvidenceCheckResult = { ok: true } | { ok: false; reason: string };

function numbersIn(text: string): number[] {
  return Array.from(text.matchAll(/-?\d[\d,]*(?:\.\d+)?/g))
    .map((m) => Number(m[0].replace(/,/g, "")))
    .filter((n) => Number.isFinite(n));
}

/**
 * 셀 값이 순수 숫자 문자열("29.8", "-4")이면 숫자로 인정한다 — 2026-09-18(hard 재검증)에서 발견:
 * AI가 같은 figure 스키마인데도 셀 값을 JSON 숫자가 아니라 문자열로 낸 경우(예: rows의 값이
 * "4"/"29.8"/"71")가 있었다. 렌더러(problem-figures/templates/data.ts)는 문자열 셀도 그대로
 * 표시하므로 이 자체는 렌더링 문제가 아니지만, 이 검증기는 typeof 'number'만 인정해 정답 수치가
 * 자료에 있는데도 "자료에 없다"고 오탐 거부했다. 열 이름·범주 이름 같은 진짜 텍스트는 숫자로
 * 파싱되지 않으므로 안전하다.
 */
function asNumeric(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string" && /^-?\d+(\.\d+)?$/.test(v.trim())) {
    const n = Number(v.trim());
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** figure(jsonb)의 모든 숫자 셀 값을 모은다(열 이름·범주 이름 같은 문자열은 제외). */
function numericCells(figure: unknown): number[] {
  const out: number[] = [];
  const walk = (v: unknown) => {
    const n = asNumeric(v);
    if (n !== null) out.push(n);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") Object.values(v as Record<string, unknown>).forEach(walk);
  };
  walk(figure);
  return out;
}

/** 표의 각 행/열 합계·최댓값·최솟값처럼 "파생 가능한" 단순 통계도 정답 근거로 인정한다. */
function derivedStats(figure: unknown): Set<number> {
  const out = new Set<number>();
  const rows: number[][] = [];
  const fig = figure as { rows?: unknown[]; columns?: unknown[]; series?: { values?: number[] }[]; values?: number[] } | null;
  if (fig && Array.isArray(fig.rows)) {
    for (const r of fig.rows) {
      if (Array.isArray(r)) {
        const nums = r.map(asNumeric).filter((n): n is number => n !== null);
        if (nums.length) rows.push(nums);
      }
    }
  }
  if (fig && Array.isArray(fig.series)) {
    for (const s of fig.series) if (Array.isArray(s.values)) rows.push(s.values.map(asNumeric).filter((n): n is number => n !== null));
  }
  if (fig && Array.isArray(fig.values)) rows.push(fig.values.map(asNumeric).filter((n): n is number => n !== null));
  const rowStats: number[] = [];
  for (const r of rows) {
    if (!r.length) continue;
    const sum = r.reduce((a, b) => a + b, 0);
    out.add(r9(sum));
    out.add(r9(Math.max(...r)));
    out.add(r9(Math.min(...r)));
    rowStats.push(sum);
    // 2026-09-18(hard 재검증) — target=DIFFERENCE 인데 이 함수가 "차이" 값을 전혀 계산하지 않아,
    // 정당한 차이 기반 정답까지 "자료에 없는 수치"로 오탐 거부하던 버그. 같은 행 안 두 셀의 차이도
    // 파생 통계로 인정한다(부호 있는 값·절댓값 둘 다).
    for (let i = 0; i < r.length; i += 1) {
      for (let j = 0; j < r.length; j += 1) {
        if (i === j) continue;
        out.add(r9(r[i] - r[j]));
        out.add(r9(Math.abs(r[i] - r[j])));
      }
    }
  }
  // 행 합계끼리의 차이(예: "shift 1 대비 shift 4 총합 차이").
  for (let i = 0; i < rowStats.length; i += 1) {
    for (let j = 0; j < rowStats.length; j += 1) {
      if (i === j) continue;
      out.add(r9(rowStats[i] - rowStats[j]));
      out.add(r9(Math.abs(rowStats[i] - rowStats[j])));
    }
  }
  // 열 합(행렬 형태일 때) + 열끼리의 차이.
  if (rows.length >= 2) {
    const cols = rows[0].length;
    const colSums: number[] = [];
    for (let c = 0; c < cols; c += 1) {
      const col = rows.map((r) => r[c]).filter((n): n is number => typeof n === "number");
      if (col.length) {
        const sum = col.reduce((a, b) => a + b, 0);
        out.add(r9(sum));
        colSums.push(sum);
        // 같은 열 안 두 행의 차이(예: "shift 2와 shift 3의 불량 개수 차이").
        for (let i = 0; i < col.length; i += 1) {
          for (let j = 0; j < col.length; j += 1) {
            if (i === j) continue;
            out.add(r9(col[i] - col[j]));
            out.add(r9(Math.abs(col[i] - col[j])));
          }
        }
      }
    }
    for (let i = 0; i < colSums.length; i += 1) {
      for (let j = 0; j < colSums.length; j += 1) {
        if (i === j) continue;
        out.add(r9(colSums[i] - colSums[j]));
        out.add(r9(Math.abs(colSums[i] - colSums[j])));
      }
    }
  }
  return out;
}

export function checkQuantEvidenceFields(
  skillCode: string,
  fields: QuantEvidenceFields,
  figure: unknown,
  correctOption: string,
  distractorOptions: string[],
  stimulus: string = ""
): QuantEvidenceCheckResult {
  if (!isQuantEvidenceSkill(skillCode)) return { ok: true };

  const operation = (fields.operation ?? "").trim();
  const distractorErrorTypes = fields.distractorErrorTypes ?? [];

  if (!operation) return { ok: false, reason: "quant-evidence: operation이 비어 있습니다." };
  if (!(QUANT_OPERATIONS as readonly string[]).includes(operation)) {
    return { ok: false, reason: `quant-evidence: operation "${operation}"이 허용된 값이 아닙니다(허용: ${QUANT_OPERATIONS.join(", ")}).` };
  }
  if (!fields.answerRationale?.trim()) return { ok: false, reason: "quant-evidence: answer_rationale이 비어 있습니다." };

  if (!figure || typeof figure !== "object") return { ok: false, reason: "quant-evidence: figure(자료)가 없습니다 — 정량 근거 문항은 표·그래프 데이터가 필수입니다." };

  const cells = numericCells(figure);
  const derived = derivedStats(figure);
  const cellSet = new Set(cells.map(r9));
  // 2026-09-19(제품 오너 발견) — "지문이 자료를 부연 설명하며 언급하는 숫자"(예: 지문 본문에 직접
  // 적힌 값)까지도 자료로 인정한다. 단, figure/derived에 전혀 없는 숫자를 정답이 "some"(하나만
  // 근거 확인)으로 통과시키던 원래 로직이 진짜 결함이었다 — 아래에서 every로 바꾼다.
  const stimulusNumSet = new Set(numbersIn(stimulus).map(r9));

  // 모든 선택지(정답+오답)에 공통으로 나오는 숫자는 "Shift 4" 처럼 같은 항목을 가리키는 문맥 숫자다 —
  // 실제로 갈리는 값이 아니므로 비교에서 뺀다(안 빼면 문맥 숫자가 우연히 같아 오답이 정답과 "같은 값"으로
  // 오판정되거나, 오답의 문맥 숫자가 자료에 있어 무관한 오답이 통과하는 두 방향의 오탐이 생긴다).
  const allOptionTexts = [correctOption, ...distractorOptions];
  const numsPerOption = allOptionTexts.map((o) => new Set(numbersIn(o)));
  const contextNums = new Set(
    Array.from(numsPerOption[0] ?? []).filter((n) => numsPerOption.every((s) => s.has(n)))
  );
  const distinctive = (text: string): number[] => numbersIn(text).filter((n) => !contextNums.has(n));

  // 1) 정답 선택지의 수치가 실제 자료 값이거나(정확 셀) 단순 파생 통계여야 한다.
  const correctNums = distinctive(correctOption);
  if (correctNums.length === 0) {
    return { ok: false, reason: "quant-evidence: 정답 선택지에 수치가 없습니다 — 정량 근거 문항의 정답은 자료의 값을 인용해야 합니다." };
  }
  // 2026-09-19(제품 오너 발견 — 전시회 관람객 문항) — 원래 some()은 정답 수치 중 "하나라도" 자료에
  // 있으면 통과시켰다. 정답이 figure에 있는 값(예: 총 관람객 수)과 figure·지문 어디에도 없는 완전
  // 조작된 값(예: 지문이 "부속 note에 있다"고만 말하고 실제로는 어디에도 적히지 않은 "운영 일수")을
  // 함께 쓰면, 관람객 수 하나만으로 통과해버려 조작된 수치가 그대로 초안에 남았다. 이제 정답의
  // distinctive 수치 전부가 자료(figure) 또는 지문 본문에 실제로 있어야 한다 — 하나라도 어디에도
  // 없으면 그 수치는 "언급됐다고 주장만 될 뿐 실제로 제공되지 않은 자료"다.
  const evidenceHas = (n: number) => cellSet.has(r9(n)) || derived.has(r9(n)) || stimulusNumSet.has(r9(n));
  const unverifiedCorrect = correctNums.filter((n) => !evidenceHas(n));
  if (unverifiedCorrect.length > 0) {
    return {
      ok: false,
      reason: `quant-evidence: 정답 선택지가 언급하는 수치(${unverifiedCorrect.join(", ")})가 실제 자료(figure)에도, 지문 본문에도 없습니다 — 지문이 "표/그래프/note에 있다"고 서술만 하고 실제 값을 어디에도 제공하지 않은 자료 누락입니다. 정답이 인용하는 모든 수치는 실제로 화면에 표시되는 자료(figure) 또는 지문 문장 안에 있어야 합니다.`,
    };
  }

  // 2) distractor_error_types 개수·enum 검사.
  if (distractorErrorTypes.length !== distractorOptions.length) {
    return { ok: false, reason: `quant-evidence: distractor_error_types 개수(${distractorErrorTypes.length})가 오답 개수(${distractorOptions.length})와 다릅니다.` };
  }
  const allowed = new Set(QUANT_DISTRACTOR_ERROR_TYPES);
  for (const tag of distractorErrorTypes) {
    if (!allowed.has(tag as QuantDistractorErrorType)) {
      return { ok: false, reason: `quant-evidence: distractor_error_types에 알 수 없는 태그 "${tag}"가 있습니다(허용: ${QUANT_DISTRACTOR_ERROR_TYPES.join(", ")}).` };
    }
  }

  // 3) 오답의 수치는 정답과 달라야 하고(같은 값이면 변별 불가), "아무 숫자"가 아니라 자료 안 다른 셀 값이어야
  //    그럴듯한 오독(다른 행/열·인접 셀·인덱스 밀림)이 된다 — 자료와 완전히 무관한 숫자는 거부.
  for (let i = 0; i < distractorOptions.length; i += 1) {
    const nums = distinctive(distractorOptions[i]);
    if (nums.length === 0) {
      return { ok: false, reason: `quant-evidence: 오답 선택지 "${distractorOptions[i].slice(0, 60)}"에 수치가 없습니다.` };
    }
    // 2026-09-18(hard 재검증) — "수치 하나라도 겹치면 무조건 거부"는 hard 난이도에서 흔한 정당한
    // 오답 패턴(두 대상을 비교하는 복수 수치 선택지에서, 한쪽 수치는 정답과 같은 실제 값을 공유하고
    // 다른 쪽 수치만 잘못 읽은 경우 — 예: "6에서 8로" vs 오답 "6에서 7로")까지 "변별력 없음"으로
    // 오탐 거부해 hard 통과율을 끌어내렸다. 정답과 오답의 수치 집합이 **완전히 같을 때만**(오답이
    // 정답과 하나도 다르지 않을 때만) 변별력이 없다고 본다 — 부분적으로만 겹치면 정당한 근접 오답이다.
    const correctSet = new Set(correctNums);
    const numsSet = new Set(nums);
    const identical = numsSet.size === correctSet.size && Array.from(numsSet).every((n) => correctSet.has(n));
    if (identical) {
      return { ok: false, reason: `quant-evidence: 오답 선택지 "${distractorOptions[i].slice(0, 60)}"의 수치가 정답과 완전히 같습니다 — 변별력이 없습니다.` };
    }
    const plausible = nums.some((n) => cellSet.has(r9(n)) || derived.has(r9(n)));
    if (!plausible) {
      return {
        ok: false,
        reason: `quant-evidence: 오답 선택지 "${distractorOptions[i].slice(0, 60)}"의 수치(${nums.join(", ")})가 자료 어디에도 없습니다 — 오답은 실제 자료를 잘못 읽은 값(다른 행/열·인접 셀 등)이어야지 임의의 숫자면 안 됩니다.`,
      };
    }
  }

  return { ok: true };
}
