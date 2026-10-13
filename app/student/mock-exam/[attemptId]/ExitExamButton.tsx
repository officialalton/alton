"use client";

// 응시 화면 공통 "Exit" 버튼 + 1회 경고 대화상자(2026-10-13 오너). 문구는 화면마다 실제 동작에 맞춰 호출부가 넘긴다.
// 확인 → onBeforeExit(현재 답·시간 저장) → 연습 시험 목록으로 이동. 제출·시간 처리·섹션 시작에는 관여하지 않는다.
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

export const EXIT_DESTINATION = "/student?tab=mock-exam";

export default function ExitExamButton({
  consequences,
  onBeforeExit,
  testIdPrefix = "exam-exit",
}: {
  /** 나가면 무슨 일이 생기는지(저장·타이머·재개) — 실제 동작 그대로. */
  consequences: ReactNode;
  /** 확인 직후 이동 전에 실행할 저장 루틴(없으면 생략). 실패해도 이동은 막지 않는다. */
  onBeforeExit?: () => Promise<void> | void;
  testIdPrefix?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const leavingRef = useRef(false);
  const stayRef = useRef<HTMLButtonElement | null>(null);
  const exitRef = useRef<HTMLButtonElement | null>(null);
  const openerRef = useRef<HTMLButtonElement | null>(null);

  // 새로고침·탭 닫기: 확인된 나가기 중에는 막지 않는다. 이 컴포넌트는 응시 중 화면에만 마운트되므로 제출 뒤(결과 화면)에는 이미 해제돼 있다.
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (leavingRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  useEffect(() => {
    if (open) stayRef.current?.focus();
  }, [open]);

  const close = useCallback(() => {
    setOpen(false);
    openerRef.current?.focus();
  }, []);

  const confirmExit = useCallback(async () => {
    if (leavingRef.current) return;
    leavingRef.current = true;
    setLeaving(true);
    try {
      await onBeforeExit?.();
    } catch {
      /* 저장 실패가 나가기를 막지는 않는다 — 답은 이미 문항별로 저장돼 있다 */
    }
    router.push(EXIT_DESTINATION);
  }, [onBeforeExit, router]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.stopPropagation();
      if (!leaving) close();
      return;
    }
    if (e.key === "Tab") {
      const a = stayRef.current;
      const b = exitRef.current;
      if (!a || !b) return;
      const active = document.activeElement;
      if (e.shiftKey && active === a) { e.preventDefault(); b.focus(); }
      else if (!e.shiftKey && active === b) { e.preventDefault(); a.focus(); }
      else if (active !== a && active !== b) { e.preventDefault(); a.focus(); }
    }
  }

  return (
    <>
      <button
        ref={openerRef}
        type="button"
        onClick={() => setOpen(true)}
        data-testid={`${testIdPrefix}-open`}
        className="min-h-[44px] min-w-[44px] rounded-md border-[1.5px] border-grey-300 bg-white px-3 py-1.5 text-[12.5px] font-bold text-ink hover:bg-grey-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-ink/40 md:min-h-0 md:min-w-0 md:px-3.5"
      >
        Exit
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onKeyDown={onKeyDown}>
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={`${testIdPrefix}-title`}
            aria-describedby={`${testIdPrefix}-desc`}
            className="mx-4 w-full max-w-[420px] rounded-xl bg-white p-6 shadow-lg"
            data-testid={`${testIdPrefix}-dialog`}
          >
            <h2 id={`${testIdPrefix}-title`} className="text-[16px] font-extrabold text-ink">Leave this exam?</h2>
            <div id={`${testIdPrefix}-desc`} className="mt-2 space-y-1.5 text-[13px] leading-relaxed text-grey-600">{consequences}</div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                ref={stayRef}
                type="button"
                onClick={close}
                disabled={leaving}
                data-testid={`${testIdPrefix}-stay`}
                className="min-h-[44px] rounded-lg bg-ink px-4 py-2 text-[13px] font-bold text-white disabled:opacity-50 md:min-h-0"
              >
                Stay in exam
              </button>
              <button
                ref={exitRef}
                type="button"
                onClick={() => void confirmExit()}
                disabled={leaving}
                data-testid={`${testIdPrefix}-confirm`}
                className="min-h-[44px] rounded-lg border-[1.5px] border-grey-300 px-4 py-2 text-[13px] font-semibold text-ink disabled:opacity-50 md:min-h-0"
              >
                {leaving ? "Saving…" : "Exit exam"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
