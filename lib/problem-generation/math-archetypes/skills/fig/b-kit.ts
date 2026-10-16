// B형(figure_bundle) 조합 공용 키트 — 지문에 쓰이는 그림(stem) 하나 + 선택지 그림 4개를 한 문항에 담는다.
// verification_js 는 `const STEM = ...;`(기준 그림)과 `const CHOICES = [...];`(선택지 그림)을 모두 읽어 정답 선택지 번호를 다시 계산한다(둘 중 어느 쪽이 변조돼도 번호가 달라지거나 던져 검출된다).
import { GenFail, type Instance, type ChoiceDecl } from "../../types";
import type { Rng } from "../../rng";
import { ABCD, placeChoices } from "../../figure-kit";

export { placeChoices };
export function bundleInst(rng: Rng, o: { stimulus: string; question: string; stem: unknown; choices: unknown[]; correctIndex: number; rules: string[]; P: Record<string, number | string>; predicateJs: string; diagnoseJs: string; trace: [string, string][]; variant: string }): Instance {
  void rng;
  const decl: ChoiceDecl = { rules: o.rules, diagnoseJs: o.diagnoseJs, params: o.P };
  const body = `const pred = (c, i) => { ${o.predicateJs} };\nconst hits = CHOICES.map(pred); const idx = hits.reduce((a, h, i) => (h ? [...a, i] : a), []);\nif (idx.length !== 1) throw new Error('정답 선택지가 ' + idx.length + '개');\nreturn idx[0];`;
  const letter = ABCD[o.correctIndex];
  return {
    stimulus: o.stimulus, question: o.question, options: [...ABCD], correctIndex: o.correctIndex, answerKind: "index",
    explanation: `${o.trace.map(([ko], i) => `(${i + 1}) ${ko}`).join(" ")} 따라서 정답은 ${letter}이다.`, explanationEn: `${o.trace.map(([, en], i) => `(${i + 1}) ${en}`).join(" ")} So the answer is ${letter}.`,
    verificationJs: `const P = ${JSON.stringify(o.P)};\nconst STEM = ${JSON.stringify(o.stem)};\nconst CHOICES = ${JSON.stringify(o.choices)};\n${body}`, trace: o.trace.map(([ko]) => ko), variant: o.variant,
    distractors: o.rules.map((r, i) => ({ r, i })).filter(({ i }) => i !== o.correctIndex).map(({ r, i }) => ({ index: i, kind: "other" as const, reason: `오답 규칙 ${r}` })),
    figure: { type: "figure_bundle", stem: o.stem, choices: { type: "figure_choice", choices: o.choices } }, choice: decl,
  };
}
/** 정답 1 + 오답 3(규칙 id 포함)을 섞어 B형 인스턴스를 만든다. */
export function bundle(rng: Rng, o: { stimulus: string; question: string; stem: unknown; correct: unknown; wrong: { fig: unknown; rule: string }[]; P: Record<string, number | string>; predicateJs: string; diagnoseJs: string; trace: [string, string][]; variant: string }): Instance {
  const { choices, correctIndex, rules } = placeChoices(rng, o.correct, o.wrong);
  // 오답이 선언한 규칙으로 실제 진단되는지 TS 에서 먼저 확인한다(어긋나면 GenFail 로 시드를 건너뜀) — checkChoiceInstance 와 같은 판정.
  const diag = new Function("c", "ok", "P", "STEM", o.diagnoseJs) as (c: unknown, ok: unknown, P: unknown, STEM: unknown) => string | null;
  choices.forEach((c, i) => { if (i === correctIndex) return; let got: string | null = null; try { got = diag(c, o.correct, o.P, o.stem); } catch { got = null; } if (got !== rules[i]) throw new GenFail(`오답 규칙 불일치(${rules[i]} → ${String(got)})`); });
  return bundleInst(rng, { stimulus: o.stimulus, question: o.question, stem: o.stem, choices, correctIndex, rules, P: o.P, predicateJs: o.predicateJs, diagnoseJs: o.diagnoseJs, trace: o.trace, variant: o.variant });
}
export const SPR_NO_B = "정답이 선택지(그림 4개 중 하나)를 고르는 것이 문제의 핵심이라 선택지 없이는 성립하지 않는다";

// ───────────────────────── 키 기반 B형(좌표평면·입체 변환) ─────────────────────────
/**
 * 기준 그림(STEM)에서 정답 그림의 '정규 키'를 식으로 다시 계산하고(semanticJs → EXPECT), 선택지는 KEY(c) 로 읽어 비교한다.
 * 오답은 규칙 표(P.table = "키|규칙;…", 문자열이라 P 의 인쇄 검사 대상이 아님)로 진단한다 — 오답 규칙은 모두 정답과 다른 키를 가진 그림이어야 한다.
 */
export function keyBundle(rng: Rng, o: { stimulus: string; question: string; stem: unknown; correct: { fig: unknown; key: string }; wrongs: { fig: unknown; key: string; rule: string }[]; P: Record<string, number | string>; keyJs: string; semanticJs: string; trace: [string, string][]; variant: string }): Instance {
  if (new Set([o.correct.key, ...o.wrongs.map((w) => w.key)]).size !== 4) throw new GenFail("선택지 키 중복");
  const table = o.wrongs.map((w) => `${w.key}|${w.rule}`).join("\n");
  const P = { ...o.P, table };
  const predicateJs = `${o.keyJs}\n${o.semanticJs}\nreturn KEY(c)===EXPECT;`;
  const diagnoseJs = `${o.keyJs}\nconst T=Object.fromEntries(String(P.table).split('\\n').map(x=>{ const i=x.lastIndexOf('|'); return [x.slice(0,i), x.slice(i+1)]; })); return T[KEY(c)]||null;`;
  return bundle(rng, { stimulus: o.stimulus, question: o.question, stem: o.stem, correct: o.correct.fig, wrong: o.wrongs.map((w) => ({ fig: w.fig, rule: w.rule })), P, predicateJs, diagnoseJs, trace: o.trace, variant: o.variant });
}
