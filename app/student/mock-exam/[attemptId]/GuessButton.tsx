"use client";

/** 찍음 표시 토글(고정형·4모듈 응시 공용). 라벨은 "Guessed". */
export default function GuessButton({ guessed, onToggle, disabled = false }: { guessed: boolean; onToggle: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      aria-pressed={guessed}
      aria-label="Mark as guess"
      title={disabled ? "Select an answer first" : guessed ? "Marked as a guess" : "Mark as guess"}
      data-testid="mock-exam-guess-toggle"
      className={`flex h-10 items-center justify-center rounded-lg border-[1.5px] px-3 text-[13px] font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-ink/40 disabled:cursor-not-allowed disabled:opacity-40 ${
        guessed ? "border-ink bg-ink text-white" : "border-grey-200 text-grey-600 hover:border-ink hover:text-ink"
      }`}
    >
      Guessed
    </button>
  );
}
