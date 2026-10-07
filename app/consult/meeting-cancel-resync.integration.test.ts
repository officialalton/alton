import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// 2026-09-29(20261914000000): 미팅 취소 → Calendar 이벤트 삭제, 취소 후 재신청, 동기화 실패 재시도(즉시/크론/관리자 버튼/5회 상한/claim).
// 실제 로컬 DB + 서버 액션 코드. Google Calendar 는 전부 목(외부 호출 없음). 재실행 안전: 실행 ID 전용 컨설턴트·가족·관리자만 만들고 정리한다.

const DB_URL = process.env.SUPABASE_TEST_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54422/postgres";
const SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const admin = createClient(process.env.SUPABASE_TEST_API_URL ?? "http://127.0.0.1:54421", SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const RUN = randomUUID().slice(0, 8);
const TAG = `meet-resync-${RUN}`;
const CA = randomUUID();
const CB = randomUUID();
const ADMIN = randomUUID();
const GUARDIAN = randomUUID();
const HOUSEHOLD = randomUUID();

const { createMock, patchMock, deleteMock, afterQueue } = vi.hoisted(() => ({
  createMock: vi.fn(),
  patchMock: vi.fn(),
  deleteMock: vi.fn(),
  afterQueue: [] as Array<() => unknown>,
}));
let currentUser = "";

vi.mock("@/lib/google-calendar", () => ({
  createCalendarEventWithMeet: (...a: unknown[]) => createMock(...a),
  patchCalendarEventTime: (...a: unknown[]) => patchMock(...a),
  deleteCalendarEvent: (...a: unknown[]) => deleteMock(...a),
}));
vi.mock("@/lib/admin-auth", () => ({ requireAdmin: async () => ({ supabase: admin, adminUserId: ADMIN }) }));
vi.mock("@/lib/auth", () => ({
  requireUser: async () => ({ user: { id: currentUser }, profile: { role: "consultant" }, supabase: admin }),
}));
vi.mock("@/lib/supabase-admin", () => ({ createAdminClient: () => admin }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("next/server", async (orig) => ({
  ...(await orig<typeof import("next/server")>()),
  after: (cb: () => unknown) => {
    afterQueue.push(cb);
  },
}));

import { cancelAndRerequestMeetingRequest, resyncMeetingRequestCalendar, scheduleMeetingRequest, updateMeetingRequestStatus } from "@/app/admin/inquiry-and-meeting-actions";
import { cancelMyMeetingRequestAction } from "@/app/consultant/meeting-actions";
import { adminForceResyncMeetingCalendar, resyncMeetingCalendarNow, runMeetingCalendarResyncBatch, scheduleMeetingCalendarResync } from "@/lib/consultation/meeting-calendar-sync";
import { GET as cronGET } from "@/app/api/cron/resync-meeting-events/route";

function psql(sql: string): string {
  return execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", sql], { encoding: "utf-8" }).trim();
}
const BASE = Date.UTC(2060 + Math.floor(Math.random() * 30), Math.floor(Math.random() * 12), 1 + Math.floor(Math.random() * 27), 3, 0, 0);
let slot = 0;
const nextSlot = () => {
  slot += 3;
  return { s: new Date(BASE + slot * 3600_000).toISOString(), e: new Date(BASE + (slot + 1) * 3600_000).toISOString() };
};

function createUser(id: string, label: string, role: string) {
  psql(`insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token,
      email_change_token_new, email_change, email_change_token_current, phone_change, phone_change_token, reauthentication_token)
    values ('00000000-0000-0000-0000-000000000000', '${id}', 'authenticated', 'authenticated', '${TAG}-${label}@example.com',
      crypt('x', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '', '', '', '', '');
    insert into profiles (id, role, name) values ('${id}', '${role}', '${TAG}-${label}');`);
}

type Opts = { consultant?: string | null; status?: string; event?: string | null; sync?: string | null; retries?: number; times?: boolean };
function insertMeeting(o: Opts = {}): string {
  const consultant = o.consultant === undefined ? CA : o.consultant;
  const status = o.status ?? "scheduled";
  const t = o.times === false || status === "requested" || !consultant ? null : nextSlot();
  return psql(`insert into meeting_requests (household_id, requested_by, status, consultant_id, starts_at, ends_at, subject, content,
      google_event_id, google_meet_link, google_sync_status, google_sync_retry_count)
    values ('${HOUSEHOLD}', '${GUARDIAN}', '${status}', ${consultant ? `'${consultant}'` : "null"},
      ${t ? `'${t.s}'` : "null"}, ${t ? `'${t.e}'` : "null"}, '${TAG}-subj', '${TAG}-content',
      ${o.event ? `'${o.event}'` : "null"}, ${o.event ? `'https://meet.google.com/aaa-bbbb-ccc'` : "null"},
      ${o.sync ? `'${o.sync}'` : "null"}, ${o.retries ?? 0}) returning id;`).split("\n")[0];
}
const row = (id: string) =>
  JSON.parse(psql(`select row_to_json(m) from meeting_requests m where id='${id}'`)) as Record<string, unknown>;

beforeAll(() => {
  createUser(CA, "ca", "consultant");
  createUser(CB, "cb", "consultant");
  createUser(ADMIN, "admin", "admin");
  createUser(GUARDIAN, "g", "parent");
  psql(`insert into parents (id) values ('${GUARDIAN}');
    insert into households (id, primary_guardian_id) values ('${HOUSEHOLD}', '${GUARDIAN}');
    insert into household_members (household_id, profile_id, role, is_primary) values ('${HOUSEHOLD}', '${GUARDIAN}', 'guardian', true);`);
});

afterAll(() => {
  psql(`delete from meeting_requests where household_id = '${HOUSEHOLD}';
    delete from household_members where household_id = '${HOUSEHOLD}';
    delete from households where id = '${HOUSEHOLD}';
    delete from parents where id = '${GUARDIAN}';
    delete from profiles where id in ('${CA}','${CB}','${GUARDIAN}','${ADMIN}');
    delete from auth.users where id in ('${CA}','${CB}','${GUARDIAN}','${ADMIN}');`);
});

beforeEach(() => {
  vi.clearAllMocks();
  afterQueue.length = 0;
  process.env.CALENDAR_SYNC_ALLOW_REAL_CALLS = "true";
  createMock.mockResolvedValue({ googleEventId: `ev-created-${RUN}`, meetLink: "https://meet.google.com/xxx-yyyy-zzz" });
  patchMock.mockResolvedValue(undefined);
  deleteMock.mockResolvedValue(undefined);
  currentUser = CA;
});
afterAll(() => {
  delete process.env.CALENDAR_SYNC_ALLOW_REAL_CALLS;
});

describe("취소는 Calendar 이벤트를 지운다", () => {
  it("관리자 취소: 컨설턴트 캘린더에서 삭제(sendUpdates=all), 행은 cancelled 로 남고 이벤트 ID·삭제 시각 기록", async () => {
    const id = insertMeeting({ event: `ev-${RUN}-1`, sync: "succeeded" });
    await updateMeetingRequestStatus(id, "cancelled");
    expect(deleteMock).toHaveBeenCalledTimes(1);
    expect(deleteMock).toHaveBeenCalledWith({ teacherWorkspaceEmail: `${TAG}-ca@example.com`, googleEventId: `ev-${RUN}-1`, sendUpdates: "all" });
    const r = row(id);
    expect(r.status).toBe("cancelled");
    expect(r.google_sync_status).toBe("succeeded");
    expect(r.google_event_id).toBe(`ev-${RUN}-1`);
    expect(r.google_event_deleted_at).not.toBeNull();
    expect(r.google_sync_last_error).toBeNull();
  });

  it("이미 없는 이벤트(404/410 → 헬퍼가 성공 처리)는 성공이다", async () => {
    const id = insertMeeting({ event: `ev-${RUN}-gone`, sync: "succeeded" });
    deleteMock.mockResolvedValue(undefined); // deleteCalendarEvent 는 404/410 을 resolve 로 돌려준다(lib/google-calendar.ts)
    await updateMeetingRequestStatus(id, "cancelled");
    expect(row(id).google_sync_status).toBe("succeeded");
    expect(row(id).google_event_deleted_at).not.toBeNull();
  });

  it("삭제 실패: 그래도 취소되고, failed + 횟수 1 + 사유 기록 + 즉시 재시도가 예약된다", async () => {
    const id = insertMeeting({ event: `ev-${RUN}-fail`, sync: "succeeded" });
    deleteMock.mockRejectedValueOnce(new Error("Calendar 이벤트 삭제 실패 (status 500)"));
    await updateMeetingRequestStatus(id, "cancelled");
    const r = row(id);
    expect(r.status).toBe("cancelled");
    expect(r.google_sync_status).toBe("failed");
    expect(r.google_sync_retry_count).toBe(1);
    expect(String(r.google_sync_last_error)).toContain("status 500");
    expect(r.google_event_deleted_at).toBeNull();
    expect(r.google_sync_claimed_at).toBeNull();
    expect(afterQueue).toHaveLength(1); // 즉시 재시도(after)
    await afterQueue[0]();
    expect(row(id).google_sync_status).toBe("succeeded");
    expect(row(id).google_event_deleted_at).not.toBeNull();
  });

  it("실제 Google 호출이 꺼져 있으면: 취소는 되고, 삭제는 시도하지 않고 failed(횟수 0)로 재시도 대기", async () => {
    process.env.CALENDAR_SYNC_ALLOW_REAL_CALLS = "false";
    const id = insertMeeting({ event: `ev-${RUN}-off`, sync: "succeeded" });
    await updateMeetingRequestStatus(id, "cancelled");
    expect(deleteMock).not.toHaveBeenCalled();
    const r = row(id);
    expect(r.status).toBe("cancelled");
    expect(r.google_sync_status).toBe("failed");
    expect(r.google_sync_retry_count).toBe(0);
    expect(String(r.google_sync_last_error)).toContain("CALENDAR_SYNC_ALLOW_REAL_CALLS");
    expect(afterQueue).toHaveLength(0);
    // 배치도 꺼져 있으면 아무것도 claim 하지 않는다
    expect((await runMeetingCalendarResyncBatch()).enabled).toBe(false);
    expect(row(id).google_sync_status).toBe("failed");
  });

  it("이벤트가 없는 미팅 취소는 Google 호출 없이 취소만 한다", async () => {
    const id = insertMeeting({ status: "confirming", consultant: null });
    await updateMeetingRequestStatus(id, "cancelled");
    expect(deleteMock).not.toHaveBeenCalled();
    expect(row(id).status).toBe("cancelled");
  });

  it("컨설턴트 취소: 본인 미팅만, 같은 경로로 이벤트 삭제. 남의 미팅은 거절", async () => {
    const mine = insertMeeting({ event: `ev-${RUN}-cmine`, sync: "succeeded" });
    const theirs = insertMeeting({ consultant: CB, event: `ev-${RUN}-cb`, sync: "succeeded" });
    currentUser = CA;
    await expect(cancelMyMeetingRequestAction(theirs)).rejects.toThrow("You can only cancel meetings assigned to you.");
    expect(row(theirs).status).toBe("scheduled");
    await cancelMyMeetingRequestAction(mine);
    expect(deleteMock).toHaveBeenCalledWith(expect.objectContaining({ googleEventId: `ev-${RUN}-cmine`, teacherWorkspaceEmail: `${TAG}-ca@example.com` }));
    expect(row(mine).status).toBe("cancelled");
    expect(row(mine).google_event_deleted_at).not.toBeNull();
  });

  it("완료된 미팅은 취소할 수 없다(DB), 이미 취소된 미팅 재취소는 멱등", async () => {
    const done = insertMeeting({ status: "completed", event: `ev-${RUN}-done`, sync: "succeeded" });
    await expect(updateMeetingRequestStatus(done, "cancelled")).rejects.toThrow("A completed meeting cannot be canceled");
    expect(deleteMock).not.toHaveBeenCalled();
    const id = insertMeeting({ event: `ev-${RUN}-twice`, sync: "succeeded" });
    await updateMeetingRequestStatus(id, "cancelled");
    await updateMeetingRequestStatus(id, "cancelled");
    expect(deleteMock).toHaveBeenCalledTimes(1);
  });

  it("안전망 트리거: RLS 등 직접 status=cancelled 로 바꿔도 삭제 대기(failed)로 표시되고 크론이 지운다", async () => {
    const id = insertMeeting({ event: `ev-${RUN}-raw`, sync: "succeeded" });
    psql(`update meeting_requests set status='cancelled' where id='${id}'`);
    expect(row(id).google_sync_status).toBe("failed");
    const out = await runMeetingCalendarResyncBatch();
    expect(out.claimed).toBeGreaterThanOrEqual(1);
    expect(deleteMock).toHaveBeenCalledWith(expect.objectContaining({ googleEventId: `ev-${RUN}-raw` }));
    expect(row(id).google_sync_status).toBe("succeeded");
  });
});

describe("취소 후 재신청", () => {
  it("옛 행은 취소로 남고, 새 요청은 시간·컨설턴트·이벤트 없이 requested + 옛 행 링크 + 이력, 이벤트는 삭제", async () => {
    const id = insertMeeting({ event: `ev-${RUN}-rr`, sync: "succeeded" });
    const res = await cancelAndRerequestMeetingRequest(id);
    expect(res.calendar).toBe("deleted");
    expect(deleteMock).toHaveBeenCalledTimes(1);
    const old = row(id);
    expect(old.status).toBe("cancelled");
    expect(old.consultant_id).toBe(CA); // 이력 보존
    expect(old.google_event_id).toBe(`ev-${RUN}-rr`);
    const n = row(res.newRequestId);
    expect(n).toMatchObject({
      status: "requested",
      consultant_id: null,
      starts_at: null,
      ends_at: null,
      google_event_id: null,
      google_meet_link: null,
      rescheduled_from_id: id,
      household_id: HOUSEHOLD,
      requested_by: GUARDIAN,
      subject: `${TAG}-subj`,
      content: `${TAG}-content`,
    });
    expect(psql(`select count(*) from meeting_request_assignment_history where meeting_request_id='${id}' and prior_consultant_id='${CA}' and new_consultant_id is null and actor_id='${ADMIN}'`)).toBe("1");
    // 이후 기존 흐름: 다른 컨설턴트 배정 → 다시 확정
    psql(`select set_config('request.jwt.claims', '{"sub":"${ADMIN}","role":"authenticated"}', true); set local role authenticated; select admin_assign_meeting_consultant('${res.newRequestId}','${CB}','re');`);
    expect(row(res.newRequestId).consultant_id).toBe(CB);
    const t = nextSlot();
    await scheduleMeetingRequest({ meetingRequestId: res.newRequestId, startsAt: t.s, endsAt: t.e });
    expect(createMock).toHaveBeenCalledTimes(1);
    expect(createMock.mock.calls[0][0]).toMatchObject({ teacherWorkspaceEmail: `${TAG}-cb@example.com`, attendeeEmail: `${TAG}-g@example.com` });
    expect(row(res.newRequestId).status).toBe("scheduled");
  });

  it("이미 취소된 미팅·완료된 미팅은 재신청할 수 없고 새 행이 생기지 않는다", async () => {
    const c = insertMeeting({ status: "cancelled" });
    await expect(cancelAndRerequestMeetingRequest(c)).rejects.toThrow("This meeting is already canceled");
    const d = insertMeeting({ status: "completed" });
    await expect(cancelAndRerequestMeetingRequest(d)).rejects.toThrow("A completed meeting");
    expect(psql(`select count(*) from meeting_requests where rescheduled_from_id in ('${c}','${d}')`)).toBe("0");
  });

  it("삭제 실패여도 재신청은 성립한다(옛 행은 cancelled+failed, 새 행 생성)", async () => {
    const id = insertMeeting({ event: `ev-${RUN}-rrfail`, sync: "succeeded" });
    deleteMock.mockRejectedValueOnce(new Error("boom"));
    const res = await cancelAndRerequestMeetingRequest(id);
    expect(res.calendar).toBe("pending");
    expect(row(id).status).toBe("cancelled");
    expect(row(id).google_sync_status).toBe("failed");
    expect(row(res.newRequestId).status).toBe("requested");
  });
});

describe("동기화 실패 재시도", () => {
  it("일정 확정 시 Google 호출이 꺼져 있어 failed 로 저장되면 이유가 남고, 켜진 뒤 즉시 재시도(after)가 이벤트를 만든다", async () => {
    const id = insertMeeting({ status: "confirming" });
    const t = nextSlot();
    createMock.mockRejectedValueOnce(new Error("not implemented: CALENDAR_SYNC_ALLOW_REAL_CALLS=true가 아니면 실제 Calendar API를 호출하지 않습니다."));
    const res = await scheduleMeetingRequest({ meetingRequestId: id, startsAt: t.s, endsAt: t.e });
    expect(res.googleSyncStatus).toBe("failed");
    expect(row(id)).toMatchObject({ status: "scheduled", google_sync_status: "failed", google_event_id: null });
    expect(String(row(id).google_sync_last_error)).toContain("CALENDAR_SYNC_ALLOW_REAL_CALLS");
    expect(afterQueue).toHaveLength(1);
    await afterQueue[0]();
    expect(createMock).toHaveBeenCalledTimes(2);
    expect(row(id)).toMatchObject({ google_sync_status: "succeeded", google_event_id: `ev-created-${RUN}`, google_sync_last_error: null });
  });

  it("즉시 재시도는 실패해도 절대 throw 하지 않고 횟수만 올린다", async () => {
    const id = insertMeeting({ sync: "failed", retries: 1 });
    createMock.mockRejectedValue(new Error("nope"));
    scheduleMeetingCalendarResync(id);
    await expect(afterQueue[0]()).resolves.toBeUndefined();
    expect(row(id)).toMatchObject({ google_sync_status: "failed", google_sync_retry_count: 2 });
  });

  it("크론: CRON_SECRET 미설정 503, 틀린 토큰 401, 올바른 토큰이면 failed 행을 생성·패치·삭제로 회수한다", async () => {
    const create = insertMeeting({ sync: "failed", retries: 2 });
    const patch = insertMeeting({ sync: "failed", event: `ev-${RUN}-patch` });
    const del = insertMeeting({ status: "cancelled", sync: "failed", event: `ev-${RUN}-del` });
    const fine = insertMeeting({ sync: "succeeded", event: `ev-${RUN}-fine` });
    delete process.env.CRON_SECRET;
    expect((await cronGET(new Request("http://x/api/cron/resync-meeting-events"))).status).toBe(503);
    process.env.CRON_SECRET = `s-${RUN}`;
    expect((await cronGET(new Request("http://x", { headers: { authorization: "Bearer wrong" } }))).status).toBe(401);
    expect(createMock).not.toHaveBeenCalled();
    const res = await cronGET(new Request("http://x", { headers: { authorization: `Bearer s-${RUN}` } }));
    expect(res.status).toBe(200);
    expect(row(create)).toMatchObject({ google_sync_status: "succeeded", google_event_id: `ev-created-${RUN}` });
    expect(patchMock).toHaveBeenCalledWith(expect.objectContaining({ googleEventId: `ev-${RUN}-patch` }));
    expect(row(patch).google_sync_status).toBe("succeeded");
    expect(deleteMock).toHaveBeenCalledWith(expect.objectContaining({ googleEventId: `ev-${RUN}-del` }));
    expect(row(del).google_event_deleted_at).not.toBeNull();
    expect(row(fine).google_sync_status).toBe("succeeded");
    expect(deleteMock).not.toHaveBeenCalledWith(expect.objectContaining({ googleEventId: `ev-${RUN}-fine` }));
    delete process.env.CRON_SECRET;
  });

  it("5회 상한: 4번 실패한 행은 이번 실패로 reconciliation_needed(영구), 이후 크론은 건드리지 않는다. 이미 5회인 failed 행도 claim 제외", async () => {
    const last = insertMeeting({ sync: "failed", retries: 4 });
    const capped = insertMeeting({ sync: "failed", retries: 5 });
    createMock.mockRejectedValue(new Error("still down"));
    const out = await runMeetingCalendarResyncBatch(50);
    expect(out.permanent).toBeGreaterThanOrEqual(1);
    expect(row(last)).toMatchObject({ google_sync_status: "reconciliation_needed", google_sync_retry_count: 5 });
    expect(row(capped)).toMatchObject({ google_sync_status: "failed", google_sync_retry_count: 5 });
    createMock.mockClear();
    await runMeetingCalendarResyncBatch(50);
    expect(row(last).google_sync_retry_count).toBe(5);
    expect(row(capped).google_sync_retry_count).toBe(5);
    expect(createMock).not.toHaveBeenCalled();
  });

  it("claim 은 원자적: 동시에 두 번 claim/처리해도 한 번만 이벤트를 만든다(임대 중 재claim 불가, 만료 후 가능)", async () => {
    const id = insertMeeting({ sync: "failed" });
    createMock.mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 50));
      return { googleEventId: `ev-once-${RUN}`, meetLink: "https://meet.google.com/xxx-yyyy-zzz" };
    });
    const [a, b] = await Promise.all([resyncMeetingCalendarNow(id), resyncMeetingCalendarNow(id)]);
    expect([a, b].sort()).toEqual(["skipped", "synced"]);
    expect(createMock).toHaveBeenCalledTimes(1);

    const leased = insertMeeting({ sync: "failed" });
    const r1 = await admin.rpc("claim_meeting_calendar_syncs", { p_limit: 5, p_meeting_request_id: leased, p_max_attempts: 5 });
    const r2 = await admin.rpc("claim_meeting_calendar_syncs", { p_limit: 5, p_meeting_request_id: leased, p_max_attempts: 5 });
    expect((r1.data as unknown[]).length).toBe(1);
    expect((r2.data as unknown[]).length).toBe(0);
    psql(`update meeting_requests set google_sync_claimed_at = now() - interval '11 minutes' where id='${leased}'`);
    const r3 = await admin.rpc("claim_meeting_calendar_syncs", { p_limit: 5, p_meeting_request_id: leased, p_max_attempts: 5 });
    expect((r3.data as unknown[]).length).toBe(1);
  });

  it("claim RPC 는 일반 로그인 사용자가 호출할 수 없다", () => {
    expect(psql(`select has_function_privilege('authenticated','public.claim_meeting_calendar_syncs(int,uuid,int)','execute') or has_function_privilege('authenticated','public.cancel_meeting_request_core(uuid,uuid,boolean,text)','execute')`)).toBe("f");
  });

  it("생성 중에 취소되면 방금 만든 이벤트를 바로 지운다(고아 이벤트 방지)", async () => {
    const id = insertMeeting({ sync: "failed" });
    createMock.mockImplementation(async () => {
      psql(`update meeting_requests set status='cancelled' where id='${id}'`);
      return { googleEventId: `ev-race-${RUN}`, meetLink: "https://meet.google.com/xxx-yyyy-zzz" };
    });
    await resyncMeetingCalendarNow(id);
    expect(deleteMock).toHaveBeenCalledWith(expect.objectContaining({ googleEventId: `ev-race-${RUN}` }));
    expect(row(id).google_event_deleted_at).not.toBeNull();
  });
});

describe("관리자 Google 재동기화 버튼(서버 액션)", () => {
  it("영구 실패(5회)도 횟수를 초기화하고 다시 시도해 성공 처리한다", async () => {
    const id = insertMeeting({ sync: "reconciliation_needed", retries: 5 });
    expect(await resyncMeetingRequestCalendar(id)).toBe("synced");
    expect(row(id)).toMatchObject({ google_sync_status: "succeeded", google_sync_retry_count: 0, google_event_id: `ev-created-${RUN}` });
  });

  it("다시 실패하면 횟수 1부터 다시 센다", async () => {
    const id = insertMeeting({ sync: "reconciliation_needed", retries: 5 });
    createMock.mockRejectedValue(new Error("down"));
    expect(await resyncMeetingRequestCalendar(id)).toBe("failed");
    expect(row(id)).toMatchObject({ google_sync_status: "failed", google_sync_retry_count: 1 });
  });

  it("실패 상태가 아니거나 Google 호출이 꺼져 있으면 거절한다", async () => {
    const ok = insertMeeting({ sync: "succeeded", event: `ev-${RUN}-ok` });
    await expect(resyncMeetingRequestCalendar(ok)).rejects.toThrow("재동기화가 필요한 상태가 아닙니다");
    process.env.CALENDAR_SYNC_ALLOW_REAL_CALLS = "false";
    const f = insertMeeting({ sync: "failed" });
    await expect(adminForceResyncMeetingCalendar(f)).rejects.toThrow("CALENDAR_SYNC_ALLOW_REAL_CALLS");
    expect(createMock).not.toHaveBeenCalled();
  });
});
