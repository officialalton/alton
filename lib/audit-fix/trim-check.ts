// 라운드 5: RW 지문 단어 수 정리(순수 함수). 모델이 제안한 짧은 지문이 "삭제만으로" 만들어졌는지, 해설·근거가 기대는 문구가 남았는지 기계적으로 확인한다.
// 모델 호출은 scripts/audit/r5-trim.ts. 여기는 DB·네트워크 없음.

/** 공백 기준 단어 수(감사 Q2 와 같은 기준). */
export const wordCount = (s: string | null | undefined): number => { const t = (s ?? "").trim(); return t ? t.split(/\s+/).length : 0; };

/** 비교용 토큰: 소문자, 앞뒤 문장부호 제거. 빈 토큰은 버린다. */
export function tokens(s: string): string[] {
  return s.toLowerCase().split(/\s+/).map((w) => w.replace(/^[^\p{L}\p{N}_$\\]+|[^\p{L}\p{N}_$\\]+$/gu, "")).filter(Boolean);
}

/** next 의 토큰이 old 토큰의 (순서를 지킨) 부분수열인가 = 삭제만 했고 새 단어를 더하지 않았다. */
export function isDeletionOnly(old: string, next: string): boolean {
  const a = tokens(old), b = tokens(next);
  let i = 0;
  for (const w of b) { while (i < a.length && a[i] !== w) i++; if (i === a.length) return false; i++; }
  return true;
}

export const BLANK = /_{3,}/g;
/** 빈칸·"Text 1/Text 2" 표지·줄바꿈 구조가 그대로인가. */
export function structureKept(old: string, next: string): string[] {
  const out: string[] = [];
  if ((old.match(BLANK)?.length ?? 0) !== (next.match(BLANK)?.length ?? 0)) out.push("빈칸 개수가 바뀜");
  for (const lab of ["Text 1", "Text 2"]) if (old.includes(lab) !== next.includes(lab)) out.push(`${lab} 표지가 사라짐/생김`);
  if ((old.match(/\n\s*\n/g)?.length ?? 0) !== (next.match(/\n\s*\n/g)?.length ?? 0) && /Text 1|Text 2/.test(old)) out.push("두 글 사이 구분이 바뀜");
  const lines = (s: string) => s.split("\n").filter((l) => l.trim()).length;
  if (/^\s*[•*-]\s/m.test(old) && lines(next) < 2) out.push("글머리표 노트 구조가 사라짐");
  return out;
}

/** 해설·근거 구간이 인용하는 따옴표 문구(4단어 이상)가 옛 지문에 있었다면 새 지문에도 남아야 한다. */
export function quotedSpansLost(old: string, next: string, ...refs: (string | null | undefined)[]): string[] {
  const nk = tokens(next).join(" "), ok = tokens(old).join(" ");
  const lost: string[] = [];
  for (const r of refs) {
    if (!r) continue;
    for (const m of r.matchAll(/["“]([^"”]{20,400})["”]/g)) {
      const q = tokens(m[1]).join(" ");
      if (q.split(" ").length >= 4 && ok.includes(q) && !nk.includes(q)) lost.push(m[1].slice(0, 80));
    }
  }
  return lost;
}

export type TrimDecision = { decision: "trim" | "keep"; new_passage?: string; reason: string };
export type TrimVerdict = { ok: boolean; words: number; issues: string[] };
/** 모델의 trim 제안을 기계 검사한다. 삭제만·구조 유지·인용 보존·목표 단어 수 이하(또는 실제로 줄어듦). */
export function checkTrim(old: string, d: TrimDecision, opts: { target: number; refs: (string | null | undefined)[] }): TrimVerdict {
  const issues: string[] = [];
  const np = d.new_passage ?? "";
  if (d.decision !== "trim" || !np.trim()) return { ok: false, words: wordCount(old), issues: ["trim 제안 아님"] };
  if (!isDeletionOnly(old, np)) issues.push("새 단어가 더해졌거나 순서가 바뀜(삭제만 허용)");
  issues.push(...structureKept(old, np));
  const lost = quotedSpansLost(old, np, ...opts.refs);
  if (lost.length) issues.push(`해설·근거가 인용한 문구가 삭제됨: ${lost.join(" | ")}`);
  const w = wordCount(np);
  if (w >= wordCount(old)) issues.push("줄어들지 않음");
  if (w > opts.target) issues.push(`목표(${opts.target}) 초과: ${w}단어`);
  if (w < 25) issues.push("25단어 미만");
  return { ok: issues.length === 0, words: w, issues };
}
