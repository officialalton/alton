import type { MockExamAttemptItem } from "./attempt-data";
import type { BreakdownRow, MockExamReport } from "./report";

// 결과 화면 Summary 의 "Key Insights" 카드 — 이미 내려온 문항 응답·리포트만으로 계산하는 순수 함수(추가 조회 없음).
// 새 정책은 만들지 않는다: 영역별 정답률 비교, 찍음 표시 집계, 문항당 평균 시간, 이전 회차와의 정답 수 차이만 보여준다.

export type Insight = { key: "strongest" | "focus" | "guessed" | "pace" | "unanswered" | "progress"; title: string; body: string; tone: "good" | "warn" | "neutral" };

const ratio = (r: BreakdownRow) => r.correct / r.total;
const pct = (r: BreakdownRow) => `${Math.round(ratio(r) * 100)}%`;

export function formatPace(seconds: number): string {
  const s = Math.round(seconds);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rest = s % 60;
  return rest === 0 ? `${m}m` : `${m}m ${rest}s`;
}

export function buildKeyInsights(
  report: MockExamReport,
  items: MockExamAttemptItem[],
  opts: { previous?: { attemptNo: number; correctCount: number; totalCount: number } | null; correctCount?: number | null; totalCount?: number } = {},
): Insight[] {
  const out: Insight[] = [];
  const domains = report.byDomain.filter((d) => d.total >= 2);
  if (domains.length >= 2) {
    const sorted = [...domains].sort((a, b) => ratio(b) - ratio(a) || b.total - a.total || a.key.localeCompare(b.key));
    const best = sorted[0];
    const worst = sorted[sorted.length - 1];
    out.push({ key: "strongest", title: "Strongest area", body: `${best.label} — ${best.correct}/${best.total} correct (${pct(best)}).`, tone: "good" });
    if (ratio(worst) < ratio(best)) {
      out.push({ key: "focus", title: "Needs focus", body: `${worst.label} — ${worst.correct}/${worst.total} correct (${pct(worst)}).`, tone: "warn" });
    }
  }

  const guessedAnswered = items.filter((i) => i.guessed && i.response);
  if (guessedAnswered.length > 0) {
    const right = guessedAnswered.filter((i) => i.correct).length;
    out.push({
      key: "guessed",
      title: "Guessed answers",
      body: `You marked ${guessedAnswered.length} ${guessedAnswered.length === 1 ? "answer" : "answers"} as a guess; ${right} ${right === 1 ? "was" : "were"} correct.`,
      tone: "neutral",
    });
  }

  const paceParts = report.bySection
    .filter((s) => s.timeSpentSeconds > 0 && s.total > 0)
    .map((s) => `${s.section === "rw" ? "R&W" : "Math"} ${formatPace(s.timeSpentSeconds / s.total)}`);
  if (paceParts.length > 0) {
    out.push({ key: "pace", title: "Time per question", body: `Average: ${paceParts.join(" · ")}.`, tone: "neutral" });
  }

  const unanswered = items.filter((i) => !i.response).length;
  if (unanswered > 0) {
    out.push({ key: "unanswered", title: "Unanswered", body: `${unanswered} ${unanswered === 1 ? "question was" : "questions were"} left blank.`, tone: "warn" });
  }

  const prev = opts.previous;
  if (prev && opts.correctCount !== null && opts.correctCount !== undefined) {
    const diff = opts.correctCount - prev.correctCount;
    out.push({
      key: "progress",
      title: `Compared with Attempt ${prev.attemptNo}`,
      body: diff === 0 ? "Same number of correct answers." : `${diff > 0 ? "+" : ""}${diff} correct ${Math.abs(diff) === 1 ? "answer" : "answers"} (${prev.correctCount} → ${opts.correctCount}).`,
      tone: diff > 0 ? "good" : diff < 0 ? "warn" : "neutral",
    });
  }
  return out;
}
