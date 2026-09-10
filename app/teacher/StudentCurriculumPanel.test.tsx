import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import StudentCurriculumPanel from "./StudentCurriculumPanel";
import * as actions from "./student-curriculum-actions";
import type { StudentCurriculum, EligibleLibrary } from "./student-curriculum-data";

vi.mock("./student-curriculum-actions", () => ({
  ensureActiveOverlay: vi.fn(),
  addCanonicalUnit: vi.fn(),
  createSupplementUnit: vi.fn(),
  excludeUnit: vi.fn(),
  moveUnit: vi.fn(),
  setUnitStatus: vi.fn(),
  setActiveKeywords: vi.fn(),
}));

const initial: StudentCurriculum = {
  overlayId: "overlay1",
  units: [
    {
      id: "u1",
      sourceUnitId: "src1",
      position: 1,
      unitTitle: "이차방정식",
      note: null,
      status: "not_started",
      statusChangedAt: null,
      keywordIds: ["kw1"],
      materialDocIds: [],
    },
  ],
};

const library: EligibleLibrary = {
  units: [],
  publishedDocs: [],
  keywords: [
    { id: "kw1", label: "이차방정식" },
    { id: "kw2", label: "판별식" },
  ],
};

describe("StudentCurriculumPanel — 2026-09-09(UAT 지적) 회차별 키워드 조정", () => {
  it("이미 태그된 키워드는 활성 표시되고, 새 키워드를 누르면 setActiveKeywords가 합쳐진 목록으로 호출된다", async () => {
    vi.mocked(actions.setActiveKeywords).mockResolvedValue(undefined);
    render(
      <StudentCurriculumPanel subjectEnrollmentId="se1" initial={initial} library={library} />
    );

    const kw1Button = screen.getByText("이차방정식", { selector: "button" });
    expect(kw1Button.className).toContain("bg-ink");

    fireEvent.click(screen.getByText("판별식"));
    await waitFor(() =>
      expect(actions.setActiveKeywords).toHaveBeenCalledWith("se1", "u1", ["kw1", "kw2"])
    );
  });

  it("이미 활성인 키워드를 다시 누르면 목록에서 제외된다", async () => {
    vi.mocked(actions.setActiveKeywords).mockResolvedValue(undefined);
    render(
      <StudentCurriculumPanel subjectEnrollmentId="se1" initial={initial} library={library} />
    );

    fireEvent.click(screen.getByText("이차방정식", { selector: "button" }));
    await waitFor(() => expect(actions.setActiveKeywords).toHaveBeenCalledWith("se1", "u1", []));
  });
});
