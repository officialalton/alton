import type { LibraryProblem } from "@/app/student/materials-data";

/**
 * Server-side redaction: strip answer-revealing fields (correctIndex,
 * explanation) from a problem before it is ever serialized into the
 * client component's props. `options` is left untouched — the viewer
 * still needs to see the choices to answer.
 */
export function redactProblem(
  problem: LibraryProblem,
  canSeeAnswer: boolean
): LibraryProblem {
  if (canSeeAnswer) return problem;
  return {
    ...problem,
    correctIndex: null,
    explanation: "",
  };
}
