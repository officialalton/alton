import { describe, expect, it, vi, beforeEach } from "vitest";

// 계획 문서 4절 P1: saveHomeworkAnswer/addHomeworkItem은 (RLS만으로 권한을
// 게이트하는, 코드베이스 전반의 일관된 패턴 — is_session_participant(session_id)
// 기반) 세션 참여자만 학생 답안 수정/과제 추가가 가능하다. 이 테스트는 정상
// 경로와, RLS 거부가 예외로 그대로 전파되는지(참여자가 아닌 세션에 대한 시도 =
// 권한 거부, 존재하지 않는 세션 = 잘못된 상태)를 검증한다.

const updateEqMock = vi.fn();
const insertSelectSingleMock = vi.fn();
const supabaseMock = {
  from: () => ({
    update: () => ({ eq: updateEqMock }),
    insert: () => ({ select: () => ({ single: insertSelectSingleMock }) }),
  }),
};

vi.mock("@/lib/auth", () => ({
  requireUser: vi.fn().mockResolvedValue({ user: { id: "student1" }, supabase: supabaseMock }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  updateEqMock.mockResolvedValue({ error: null });
  insertSelectSingleMock.mockResolvedValue({
    data: { id: "hw1", title: "과제1", description: null, student_answer: null },
    error: null,
  });
});

describe("saveHomeworkAnswer", () => {
  it("정상 호출이면 student_answer를 업데이트한다(정상 경로)", async () => {
    const { saveHomeworkAnswer } = await import("./homework-actions");
    await saveHomeworkAnswer("hw1", "답안입니다");
    expect(updateEqMock).toHaveBeenCalledWith("id", "hw1");
  });

  it("RLS(세션 참여자만 수정 가능)가 거부하면 예외가 그대로 전파된다(권한 거부)", async () => {
    updateEqMock.mockResolvedValue({ error: { message: "권한이 없습니다" } });
    const { saveHomeworkAnswer } = await import("./homework-actions");
    await expect(saveHomeworkAnswer("other-students-hw", "답안")).rejects.toThrow("권한이 없습니다");
  });
});

describe("addHomeworkItem", () => {
  it("정상 호출이면 과제 항목을 생성하고 매핑된 결과를 반환한다(정상 경로)", async () => {
    const { addHomeworkItem } = await import("./homework-actions");
    const result = await addHomeworkItem("s1", "과제1", "");
    expect(result).toEqual({ id: "hw1", title: "과제1", description: null, studentAnswer: null });
  });

  it("존재하지 않는 세션이면 예외가 그대로 전파된다(잘못된 상태)", async () => {
    insertSelectSingleMock.mockResolvedValue({
      data: null,
      error: { message: "insert or update on table \"homework_items\" violates foreign key constraint" },
    });
    const { addHomeworkItem } = await import("./homework-actions");
    await expect(addHomeworkItem("missing-session", "과제", "")).rejects.toThrow(/foreign key constraint/);
  });
});
