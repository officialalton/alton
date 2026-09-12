import { describe, expect, it, vi, beforeEach } from "vitest";

// P4-2 — 수취 계좌 저장·조회, 서류 업로드의 정책 검증.
// 핵심: (1) 전체 계좌번호는 어떤 응답에도 들어가지 않는다, (2) 변경 이력이 남되
// 이력에도 전체 계좌번호를 복제하지 않는다, (3) 교사 계정만 사용할 수 있다,
// (4) 서류 업로드 실패 시 파일만 떠도는 상태를 남기지 않는다.

type QueryResult = { data: unknown; error: unknown };
type Call = { table: string; op: "insert" | "upsert"; payload: Record<string, unknown> };

const { adminFromMock, storageFromMock, requireUserMock } = vi.hoisted(() => ({
  adminFromMock: vi.fn(),
  storageFromMock: vi.fn(),
  requireUserMock: vi.fn(),
}));

vi.mock("@/lib/supabase-admin", () => ({
  createAdminClient: () => ({ from: adminFromMock, storage: { from: storageFromMock } }),
}));
vi.mock("@/lib/auth", () => ({ requireUser: requireUserMock }));

import {
  getMyPayoutAccountAction,
  saveMyPayoutAccountAction,
  uploadMyDocumentAction,
} from "./settlement-actions";
import { maskAccountNumber } from "./settlement-data";

const queues = new Map<string, QueryResult[]>();
let calls: Call[] = [];
const uploadMock = vi.fn();
const removeMock = vi.fn();

function setQueue(table: string, results: QueryResult[]) {
  queues.set(table, [...results]);
}
function nextResult(table: string): QueryResult {
  const queue = queues.get(table);
  if (!queue || queue.length === 0) return { data: null, error: null };
  return queue.length === 1 ? queue[0] : queue.shift()!;
}
function builder(table: string) {
  const chain: Record<string, unknown> = {};
  for (const m of ["select", "eq", "in", "order"]) chain[m] = () => chain;
  chain.insert = (payload: Record<string, unknown>) => {
    calls.push({ table, op: "insert", payload });
    return chain;
  };
  chain.upsert = (payload: Record<string, unknown>) => {
    calls.push({ table, op: "upsert", payload });
    return chain;
  };
  chain.maybeSingle = () => Promise.resolve(nextResult(table));
  chain.single = () => Promise.resolve(nextResult(table));
  chain.then = (onFulfilled: (v: QueryResult) => unknown, onRejected?: (e: unknown) => unknown) =>
    Promise.resolve(nextResult(table)).then(onFulfilled, onRejected);
  return chain;
}

const VALID_INPUT = {
  accountHolderName: "김선생",
  bankName: "국민은행",
  accountNumber: "110-123-456789",
  currency: "KRW",
};

beforeEach(() => {
  vi.clearAllMocks();
  queues.clear();
  calls = [];
  adminFromMock.mockImplementation((table: string) => builder(table));
  uploadMock.mockResolvedValue({ error: null });
  removeMock.mockResolvedValue({ error: null });
  storageFromMock.mockReturnValue({ upload: uploadMock, remove: removeMock });
  requireUserMock.mockResolvedValue({
    user: { id: "teacher-1" },
    supabase: {
      from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { role: "teacher" }, error: null }) }) }) }),
    },
  });
});

describe("maskAccountNumber", () => {
  it("끝 4자리만 남긴다", () => {
    expect(maskAccountNumber("6789")).toBe("****6789");
  });
});

describe("saveMyPayoutAccountAction", () => {
  it("신규 저장 시 전체 계좌번호를 응답에 넣지 않고 created 이력을 남긴다", async () => {
    setQueue("teacher_payout_accounts", [{ data: null, error: null }, { data: null, error: null }]);

    const result = await saveMyPayoutAccountAction(VALID_INPUT);

    expect(result.status).toBe("saved");
    if (result.status === "saved") {
      expect(result.account.accountNumberMasked).toBe("****6789");
      expect(JSON.stringify(result.account)).not.toContain("110-123-456789");
      expect(JSON.stringify(result.account)).not.toContain("123456789");
    }
    const upsert = calls.find((c) => c.table === "teacher_payout_accounts" && c.op === "upsert");
    expect(upsert?.payload).toMatchObject({ account_number: "110-123-456789", account_number_last4: "6789" });
    const event = calls.find((c) => c.table === "teacher_payout_account_events");
    expect(event?.payload).toMatchObject({ action: "created", new_last4: "6789", previous_last4: null });
    // 이력에는 전체 계좌번호를 복제하지 않는다.
    expect(JSON.stringify(event?.payload)).not.toContain("110-123-456789");
  });

  it("기존 계좌를 수정하면 바뀐 필드만 이력에 남는다", async () => {
    setQueue("teacher_payout_accounts", [
      {
        data: {
          id: "a1",
          account_holder_name: "김선생",
          bank_name: "신한은행",
          account_number_last4: "1111",
          currency: "KRW",
          country: null,
          swift_or_routing: null,
        },
        error: null,
      },
      { data: null, error: null },
    ]);

    await saveMyPayoutAccountAction(VALID_INPUT);

    const event = calls.find((c) => c.table === "teacher_payout_account_events");
    expect(event?.payload).toMatchObject({ action: "updated", previous_last4: "1111", new_last4: "6789" });
    expect(event?.payload.changed_fields).toEqual(["bank_name", "account_number"]);
  });

  it("필수값이 비었거나 계좌번호가 짧으면 저장하지 않는다", async () => {
    const noHolder = await saveMyPayoutAccountAction({ ...VALID_INPUT, accountHolderName: "  " });
    expect(noHolder).toEqual({ status: "invalid", message: "예금주를 입력해주세요." });

    const shortNumber = await saveMyPayoutAccountAction({ ...VALID_INPUT, accountNumber: "12" });
    expect(shortNumber.status).toBe("invalid");

    expect(calls).toEqual([]);
  });

  it("교사 계정이 아니면 거부한다", async () => {
    requireUserMock.mockResolvedValue({
      user: { id: "someone" },
      supabase: {
        from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { role: "parent" }, error: null }) }) }) }),
      },
    });
    await expect(saveMyPayoutAccountAction(VALID_INPUT)).rejects.toThrow("선생님 계정만");
    expect(calls).toEqual([]);
  });
});

describe("getMyPayoutAccountAction", () => {
  it("저장된 계좌를 마스킹해서 돌려준다(전체 번호를 select 하지 않는다)", async () => {
    setQueue("teacher_payout_accounts", [
      {
        data: {
          account_holder_name: "김선생",
          bank_name: "국민은행",
          account_number_last4: "6789",
          currency: "KRW",
          country: null,
          swift_or_routing: null,
          updated_at: "2026-09-12T00:00:00.000Z",
        },
        error: null,
      },
    ]);

    const result = await getMyPayoutAccountAction();
    expect(result?.accountNumberMasked).toBe("****6789");
    expect(JSON.stringify(result)).not.toContain("110-123");
  });

  it("등록 전이면 null을 돌려준다", async () => {
    setQueue("teacher_payout_accounts", [{ data: null, error: null }]);
    expect(await getMyPayoutAccountAction()).toBeNull();
  });
});

describe("uploadMyDocumentAction", () => {
  function formDataWith(file: File): FormData {
    const fd = new FormData();
    fd.append("file", file);
    return fd;
  }

  it("업로드 경로 첫 세그먼트를 교사 id로 만들고 메타 행을 남긴다", async () => {
    setQueue("teacher_documents", [
      {
        data: {
          id: "d1",
          file_name: "계약서.pdf",
          content_type: "application/pdf",
          size_bytes: 10,
          note: null,
          uploaded_at: "2026-09-12T00:00:00.000Z",
        },
        error: null,
      },
    ]);

    const result = await uploadMyDocumentAction(
      formDataWith(new File(["1234567890"], "계약서.pdf", { type: "application/pdf" }))
    );

    expect(result.status).toBe("uploaded");
    const [path] = uploadMock.mock.calls[0];
    expect(path.startsWith("teacher-1/")).toBe(true);
    expect(calls.find((c) => c.table === "teacher_documents")?.payload).toMatchObject({
      teacher_id: "teacher-1",
      file_name: "계약서.pdf",
    });
  });

  it("허용하지 않는 형식은 업로드 자체를 하지 않는다", async () => {
    const result = await uploadMyDocumentAction(
      formDataWith(new File(["x"], "script.exe", { type: "application/x-msdownload" }))
    );
    expect(result.status).toBe("invalid");
    expect(uploadMock).not.toHaveBeenCalled();
  });

  it("메타 행 생성이 실패하면 올라간 파일을 지워 고아 파일을 남기지 않는다", async () => {
    setQueue("teacher_documents", [{ data: null, error: { message: "insert failed" } }]);

    await expect(
      uploadMyDocumentAction(formDataWith(new File(["1"], "a.pdf", { type: "application/pdf" })))
    ).rejects.toThrow("insert failed");
    expect(removeMock).toHaveBeenCalledTimes(1);
  });
});
