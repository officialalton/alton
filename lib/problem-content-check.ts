// 표준 렌더링 엔진 — 수식·선택지 블록 검증(2026-09-14). 그림 검증(lib/problem-figures/check)과 함께 render_check 에 실린다.
//   * KaTeX 로 실제 조판해 파싱 실패를 잡는다(저장 거부).
//   * 수식 밖에 남은 LaTeX 제어문(\frac, \sqrt …)은 원문 노출이라 거부.
//   * 선택지 수·중복·정답 인덱스 범위, 로마숫자 진술(statements)과 선택지 조합의 정합.
import { splitLearningContent } from "./render-learning-content";
import type { FigureIssue } from "./problem-figures/templates/_layout";
import { checkRwStructure } from "./rw-stimulus";

export type ContentInput = {
  format: string;
  passage: string;
  options: string[] | null;
  correctIndex: number | null;
  explanation: string;
  answers?: string[] | null;
  /** 로마숫자 진술 I, II, III … (선택지가 'I only', 'I and II' 같은 조합일 때). */
  statements?: string[] | null;
  /** 세부 기술 코드 — RW 코드면 구조화 자료 블록(Text 1/2·메모·빈칸·밑줄·정량 자료)을 검사한다. 없으면(옛 문제) 건너뛴다. */
  skillCode?: string | null;
  /** 그림 데이터 — RW 정량 근거 문항의 figure(type:'data') 요구 확인용. */
  figure?: unknown | null;
};

const ROMAN = ["I", "II", "III", "IV", "V"];

function mathErrors(field: string, text: string): FigureIssue[] {
  const issues: FigureIssue[] = [];
  for (const part of splitLearningContent(text)) {
    if (part.kind === "math-error") issues.push({ code: "math_parse", message: `${field}의 수식을 조판할 수 없습니다: ${part.source.slice(0, 60)}` });
    if (part.kind === "text" && /\\(frac|sqrt|left|right|begin|end|cdot|times|le|ge|neq|pi|theta|dfrac|tfrac|overline|angle|triangle)\b/.test(part.value)) {
      issues.push({ code: "latex_leak", message: `${field}에 수식 기호($…$) 밖에 LaTeX 제어문이 있습니다 — 그대로 노출됩니다: "${part.value.match(/\\[a-zA-Z]+[^\s]*/)?.[0] ?? ""}"` });
    }
    if (part.kind === "text" && /(^|[^$])\$(?![^$]*\$)/.test(part.value.replace(/\$\$/g, ""))) issues.push({ code: "math_unclosed", message: `${field}에 닫히지 않은 수식 기호 $ 가 있습니다.` });
  }
  return issues;
}

/** 선택지 하나가 로마숫자 조합인가 → 가리키는 진술 번호들. 조합이 아니면 null. */
export function parseRomanOption(option: string): number[] | null | "none" {
  const t = option.trim().replace(/\s+/g, " ");
  if (/^(neither|none( of the above| of these)?)$/i.test(t)) return "none";
  const m = t.match(/^((?:I{1,3}|IV|V)(?:\s*(?:,|and|,\s*and)\s*(?:I{1,3}|IV|V))*)\s*(only)?$/i);
  if (!m) return null;
  const nums = m[1].split(/\s*(?:,|and)\s*/i).filter(Boolean).map((r) => ROMAN.indexOf(r.toUpperCase()) + 1);
  if (nums.some((n) => n <= 0)) return null;
  return nums;
}

type Cond = { op: ">" | ">=" | "<" | "<=" | "=="; value: number; targetsOutput: boolean };

/** "greater than $40" 류 임계값 조건 문장에서 부등호·값·대상(계산값 vs 입력 변수)을 뽑는다. */
function parseNumericConditions(text: string, outWord: RegExp, inWord: RegExp): Cond[] {
  const conds: Cond[] = [];
  const patterns: { re: RegExp; op: Cond["op"] }[] = [
    { re: /\bgreater than\s*\$?(\d+(?:\.\d+)?)/gi, op: ">" },
    { re: /\bmore than\s*\$?(\d+(?:\.\d+)?)/gi, op: ">" },
    { re: /\bat least\s*\$?(\d+(?:\.\d+)?)/gi, op: ">=" },
    { re: /\bat most\s*\$?(\d+(?:\.\d+)?)/gi, op: "<=" },
    { re: /\bno more than\s*\$?(\d+(?:\.\d+)?)/gi, op: "<=" },
    { re: /\bless than\s*\$?(\d+(?:\.\d+)?)/gi, op: "<" },
  ];
  for (const { re, op } of patterns) {
    for (const m of text.matchAll(re)) {
      // 조건 하나당 좁은 국소 문맥만 본다 — 한 문장에 두 조건이 같이 있으면(흔한 형태) 문장 전체를 보면
      // 두 키워드가 다 걸려 대상을 못 정하니, 그 임계값 바로 앞뒤 구간만 잘라 판정한다.
      const idx = m.index ?? 0;
      const clause = text.slice(Math.max(0, idx - 60), idx + m[0].length + 15);
      const isOutput = outWord.test(clause);
      const isInput = inWord.test(clause);
      if (isOutput === isInput) continue; // 둘 다거나 둘 다 아니면 판정 못 함 — 건너뛴다(오탐 방지).
      conds.push({ op, value: Number(m[1]), targetsOutput: isOutput });
    }
  }
  return conds;
}

function evalCond(c: Cond, v: number): boolean {
  if (c.op === ">") return v > c.value;
  if (c.op === ">=") return v >= c.value;
  if (c.op === "<") return v < c.value;
  if (c.op === "<=") return v <= c.value;
  return Math.abs(v - c.value) < 1e-9;
}

/**
 * 2026-09-15 제품 오너 확인 — "식 + 조건 두 개(계산값 조건·입력값 조건)를 모두 만족하는 값은?" 형태 문항에서
 * 지문에 없는 조건(예: "정수만")을 해설이 지어내 정답을 하나로 억지로 맞춘 사례 발견(실제로는 선택지 두 개가
 * 조건을 만족). 식 하나 + 임계값 조건 두 개 + 선택지가 전부 순수 숫자일 때만, 각 선택지를 직접 대입해
 * 조건을 만족하는 선택지가 정확히 하나이고 그것이 정답과 같은지 결정적으로 확인한다. 패턴이 깔끔하지
 * 않으면(변수 이름 모호 등) 그냥 건너뛴다 — 오탐보다 누락이 안전하다.
 */
function checkNumericConditionAmbiguity(passage: string, options: string[] | null, correctIndex: number | null): FigureIssue[] {
  if (!options || options.length < 2 || correctIndex === null) return [];
  const optionValues = options.map((o) => Number(o.trim()));
  if (optionValues.some((v) => !Number.isFinite(v))) return [];
  const text = passage.replace(/\$/g, "");
  const formulaMatch = text.match(/\b([A-Za-z])\s*=\s*(-?\d+(?:\.\d+)?)\s*([a-zA-Z])\s*([+-])\s*(\d+(?:\.\d+)?)/);
  if (!formulaMatch) return [];
  const [, outVar, slopeS, inVar, signS, interceptS] = formulaMatch;
  if (outVar.toLowerCase() === inVar.toLowerCase()) return [];
  const slope = Number(slopeS), intercept = (signS === "-" ? -1 : 1) * Number(interceptS);
  const outWord = new RegExp(`\\b(${outVar}|total|cost|amount|price)\\b`, "i");
  const inWord = new RegExp(`\\b(${inVar}|hours?|time)\\b`, "i");
  const conds = parseNumericConditions(text, outWord, inWord);
  if (conds.length < 2 || !conds.some((c) => c.targetsOutput) || !conds.some((c) => !c.targetsOutput)) return [];
  const satisfies = (h: number) => conds.every((c) => evalCond(c, c.targetsOutput ? slope * h + intercept : h));
  const passing = optionValues.map((v, i) => ({ i, ok: satisfies(v) })).filter((x) => x.ok);
  if (passing.length === 1 && passing[0].i === correctIndex) return [];
  if (passing.length === 0) return [{ code: "condition_no_match", message: "지문의 식과 조건을 만족하는 선택지가 하나도 없습니다 — 값이나 조건을 다시 확인하세요." }];
  return [{
    code: "condition_ambiguous",
    message: `지문의 식과 조건을 만족하는 선택지가 ${passing.map((p) => options[p.i]).join(", ")}로 ${passing.length}개입니다(정답 표시: ${options[correctIndex]}) — 조건 하나가 지문에 없는데 암묵적으로 쓰였거나(예: "정수만"), 조건 자체가 정답을 하나로 좁히지 못합니다.`,
  }];
}

export function checkContent(input: ContentInput): FigureIssue[] {
  const issues: FigureIssue[] = [];
  issues.push(...checkRwStructure({ skillCode: input.skillCode ?? null, passage: input.passage, options: input.options, figure: input.figure ?? null }));
  issues.push(...mathErrors("지문", input.passage));
  issues.push(...mathErrors("해설", input.explanation ?? ""));
  (input.options ?? []).forEach((o, i) => issues.push(...mathErrors(`선택지 ${i + 1}`, o)));
  (input.statements ?? []).forEach((st, i) => issues.push(...mathErrors(`진술 ${ROMAN[i] ?? i + 1}`, st)));

  if (input.format === "mc") {
    const opts = (input.options ?? []).map((o) => o.trim());
    if (opts.length < 2 || opts.length > 5) issues.push({ code: "option_count", message: `객관식 선택지는 2~5개여야 합니다(지금 ${opts.length}개).` });
    if (opts.some((o) => !o)) issues.push({ code: "option_empty", message: "빈 선택지가 있습니다." });
    const dup = opts.filter((o, i) => opts.indexOf(o) !== i);
    if (dup.length) issues.push({ code: "option_duplicate", message: `선택지가 중복됩니다: ${Array.from(new Set(dup)).join(", ")}` });
    if (input.correctIndex === null || input.correctIndex < 0 || input.correctIndex >= opts.length) issues.push({ code: "correct_index", message: "정답 인덱스가 선택지 범위 안에 없습니다." });
    if (opts.some((o) => /^[a-z]\s*=\s*/i.test(o) && !/^[a-z]\s*=\s*[a-z]/i.test(o))) issues.push({ code: "option_style", message: "선택지는 값만 적습니다('x = 3' 이 아니라 '3')." });
    // 2026-09-15 — "선택지 자체가 그래프/도형 4개"인 문항은 아직 구현되지 않았다(구현 대기).
    // AI가 실제 그래프를 못 그리고 "Graph A" 같은 이름표만 텍스트로 만들면, 학생은 볼 것이 없는데
    // 그중 하나를 고르라는 셈이 되어 정답 표시 자체가 무의미해진다. 이 모양은 저장을 막는다(재생성 유도).
    if (opts.length >= 2 && opts.every((o) => /^(graph|figure|diagram|option)\s*[a-d1-4]$/i.test(o.trim()))) {
      issues.push({ code: "figure_choice_placeholder", message: "선택지가 실제 그래프/도형이 아니라 'Graph A' 같은 이름표뿐입니다 — 그래프 선택형(선택지 자체가 이미지 4개)은 아직 지원하지 않으니, 값을 직접 비교하는 형태로 다시 쓰세요." });
    }
    issues.push(...checkNumericConditionAmbiguity(input.passage, input.options, input.correctIndex));
  }
  const statements = (input.statements ?? []).map((s) => s.trim()).filter(Boolean);
  const opts = input.options ?? [];
  const romanOpts = opts.map(parseRomanOption);
  if (statements.length) {
    if (statements.length > 5) issues.push({ code: "statements", message: "진술은 5개까지입니다." });
    if (!romanOpts.length || romanOpts.some((r) => r === null)) issues.push({ code: "statements", message: "진술(I, II, III)이 있으면 모든 선택지는 'I only', 'I and II', 'I, II, and III', 'Neither' 같은 조합이어야 합니다." });
    for (const r of romanOpts) if (Array.isArray(r) && r.some((n) => n > statements.length)) issues.push({ code: "statements", message: `선택지가 없는 진술 번호를 가리킵니다(진술 ${statements.length}개).` });
    const covered = new Set(romanOpts.flatMap((r) => (Array.isArray(r) ? r : [])));
    for (let i = 1; i <= statements.length; i++) if (!covered.has(i)) issues.push({ code: "statements", message: `진술 ${ROMAN[i - 1]} 을 가리키는 선택지가 하나도 없습니다.` });
  } else if (opts.length >= 2 && romanOpts.every((r) => r !== null) && romanOpts.some((r) => Array.isArray(r))) {
    issues.push({ code: "statements", message: "선택지가 로마숫자 조합인데 진술(statements)이 없습니다 — 진술 I, II, III 을 statements 에 적으세요." });
  }
  if (input.format === "spr") {
    const ans = (input.answers ?? []).map((a) => a.trim()).filter(Boolean);
    if (!ans.length) issues.push({ code: "answers", message: "SPR 은 정답을 하나 이상 적어야 합니다." });
    for (const a of ans) if (!/^-?\d+(?:\.\d+)?(?:\/\d+)?$/.test(a.replace(/,/g, ""))) issues.push({ code: "answers", message: `SPR 정답 '${a}' 은 정수·소수·분수 형식이어야 합니다.` });
    for (const a of ans) { const body = a.replace("-", "").replace(/[./]/g, ""); if ((a.startsWith("-") && a.length > 6) || (!a.startsWith("-") && a.length > 5) || body.length > 6) issues.push({ code: "answers", message: `SPR 정답 '${a}' 은 양수 5자·음수 6자 안이어야 합니다.` }); }
  }
  const seen = new Set<string>();
  return issues.filter((i) => (seen.has(i.message) ? false : (seen.add(i.message), true)));
}
