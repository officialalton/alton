import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import TeacherLessonScheduleTab from "./TeacherLessonScheduleTab";
import type { TeacherLessonScheduleItem } from "./lesson-schedule-actions";

const refreshMock = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: refreshMock }) }));

const lesson: TeacherLessonScheduleItem = {
  reservationId: "r1",
  sessionId: "s1",
  studentName: "지훈",
  subjectName: "SAT Math",
  startsAt: new Date().toISOString(),
  endsAt: new Date(Date.now() + 120 * 60_000).toISOString(),
  status: "confirmed",
  googleMeetLink: "https://meet.google.com/abc-defg-hij",
  googleSyncStatus: "synced",
  externalChangeStatus: "none",
  isTrial: false,
  smartNotesDriveFileId: null,
};

describe("TeacherLessonScheduleTab", () => {
  it("수업이 없으면 안내 문구를 보여준다", () => {
    render(
      <TeacherLessonScheduleTab
        lessons={[]}
        exceptions={[]}
        timezone="America/Los_Angeles"
        onCancel={vi.fn()}
        onRefresh={vi.fn()}
        onLoadExternalBusy={vi.fn().mockResolvedValue([])}
      />
    );
    expect(screen.getByText("예정된 수업이 없습니다.")).toBeInTheDocument();
  });

  it("금주 목록에 이번주 수업이 표시된다", () => {
    render(
      <TeacherLessonScheduleTab
        lessons={[lesson]}
        exceptions={[]}
        timezone="America/Los_Angeles"
        onCancel={vi.fn()}
        onRefresh={vi.fn()}
        onLoadExternalBusy={vi.fn().mockResolvedValue([])}
      />
    );
    expect(screen.getByText(/지훈 · SAT Math/)).toBeInTheDocument();
    expect(screen.getByText("정규")).toBeInTheDocument();
    expect(screen.getByText(/120분/)).toBeInTheDocument();
  });

  it("체험 수업은 '체험' 배지를 보여주고, Smart Notes가 연결됐으면 링크를 보여준다", () => {
    const trialLesson: TeacherLessonScheduleItem = {
      ...lesson,
      isTrial: true,
      endsAt: new Date(new Date(lesson.startsAt).getTime() + 60 * 60_000).toISOString(),
      smartNotesDriveFileId: "drive-file-1",
    };
    render(
      <TeacherLessonScheduleTab
        lessons={[trialLesson]}
        exceptions={[]}
        timezone="America/Los_Angeles"
        onCancel={vi.fn()}
        onRefresh={vi.fn()}
        onLoadExternalBusy={vi.fn().mockResolvedValue([])}
      />
    );
    expect(screen.getByText("체험")).toBeInTheDocument();
    expect(screen.getByText(/60분/)).toBeInTheDocument();
    const link = screen.getByText("Smart Notes 보기");
    expect(link.closest("a")).toHaveAttribute("href", "https://drive.google.com/file/d/drive-file-1/view");
  });

  it("Smart Notes가 아직 연결 안 됐으면 링크를 보여주지 않는다", () => {
    render(
      <TeacherLessonScheduleTab
        lessons={[lesson]}
        exceptions={[]}
        timezone="America/Los_Angeles"
        onCancel={vi.fn()}
        onRefresh={vi.fn()}
        onLoadExternalBusy={vi.fn().mockResolvedValue([])}
      />
    );
    expect(screen.queryByText("Smart Notes 보기")).not.toBeInTheDocument();
  });

  it("취소하면 onCancel이 호출되고 onRefresh가 실행된다", async () => {
    const onCancel = vi.fn().mockResolvedValue(undefined);
    const onRefresh = vi.fn().mockResolvedValue(undefined);
    render(
      <TeacherLessonScheduleTab lessons={[lesson]} exceptions={[]} timezone="America/Los_Angeles" onCancel={onCancel} onRefresh={onRefresh} onLoadExternalBusy={vi.fn().mockResolvedValue([])} />
    );
    fireEvent.click(screen.getByText("취소"));
    fireEvent.click(screen.getByText("취소 확정"));
    await waitFor(() => expect(onCancel).toHaveBeenCalledWith("r1", "선생님 취소"));
    expect(onRefresh).toHaveBeenCalled();
  });

  it("외부 변경이 감지되면 관리자 확인 필요 배지가 보인다", () => {
    render(
      <TeacherLessonScheduleTab
        lessons={[{ ...lesson, externalChangeStatus: "time_changed" }]}
        exceptions={[]}
        timezone="America/Los_Angeles"
        onCancel={vi.fn()}
        onRefresh={vi.fn()}
        onLoadExternalBusy={vi.fn().mockResolvedValue([])}
      />
    );
    expect(screen.getByText("관리자 확인 필요(외부 변경 감지)")).toBeInTheDocument();
  });

  it("월간 뷰에서 외부 바쁨 블록이 있는 날짜에 표시가 붙고, 선택 시 목록에 노출된다(제목·내용 없음)", async () => {
    const today = new Date();
    const busyDay = new Date(today.getFullYear(), today.getMonth(), 10, 19, 0, 0);
    const busyStart = busyDay.toISOString();
    const busyEnd = new Date(busyDay.getTime() + 60 * 60_000).toISOString();
    const onLoadExternalBusy = vi.fn().mockResolvedValue([{ startsAt: busyStart, endsAt: busyEnd }]);
    render(
      <TeacherLessonScheduleTab
        lessons={[]}
        exceptions={[]}
        timezone="America/Los_Angeles"
        onCancel={vi.fn()}
        onRefresh={vi.fn()}
        onLoadExternalBusy={onLoadExternalBusy}
      />
    );
    await waitFor(() => expect(onLoadExternalBusy).toHaveBeenCalled());
    fireEvent.click(screen.getByText("월간"));
    await waitFor(() => expect(screen.getByLabelText("다음 달")).toBeInTheDocument());

    const day10 = screen.getAllByText("10").find((el) => el.closest("button"));
    fireEvent.click(day10!.closest("button")!);

    await waitFor(() => expect(screen.getByText("외부 일정(예약 불가)")).toBeInTheDocument());
    expect(screen.getByText(/^외부 일정 ·/)).toBeInTheDocument();
  });

  it("외부 바쁨 블록 조회가 실패해도(미승인 등) 화면은 정상 렌더링된다", async () => {
    const onLoadExternalBusy = vi.fn().mockRejectedValue(new Error("not implemented"));
    render(
      <TeacherLessonScheduleTab
        lessons={[]}
        exceptions={[]}
        timezone="America/Los_Angeles"
        onCancel={vi.fn()}
        onRefresh={vi.fn()}
        onLoadExternalBusy={onLoadExternalBusy}
      />
    );
    expect(screen.getByText("예정된 수업이 없습니다.")).toBeInTheDocument();
  });
});
