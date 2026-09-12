"use client";

// 2026-09-06 — 관리자 액션 버튼(예: "Calendar 재처리 실행", "체험수업권 지급
// 재처리")을 눌러도 성공/실패 여부가 눈에 띄게 표시되지 않고 그 상태로 머물러
// 있는 것처럼 보인다는 제품 오너 지적을 고친다. 여러 관리자 패널이 공용으로
// 쓸 수 있는 최소한의 토스트 하나만 둔다(전용 라이브러리 없이, 페이지 우하단
// 고정 배너 — 몇 초 후 자동으로 사라지되 손으로도 닫을 수 있다).
import { useCallback, useRef, useState } from "react";

export type ToastMessage = { id: number; kind: "success" | "error"; text: string };

const AUTO_DISMISS_MS = 5000;

export function useToasts() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (kind: ToastMessage["kind"], text: string) => {
      const id = nextId.current++;
      setToasts((prev) => [...prev, { id, kind, text }]);
      setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
    },
    [dismiss]
  );

  return { toasts, showToast, dismiss };
}

export function ToastStack({ toasts, dismiss }: { toasts: ToastMessage[]; dismiss: (id: number) => void }) {
  if (toasts.length === 0) return null;
  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-[360px]" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div
          key={t.id}
          data-testid="admin-toast"
          data-kind={t.kind}
          className={
            "text-[12.5px] font-semibold rounded-lg px-4 py-2.5 shadow-lg flex items-start justify-between gap-3 " +
            (t.kind === "success" ? "bg-ink text-white" : "bg-red text-white")
          }
        >
          <span>{t.text}</span>
          <button
            onClick={() => dismiss(t.id)}
            aria-label="알림 닫기"
            className="shrink-0 opacity-70 hover:opacity-100"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
