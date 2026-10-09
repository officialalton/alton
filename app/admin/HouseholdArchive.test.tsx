import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

// P4-1(B) — 아카이브 확인 모달과 아카이브됨 목록의 UI 기준 검증.

const { previewMock, archiveMock, restoreMock, listMock } = vi.hoisted(() => ({
  previewMock: vi.fn(),
  archiveMock: vi.fn(),
  restoreMock: vi.fn(),
  listMock: vi.fn(),
}));
vi.mock("./household-archive-actions", () => ({
  previewHouseholdArchiveImpactAction: previewMock,
  archiveHouseholdAction: archiveMock,
  restoreHouseholdAction: restoreMock,
  listArchivedHouseholdsAction: listMock,
}));

import ArchivedHouseholdsList from "./ArchivedHouseholdsList";
import HouseholdArchiveControls from "./HouseholdArchiveControls";

beforeEach(() => {
  vi.clearAllMocks();
  previewMock.mockResolvedValue({
    childCount: 2,
    activeAssignmentCount: 1,
    cancellableReservationCount: 3,
    liveReservationCount: 0,
  });
  archiveMock.mockResolvedValue({ status: "completed", requestId: "req1", endedAssignments: 1, cancelledReservations: 3 });
  restoreMock.mockResolvedValue({ restored: true });
  listMock.mockResolvedValue([]);
});

describe("HouseholdArchiveControls", () => {
  it("확인 모달에 영향 수치와 보존·복원 정책을 보여준다", async () => {
    render(<HouseholdArchiveControls householdId="h1" guardianName="김보호자" onArchived={vi.fn()} />);
    fireEvent.click(screen.getByTestId("archive-household-h1"));

    expect(await screen.findByText("자녀 2명")).toBeInTheDocument();
    expect(screen.getByText("종료될 매칭 1건")).toBeInTheDocument();
    expect(screen.getByText(/취소될 미래 예약 3건/)).toBeInTheDocument();
    expect(screen.getByText(/완료된 수업과 이미 사용한 수업권은 그대로 보존/)).toBeInTheDocument();
    expect(screen.getByText(/복귀해도 예약·매칭은 자동으로 되살아나지 않습니다/)).toBeInTheDocument();
  });

  it("진행 중 수업이 있으면 실행 버튼을 막고 사유를 보여준다", async () => {
    previewMock.mockResolvedValue({
      childCount: 1,
      activeAssignmentCount: 1,
      cancellableReservationCount: 0,
      liveReservationCount: 1,
    });
    render(<HouseholdArchiveControls householdId="h1" guardianName="김보호자" onArchived={vi.fn()} />);
    fireEvent.click(screen.getByTestId("archive-household-h1"));

    expect(await screen.findByTestId("archive-blocked")).toHaveTextContent("진행 중인 수업이 1건");
    expect(screen.getByRole("button", { name: "아카이브" })).toBeDisabled();
    expect(archiveMock).not.toHaveBeenCalled();
  });

  it("실행에 성공하면 모달을 닫고 목록 갱신을 알린다", async () => {
    const onArchived = vi.fn();
    render(<HouseholdArchiveControls householdId="h1" guardianName="김보호자" onArchived={onArchived} />);
    fireEvent.click(screen.getByTestId("archive-household-h1"));
    await screen.findByText("자녀 2명");
    fireEvent.click(screen.getByRole("button", { name: "아카이브" }));

    await waitFor(() => expect(onArchived).toHaveBeenCalled());
    expect(archiveMock).toHaveBeenCalledWith("h1");
    expect(screen.getByTestId("archive-household-h1")).toBeInTheDocument(); // 다시 닫힌 상태
  });

  it("실패하면 사유를 보여주고 모달을 유지한다", async () => {
    archiveMock.mockResolvedValue({ status: "failed", requestId: "req1", error: "종료 게이트 실패" });
    render(<HouseholdArchiveControls householdId="h1" guardianName="김보호자" onArchived={vi.fn()} />);
    fireEvent.click(screen.getByTestId("archive-household-h1"));
    await screen.findByText("자녀 2명");
    fireEvent.click(screen.getByRole("button", { name: "아카이브" }));

    expect(await screen.findByText("종료 게이트 실패")).toBeInTheDocument();
  });
});

describe("ArchivedHouseholdsList", () => {
  it("빈 상태 문구를 보여준다", async () => {
    render(<ArchivedHouseholdsList />);
    expect(await screen.findByTestId("archived-households-empty")).toBeInTheDocument();
  });

  it("아카이브된 가구를 처리 요약과 함께 보여주고 복귀할 수 있다", async () => {
    listMock.mockResolvedValueOnce([
      {
        householdId: "h1",
        guardianId: "g1",
        guardianName: "김보호자",
        guardianEmail: "guardian@example.com",
        childrenNames: ["첫째", "둘째"],
        archivedAt: "2026-09-11T00:00:00.000Z",
        archivedByName: "관리자",
        endedAssignments: 1,
        cancelledReservations: 3,
      },
    ]);
    listMock.mockResolvedValueOnce([]);

    render(<ArchivedHouseholdsList />);
    expect(await screen.findByText("김보호자")).toBeInTheDocument();
    expect(screen.getByText("자녀: 첫째, 둘째")).toBeInTheDocument();
    expect(screen.getByText(/종료된 매칭 1건 · 취소된 예약 3건/)).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("restore-household-h1"));
    await waitFor(() => expect(restoreMock).toHaveBeenCalledWith("h1"));
    expect(await screen.findByTestId("archived-households-empty")).toBeInTheDocument();
  });
});
