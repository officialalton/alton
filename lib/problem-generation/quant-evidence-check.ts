// 2026-09-17 — command_of_evidence_quant(정량 근거) 결정적 검증기.
//
// 지금까지 이 스킬은 "figure(type:'data')가 존재한다"까지만 검사했다(rw-stimulus.ts checkRwStructure,
// problem-quality-contract.ts의 정답 수치 대조). 여기서는 evidence-model-check.ts와 같은 설계로,
// AI가 "이 값을 표에서 읽었다"고 자기보고하는 것을 신뢰하지 않고 실제 figure 데이터를 직접 훑어
// (1) 정답 선택지의 수치가 실제로 자료에 있거나(정확한 셀) 자료에서 파생 가능한 단순 통계(행/열 합·최댓값·
// 최솟값)인지, (2) 오답들의 수치가 자료와 "그냥 다른 숫자"가 아니라 그럴듯한 오독(다른 행/열, 인접 셀,
// 인덱스 한 칸 밀림)인지를 결정적으로 확인한다.

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

/** figure(jsonb)의 모든 숫자 셀 값을 모은다(열 이름·범주 이름 같은 문자열은 제외). */
function numericCells(figure: unknown): number[] {
  const out: number[] = [];
  const walk = (v: unknown) => {
    if (typeof v === "number") out.push(v);
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
        const nums = r.filter((c): c is number => typeof c === "number");
        if (nums.length) rows.push(nums);
      }
    }
  }
  if (fig && Array.isArray(fig.series)) {
    for (const s of fig.series) if (Array.isArray(s.values)) rows.push(s.values.filter((n) => typeof n === "number"));
  }
  if (fig && Array.isArray(fig.values)) rows.push(fig.values.filter((n) => typeof n === "number"));
  for (const r of rows) {
    if (!r.length) continue;
    out.add(r.reduce((a, b) => a + b, 0));
    out.add(Math.max(...r));
    out.add(Math.min(...r));
  }
  // 열 합(행렬 형태일 때).
  if (rows.length >= 2) {
    const cols = rows[0].length;
    for (let c = 0; c < cols; c += 1) {
      const col = rows.map((r) => r[c]).filter((n) => typeof n === "number");
      if (col.length) out.add(col.reduce((a, b) => a + b, 0));
    }
  }
  return out;
}

export function checkQuantEvidenceFields(
  skillCode: string,
  fields: QuantEvidenceFields,
  figure: unknown,
  correctOption: string,
  distractorOptions: string[]
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
  const cellSet = new Set(cells);

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
  const correctVerified = correctNums.some((n) => cellSet.has(n) || derived.has(n));
  if (!correctVerified) {
    return {
      ok: false,
      reason: `quant-evidence: 정답 선택지의 수치(${correctNums.join(", ")})가 실제 자료의 셀 값이나 단순 파생 통계(행/열 합·최댓값·최솟값)와 일치하지 않습니다 — AI 자기보고가 아니라 자료 자체로 확인한 결과입니다.`,
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
    if (nums.some((n) => correctNums.includes(n))) {
      return { ok: false, reason: `quant-evidence: 오답 선택지 "${distractorOptions[i].slice(0, 60)}"의 수치가 정답과 같습니다 — 변별력이 없습니다.` };
    }
    const plausible = nums.some((n) => cellSet.has(n) || derived.has(n));
    if (!plausible) {
      return {
        ok: false,
        reason: `quant-evidence: 오답 선택지 "${distractorOptions[i].slice(0, 60)}"의 수치(${nums.join(", ")})가 자료 어디에도 없습니다 — 오답은 실제 자료를 잘못 읽은 값(다른 행/열·인접 셀 등)이어야지 임의의 숫자면 안 됩니다.`,
      };
    }
  }

  return { ok: true };
}
