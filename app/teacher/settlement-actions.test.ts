import { describe, expect, it, vi, beforeEach } from "vitest";

// P4-2 — 수취 계좌 저장·조회, 서류 업로드의 정책 검증.
// 핵심: (1) 전체 계좌번호는 어떤 응답에도 들어가지 않는다, (2) 변경 이력이 남되
// 이력에도 전체 계좌번호를 복제하지 않는다, (3) 교사 계정만 사용할 수 있다,
// (4) 서류 업로드 실패 시 파일만 떠도는 상태를 남기지 않는다.

type QueryResult = { data: unknown; error: unknown };
type Call = { table: string; op: "insert" | "upsert"; payload: Record<string, unknown> };

const { adminFromMock, adminRpcMock, storageFromMock, requireUserMock } = vi.hoisted(() => ({
  adminFromMock: vi.fn(),
  adminRpcMock: vi.fn(),
  storageFromMock: vi.fn(),
  requireUserMock: vi.fn(),
}));

vi.mock("@/lib/supabase-admin", () => ({
  createAdminClient: () => ({ from: adminFromMock, rpc: adminRpcMock, storage: { from: storageFromMock } }),
}));
vi.mock("@/lib/auth", () => ({ requireUser: requireUserMock }));

import {
  getMyPayoutAccountAction,
  saveMyPayoutAccountAction,
  uploadMyDocumentAction,
  markPayoutNoticeReadAction,
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
  for (const m of ["select", "eq", "in", "order", "limit"]) chain[m] = () => chain;
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
  country: "KR",
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

describe("saveMyPayoutAccountAction — 최초 1회 등록만(이후 교사 수정 차단)", () => {
  it("신규 등록은 DB 함수(암호화·이력)로 보내고 응답에는 마스킹 값만 담는다", async () => {
    setQueue("teacher_payout_accounts", [{ data: null, error: null }]);
    adminRpcMock.mockResolvedValue({ data: { created: true }, error: null });

    const result = await saveMyPayoutAccountAction(VALID_INPUT);

    expect(result.status).toBe("saved");
    if (result.status === "saved") {
      expect(result.account.accountNumberMasked).toBe("****6789");
      expect(JSON.stringify(result.account)).not.toContain("110123456789");
    }
    expect(adminRpcMock).toHaveBeenCalledWith(
      "save_teacher_payout_account",
      expect.objectContaining({ p_teacher_id: "teacher-1", p_actor_id: "teacher-1", p_by_admin: false, p_number: "110123456789", p_currency: "KRW" })
    );
    // 평문 번호를 테이블에 직접 upsert하지 않는다.
    expect(calls.find((c) => c.op === "upsert")).toBeUndefined();
  });

  it("이미 등록돼 있으면 서버에서 거절한다(화면 숨김과 무관) — DB 함수도 호출하지 않는다", async () => {
    setQueue("teacher_payout_accounts", [{ data: { id: "a1" }, error: null }]);

    const result = await saveMyPayoutAccountAction(VALID_INPUT);

    expect(result).toEqual({ status: "invalid", message: "To change your account details, contact ALTON staff." });
    expect(adminRpcMock).not.toHaveBeenCalled();
  });

  it("동시 요청으로 DB가 LOCKED를 돌려줘도 같은 메시지로 거절한다", async () => {
    setQueue("teacher_payout_accounts", [{ data: null, error: null }]);
    adminRpcMock.mockResolvedValue({ data: null, error: { message: "LOCKED: 계좌 정보는 최초 등록 이후 …" } });
    expect(await saveMyPayoutAccountAction(VALID_INPUT)).toEqual({
      status: "invalid",
      message: "To change your account details, contact ALTON staff.",
    });
  });

  it("통화별 검증: 필수값 누락·KRW 자리수·USD ABA 라우팅이 틀리면 저장하지 않는다", async () => {
    expect(await saveMyPayoutAccountAction({ ...VALID_INPUT, accountHolderName: "  " })).toEqual({ status: "invalid", message: "Please enter the account holder name." });
    expect((await saveMyPayoutAccountAction({ ...VALID_INPUT, accountNumber: "12" })).status).toBe("invalid");
    const usdNoRouting = await saveMyPayoutAccountAction({ ...VALID_INPUT, currency: "USD", country: "US", accountNumber: "000123456789" });
    expect(usdNoRouting).toEqual({ status: "invalid", message: "A U.S. account needs a 9-digit ABA routing number." });
    expect(adminRpcMock).not.toHaveBeenCalled();
    expect(calls).toEqual([]);
  });

  it("교사 계정이 아니면 거부한다", async () => {
    requireUserMock.mockResolvedValue({
      user: { id: "someone" },
      supabase: {
        from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { role: "parent" }, error: null }) }) }) }),
      },
    });
    await expect(saveMyPayoutAccountAction(VALID_INPUT)).rejects.toThrow("Only teacher accounts");
    expect(adminRpcMock).not.toHaveBeenCalled();
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

describe("markPayoutNoticeReadAction", () => {
  it("본인(teacher_id) 스코프 + 아직 안 읽은 행만 읽음 처리한다", async () => {
    const eqs: Array<[string, unknown]> = [];
    let updated: Record<string, unknown> | null = null;
    let isCall: [string, unknown] | null = null;
    const chain: Record<string, unknown> = {};
    chain.update = (payload: Record<string, unknown>) => { updated = payload; return chain; };
    chain.eq = (col: string, val: unknown) => { eqs.push([col, val]); return chain; };
    chain.is = (col: string, val: unknown) => { isCall = [col, val]; return Promise.resolve({ error: null }); };
    adminFromMock.mockImplementation(() => chain);

    const result = await markPayoutNoticeReadAction("11111111-1111-1111-1111-111111111111");

    expect(result).toEqual({ ok: true });
    expect(eqs).toContainEqual(["teacher_id", "teacher-1"]);
    expect(eqs).toContainEqual(["id", "11111111-1111-1111-1111-111111111111"]);
    expect(isCall).toEqual(["read_at", null]);
    expect(updated).toHaveProperty("read_at");
  });

  it("id 형식이 이상하면 DB를 호출하지 않는다", async () => {
    adminFromMock.mockClear();
    expect(await markPayoutNoticeReadAction("x' or 1=1")).toEqual({ ok: false });
    expect(adminFromMock).not.toHaveBeenCalled();
  });
});
