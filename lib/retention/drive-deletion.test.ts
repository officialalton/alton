import { describe, expect, it, vi } from "vitest";
import { processDeletionQueue } from "./drive-deletion";

describe("processDeletionQueue (mock Drive)", () => {
  it("성공은 deleted, 실패는 오류와 함께 기록하고 다음 대상을 계속 처리한다", async () => {
    const markResult = vi.fn(async () => {});
    const deleteFile = vi.fn(async (id: string) => {
      if (id === "bad") throw new Error("Drive 500");
    });
    const res = await processDeletionQueue({
      claim: async () => [
        { id: "1", drive_file_id: "ok", attempts: 1 },
        { id: "2", drive_file_id: "bad", attempts: 1 },
        { id: "3", drive_file_id: "ok2", attempts: 1 },
      ],
      markResult,
      deleteFile,
    });
    expect(res).toEqual({ claimed: 3, deleted: 2, failed: 1 });
    expect(markResult).toHaveBeenCalledWith("2", false, "Drive 500");
    expect(markResult).toHaveBeenCalledWith("3", true);
  });
});
