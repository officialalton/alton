import { describe, expect, it, vi, beforeEach } from "vitest";

// R9 corrective — 이 액션들은 의도적으로 앱 레벨 인가를 중복하지 않는다(실제
// 인가는 session_homework_attempts의 RLS/트리거에 위임 — 20261240000000).
// 여기서는 로그인한 사용자 id로 upsert가 올바른 인자로 호출되는지만 확인한다.
// RLS/트리거 자체의 강제는 homework-v3.integration.test.ts가 psql로 검증한다.

const upsertMock = vi.fn();
vi.mock("@/lib/auth", () => ({
  requireUser: vi.fn().mockResolvedValue({
    user: { id: "student1" },
    supabase: { from: () => ({ upsert: upsertMock }) },
  }),
}));

import { saveHomeworkV3Draft, submitHomeworkV3 } from "./homework-v3-actions";

beforeEach(() => {
  vi.clearAllMocks();
  upsertMock.mockResolvedValue({ error: null });
});

describe("saveHomeworkV3Draft", () => {
  it("submitted=false로, 본인 student_id로 upsert한다", async () => {
    await saveHomeworkV3Draft("item1", "내 답");
    expect(upsertMock).toHaveBeenCalledWith(
      { homework_item_id: "item1", student_id: "student1", response: "내 답", submitted: false },
      { onConflict: "homework_item_id,student_id" }
    );
  });

  it("에러를 던진다", async () => {
    upsertMock.mockResolvedValue({ error: { message: "권한 없음" } });
    await expect(saveHomeworkV3Draft("item1", "내 답")).rejects.toThrow("권한 없음");
  });
});

describe("submitHomeworkV3", () => {
  it("submitted=true로 upsert한다", async () => {
    await submitHomeworkV3("item1", "최종 답");
    expect(upsertMock).toHaveBeenCalledWith(
      { homework_item_id: "item1", student_id: "student1", response: "최종 답", submitted: true },
      { onConflict: "homework_item_id,student_id" }
    );
  });

  it("에러를 던진다(예: 이미 제출됨)", async () => {
    upsertMock.mockResolvedValue({ error: { message: "제출된 과제 답안은 더 이상 수정할 수 없습니다." } });
    await expect(submitHomeworkV3("item1", "재제출 시도")).rejects.toThrow(
      "제출된 과제 답안은 더 이상 수정할 수 없습니다."
    );
  });
});
