// POLICY-DECISIONS: 학습 이용 이벤트·하트비트 — 마운트 시 1회 호출, 실패는 삼킨다
import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const logLearningEventAction = vi.hoisted(() => vi.fn());
vi.mock("./activity-tracking", () => ({ logLearningEventAction, touchActivityAction: vi.fn() }));
vi.mock("@/app/session/[id]/problem-image-actions", () => ({ getProblemImageUrlAction: vi.fn() }));
vi.mock("./vocab-library-actions", () => ({}));

import ProblemHistoryTab from "./ProblemHistoryTab";
import VocabLibraryTab from "./VocabLibraryTab";

describe("learning-event calls on mount", () => {
  beforeEach(() => vi.clearAllMocks());
  it("ProblemHistoryTab logs mistake_review_opened once", () => {
    render(<ProblemHistoryTab entries={[]} />);
    expect(logLearningEventAction).toHaveBeenCalledTimes(1);
    expect(logLearningEventAction).toHaveBeenCalledWith("mistake_review_opened");
  });
  it("VocabLibraryTab logs vocab_study_opened once, but not when read-only", () => {
    const { unmount } = render(<VocabLibraryTab myWords={[]} books={[]} quizzes={[]} folders={[]} />);
    expect(logLearningEventAction).toHaveBeenCalledTimes(1);
    expect(logLearningEventAction).toHaveBeenCalledWith("vocab_study_opened");
    unmount();
    vi.clearAllMocks();
    render(<VocabLibraryTab myWords={[]} books={[]} quizzes={[]} folders={[]} readOnly />);
    expect(logLearningEventAction).not.toHaveBeenCalled();
  });
});
