"use client";

/** 🎲 찍음 표시 토글(고정형·4모듈 응시 공용). */
export default function GuessButton({ guessed, onToggle }: { guessed: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={guessed}
      aria-label="Mark as guess"
      title={guessed ? "Marked as a guess" : "Mark as guess"}
      data-testid="mock-exam-guess-toggle"
      className={`flex h-10 w-10 items-center justify-center rounded-lg border-[1.5px] text-[18px] leading-none ${
        guessed ? "border-ink bg-ink/5 opacity-100" : "border-grey-200 opacity-50 grayscale hover:opacity-100 hover:grayscale-0"
      }`}
    >
      🎲
    </button>
  );
}
