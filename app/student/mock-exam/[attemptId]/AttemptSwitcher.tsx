import type { MockExamAttemptDetail, MockExamAttemptSummary } from "@/lib/mock-exam/attempt-data";
import { attemptLabel } from "@/lib/mock-exam/open-list";

/** 재응시 회차 표시·전환. 회차가 하나뿐이면 아무것도 그리지 않는다. 최신 회차가 기본(호출부가 최신 id 를 연다). */
export default function AttemptSwitcher({
  attempt,
  attempts,
  attemptHref,
  onSelect,
}: {
  attempt: MockExamAttemptDetail;
  attempts?: MockExamAttemptSummary[];
  attemptHref?: (id: string) => string;
  onSelect?: (id: string) => void;
}) {
  const graded = (attempts ?? []).filter((a) => a.status === "graded").sort((a, b) => (a.attemptNo ?? 0) - (b.attemptNo ?? 0));
  if ((attempt.attemptTotal ?? 1) <= 1 && graded.length <= 1) return null;
  if (graded.length <= 1) {
    return <p className="mb-3 text-[12px] font-bold text-grey-500" data-testid="attempt-label">{attemptLabel(attempt.attemptNo)}</p>;
  }
  const latestNo = Math.max(...graded.map((a) => a.attemptNo ?? 0));
  return (
    <div role="group" aria-label="Attempts" className="mb-3 flex flex-wrap items-center gap-1.5" data-testid="attempt-switcher">
      {graded.map((a) => {
        const current = a.id === attempt.id;
        const cls = `rounded-full border px-3 py-1 text-[12px] font-bold ${current ? "border-ink bg-ink text-white" : "border-grey-300 text-grey-600 hover:bg-grey-100"}`;
        const text = `${attemptLabel(a.attemptNo)}${a.attemptNo === latestNo ? " (latest)" : ""}`;
        if (current) return <span key={a.id} aria-current="true" className={cls}>{text}</span>;
        return attemptHref ? (
          <a key={a.id} href={attemptHref(a.id)} className={cls}>{text}</a>
        ) : (
          <button key={a.id} type="button" onClick={() => onSelect?.(a.id)} className={cls}>{text}</button>
        );
      })}
    </div>
  );
}

