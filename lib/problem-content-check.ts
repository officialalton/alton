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
