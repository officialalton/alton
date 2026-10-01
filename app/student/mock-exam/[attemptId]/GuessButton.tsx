"use client";

/** 찍음 표시 토글(고정형·4모듈 응시 공용). 라벨은 "Guessed". */
export default function GuessButton({ guessed, onToggle }: { guessed: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={guessed}
      aria-label="Mark as guess"
      title={guessed ? "Marked as a guess" : "Mark as guess"}
      data-testid="mock-exam-guess-toggle"
      className={`flex h-10 items-center justify-center rounded-lg border-[1.5px] px-3 text-[13px] font-semibold ${
        guessed ? "border-ink bg-ink text-white" : "border-grey-200 text-grey-600 hover:border-ink hover:text-ink"
      }`}
    >
      Guessed
    </button>
  );
}
