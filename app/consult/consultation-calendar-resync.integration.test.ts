import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// 2026-09-29(20261916000000): 첫 상담(consultations)의 Calendar 동기화 실패 재시도 — 즉시 after() 재시도 / 일 1회 크론(미팅과 한 번에) /
// 관리자 재동기화 버튼 / 5회 상한 / 원자적 claim / 멱등 / 생성 중 취소 레이스.
// 실제 로컬 DB + 서버 코드. Google Calendar·메일은 전부 목(외부 호출 없음). 재실행 안전: 실행 ID 전용 컨설턴트·가족만 만들고 정리한다.

const DB_URL = process.env.SUPABASE_TEST_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54422/postgres";
const SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const admin = createClient(process.env.SUPABASE_TEST_API_URL ?? "http://127.0.0.1:54421", SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const RUN = randomUUID().slice(0, 8);
const TAG = `consult-resync-${RUN}`;
const CA = randomUUID();
const CB = randomUUID();
const ADMIN = randomUUID();
const GUARDIAN = randomUUID();
const HOUSEHOLD = randomUUID();

const { createMock, patchMock, deleteMock, sendEmailMock, afterQueue } = vi.hoisted(() => ({
  createMock: vi.fn(),
  patchMock: vi.fn(),
  deleteMock: vi.fn(),
  sendEmailMock: vi.fn(),
  afterQueue: [] as Array<() => unknown>,
}));

vi.mock("@/lib/google-calendar", () => ({
  createCalendarEventWithMeet: (...a: unknown[]) => createMock(...a),
  patchCalendarEventTime: (...a: unknown[]) => patchMock(...a),
  deleteCalendarEvent: (...a: unknown[]) => deleteMock(...a),
}));
vi.mock("@/lib/email", () => ({ sendEmail: (...a: unknown[]) => sendEmailMock(...a) }));
vi.mock("@/lib/admin-auth", () => ({ requireAdmin: async () => ({ supabase: admin, adminUserId: ADMIN }), requireAdminOrCapability: async () => ({ supabase: admin, adminUserId: ADMIN }) }));
vi.mock("@/lib/supabase-admin", () => ({ createAdminClient: () => admin }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("next/server", async (orig) => ({
  ...(await orig<typeof import("next/server")>()),
  after: (cb: () => unknown) => {
    afterQueue.push(cb);
  },
}));

import { cancelConsultation } from "@/app/admin/consultation-actions";
import { resyncConsultationCalendar } from "@/app/admin/consultation-scheduling-actions";
import {
  adminForceResyncConsultationCalendar,
  resyncConsultationCalendarNow,
  runConsultationCalendarResyncBatch,
  scheduleConsultationCalendarResync,
  syncOneConsultationCalendarEvent,
} from "@/lib/consultation/calendar-sync";
import { runMeetingCalendarResyncBatch } from "@/lib/consultation/meeting-calendar-sync";
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

type Opts = { tz?: string; consultant?: string; status?: string; event?: string | null; sync?: string; retries?: number };
function insertConsultation(o: Opts = {}): string {
  const t = nextSlot();
  const status = o.status ?? "scheduled";
  return psql(`insert into consultations (source, contact_name, contact_email, contact_phone, category, status, requested_at,
      admissions_consultant_id, starts_at, ends_at, google_event_id, google_meet_link, google_sync_status, google_sync_retry_count, customer_timezone)
    values ('homepage','${TAG}','${TAG}-c@example.com','010','family','${status}',now(),'${o.consultant ?? CA}','${t.s}','${t.e}',
      ${o.event ? `'${o.event}'` : "null"}, ${o.event ? `'https://meet.google.com/aaa-bbbb-ccc'` : "null"}, '${o.sync ?? "pending"}', ${o.retries ?? 0}, ${o.tz ? `'${o.tz}'` : "null"}) returning id;`).split("\n")[0];
}
const row = (id: string) => JSON.parse(psql(`select row_to_json(c) from consultations c where id='${id}'`)) as Record<string, unknown>;
const rowsCreated: string[] = [];
const mk = (o: Opts = {}) => {
  const id = insertConsultation(o);
  rowsCreated.push(id);
  return id;
};

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
  // 상태 이벤트 원장은 삭제 금지 트리거가 있어 이 정리 세션에서만 트리거를 끈다(로컬 슈퍼유저, 이 실행 ID 행만).
  psql(`set session_replication_role = replica;
    delete from consultation_status_events where consultation_id in (select id from consultations where admissions_consultant_id in ('${CA}','${CB}'));
    delete from consultations where admissions_consultant_id in ('${CA}','${CB}');
    delete from meeting_requests where household_id = '${HOUSEHOLD}';
    delete from household_members where household_id = '${HOUSEHOLD}';
    delete from households where id = '${HOUSEHOLD}';
    delete from parents where id = '${GUARDIAN}';
    delete from profiles where id in ('${CA}','${CB}','${GUARDIAN}','${ADMIN}');
    delete from auth.users where id in ('${CA}','${CB}','${GUARDIAN}','${ADMIN}');`);
  delete process.env.CALENDAR_SYNC_ALLOW_REAL_CALLS;
  delete process.env.CRON_SECRET;
});

beforeEach(() => {
  vi.clearAllMocks();
  afterQueue.length = 0;
  process.env.CALENDAR_SYNC_ALLOW_REAL_CALLS = "true";
  createMock.mockResolvedValue({ googleEventId: `ev-created-${RUN}`, meetLink: "https://meet.google.com/xxx-yyyy-zzz" });
  patchMock.mockResolvedValue(undefined);
  deleteMock.mockResolvedValue(undefined);
  sendEmailMock.mockResolvedValue(undefined);
});

describe("첫 상담 Calendar 동기화 실패 → 즉시 재시도", () => {
  it("생성 실패: failed(횟수 1·사유·시도 시각) + after 재시도 예약, 재시도가 이벤트를 만들고 synced", async () => {
    const id = mk();
    createMock.mockRejectedValueOnce(new Error("Calendar API 요청 실패 (status 500)"));
    await syncOneConsultationCalendarEvent(id);
    const r = row(id);
    expect(r).toMatchObject({ google_sync_status: "failed", google_sync_retry_count: 1, google_event_id: null, google_sync_claimed_at: null });
    expect(String(r.google_sync_last_error)).toContain("status 500");
    expect(r.google_sync_last_attempt_at).not.toBeNull();
    expect(afterQueue).toHaveLength(1);
    await afterQueue[0]();
    expect(createMock).toHaveBeenCalledTimes(2);
    expect(row(id)).toMatchObject({ google_sync_status: "synced", google_event_id: `ev-created-${RUN}`, google_sync_last_error: null });
  });

  it("주최자는 배정된 컨설턴트 본인 Workspace 계정", async () => {
    const id = mk({ consultant: CB });
    await syncOneConsultationCalendarEvent(id);
    expect(createMock.mock.calls[0][0]).toMatchObject({ teacherWorkspaceEmail: `${TAG}-cb@example.com`, attendeeEmail: `${TAG}-c@example.com` });
  });

  it("취소 시 삭제 실패: 취소는 유지, failed(횟수 1) + 즉시 재시도가 삭제 완료", async () => {
    const id = mk({ event: `ev-${RUN}-cdel`, sync: "synced" });
    deleteMock.mockRejectedValueOnce(new Error("Calendar 이벤트 삭제 실패 (status 500)"));
    await cancelConsultation(id, "테스트");
    const r = row(id);
    expect(r).toMatchObject({ status: "cancelled", google_sync_status: "failed", google_sync_retry_count: 1, google_event_deleted_at: null });
    expect(afterQueue).toHaveLength(1);
    await afterQueue[0]();
    expect(row(id)).toMatchObject({ google_sync_status: "synced" });
    expect(row(id).google_event_deleted_at).not.toBeNull();
    expect(deleteMock).toHaveBeenLastCalledWith({ teacherWorkspaceEmail: `${TAG}-ca@example.com`, googleEventId: `ev-${RUN}-cdel`, sendUpdates: "all" });
  });

  it("즉시 재시도는 실패해도 throw 하지 않고, 실제 호출이 꺼져 있으면 예약도 하지 않는다", async () => {
    const id = mk({ sync: "failed", retries: 1 });
    createMock.mockRejectedValue(new Error("nope"));
    scheduleConsultationCalendarResync(id);
    await expect(afterQueue[0]()).resolves.toBeUndefined();
    expect(row(id)).toMatchObject({ google_sync_status: "failed", google_sync_retry_count: 2 });
    afterQueue.length = 0;
    process.env.CALENDAR_SYNC_ALLOW_REAL_CALLS = "false";
    scheduleConsultationCalendarResync(id);
    expect(afterQueue).toHaveLength(0);
    expect((await runConsultationCalendarResyncBatch()).enabled).toBe(false);
  });
});

describe("고객 시간대(customer_timezone) — 모든 동기화 경로가 행에서 읽는다", () => {
  const SEOUL = "Asia/Seoul";
  it("DB 가 지원 목록 밖 값을 거부하고 null 은 허용한다", () => {
    const id = mk();
    expect(() => psql(`update consultations set customer_timezone='Mars/Base' where id='${id}'`)).toThrow();
    psql(`update consultations set customer_timezone='${SEOUL}' where id='${id}'`);
    psql(`update consultations set customer_timezone=null where id='${id}'`);
  });

  it("첫 동기화·즉시 재시도(메모리 옵션 없이)·크론·관리자 재동기화·시간 변경 PATCH 모두 저장된 시간대를 쓴다", async () => {
    const id = mk({ tz: SEOUL });
    createMock.mockRejectedValueOnce(new Error("Calendar API 요청 실패 (status 500)"));
    await syncOneConsultationCalendarEvent(id);
    expect(createMock.mock.calls[0][0]).toMatchObject({ timezone: SEOUL });
    await afterQueue[0](); // 즉시 재시도
    expect(createMock.mock.calls[1][0]).toMatchObject({ timezone: SEOUL });
    expect(row(id).google_sync_status).toBe("synced");

    psql(`update consultations set google_sync_status='failed' where id='${id}'`);
    await runConsultationCalendarResyncBatch(50); // 크론 — 이벤트가 있으니 PATCH
    expect(patchMock.mock.calls.at(-1)![0]).toMatchObject({ timezone: SEOUL });

    psql(`update consultations set google_sync_status='failed', google_sync_retry_count=5 where id='${id}'`);
    await adminForceResyncConsultationCalendar(id);
    expect(patchMock.mock.calls.at(-1)![0]).toMatchObject({ timezone: SEOUL });

    const t = nextSlot();
    psql(`update consultations set starts_at='${t.s}', ends_at='${t.e}', google_sync_status='failed' where id='${id}'`);
    await resyncConsultationCalendarNow(id);
    expect(patchMock.mock.calls.at(-1)![0]).toMatchObject({ timezone: SEOUL, startsAt: new Date(t.s) });
  });

  it("null 이면 기존 기본값(America/Los_Angeles)", async () => {
    const id = mk();
    await syncOneConsultationCalendarEvent(id);
    expect(createMock.mock.calls[0][0]).toMatchObject({ timezone: "America/Los_Angeles" });
  });

  it("최종 실패 fallback 메일도 저장된 시간대로 표기한다", async () => {
    const id = mk({ tz: SEOUL, sync: "failed", retries: 4 });
    createMock.mockRejectedValue(new Error("Calendar API 요청 실패 (status 500)"));
    await resyncConsultationCalendarNow(id);
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    expect(String(sendEmailMock.mock.calls[0][0].html)).toContain("서울");
  });
});

describe("멱등성", () => {
  it("이벤트가 이미 있으면 다시 만들지 않고 PATCH, 두 번 돌려도 생성 호출은 1회", async () => {
    const id = mk({ sync: "failed" });
    await resyncConsultationCalendarNow(id);
    expect(createMock).toHaveBeenCalledTimes(1);
    psql(`update consultations set google_sync_status='failed' where id='${id}'`);
    await resyncConsultationCalendarNow(id);
    expect(createMock).toHaveBeenCalledTimes(1);
    expect(patchMock).toHaveBeenCalledWith(expect.objectContaining({ googleEventId: `ev-created-${RUN}` }));
  });

  it("이미 삭제된 취소 건은 다시 삭제하지 않는다", async () => {
    const id = mk({ event: `ev-${RUN}-d2`, sync: "synced" });
    await cancelConsultation(id, "x");
    expect(deleteMock).toHaveBeenCalledTimes(1);
    await cancelConsultation(id, "x");
    expect(deleteMock).toHaveBeenCalledTimes(1);
  });

  it("claim 은 원자적: 동시에 두 번 처리해도 한 번만 이벤트를 만든다(임대 중 재claim 불가, 만료 후 가능)", async () => {
    const id = mk({ sync: "failed" });
    createMock.mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 50));
      return { googleEventId: `ev-once-${RUN}`, meetLink: "https://meet.google.com/xxx-yyyy-zzz" };
    });
    const [a, b] = await Promise.all([resyncConsultationCalendarNow(id), resyncConsultationCalendarNow(id)]);
    expect([a, b].sort()).toEqual(["skipped", "synced"]);
    expect(createMock).toHaveBeenCalledTimes(1);

    const leased = mk({ sync: "failed" });
    const r1 = await admin.rpc("claim_consultation_calendar_syncs", { p_limit: 5, p_consultation_id: leased, p_max_attempts: 5 });
    const r2 = await admin.rpc("claim_consultation_calendar_syncs", { p_limit: 5, p_consultation_id: leased, p_max_attempts: 5 });
    expect((r1.data as unknown[]).length).toBe(1);
    expect((r2.data as unknown[]).length).toBe(0);
    psql(`update consultations set google_sync_claimed_at = now() - interval '11 minutes' where id='${leased}'`);
    const r3 = await admin.rpc("claim_consultation_calendar_syncs", { p_limit: 5, p_consultation_id: leased, p_max_attempts: 5 });
    expect((r3.data as unknown[]).length).toBe(1);
  });

  it("최초 경로(syncOne)와 재시도 경로도 서로 배제된다: 임대 중인 행은 syncOne 이 건드리지 않는다", async () => {
    const id = mk({ sync: "failed" });
    psql(`update consultations set google_sync_claimed_at = now() where id='${id}'`);
    await syncOneConsultationCalendarEvent(id);
    expect(createMock).not.toHaveBeenCalled();
  });

  it("처리 중 서버가 죽어 임대가 만료된 pending 행은 회수하고, 임대 없는 기본 pending 은 건드리지 않는다", async () => {
    const stuck = mk({ sync: "pending" });
    psql(`update consultations set google_sync_claimed_at = now() - interval '11 minutes' where id='${stuck}'`);
    const fresh = mk({ sync: "pending" });
    await runConsultationCalendarResyncBatch(200);
    expect(row(stuck).google_sync_status).toBe("synced");
    expect(row(fresh).google_sync_status).toBe("pending");
  });

  it("claim RPC 는 일반 로그인 사용자가 호출할 수 없다", () => {
    expect(psql(`select has_function_privilege('authenticated','public.claim_consultation_calendar_syncs(int,uuid,int)','execute') or has_function_privilege('anon','public.claim_consultation_calendar_syncs(int,uuid,int)','execute')`)).toBe("f");
  });

  it("생성 중에 취소되면 방금 만든 이벤트를 바로 지운다(고아 이벤트 방지)", async () => {
    const id = mk({ sync: "failed" });
    createMock.mockImplementation(async () => {
      psql(`update consultations set status='cancelled' where id='${id}'`);
      return { googleEventId: `ev-race-${RUN}`, meetLink: "https://meet.google.com/xxx-yyyy-zzz" };
    });
    await resyncConsultationCalendarNow(id);
    expect(deleteMock).toHaveBeenCalledWith(expect.objectContaining({ googleEventId: `ev-race-${RUN}` }));
    expect(row(id).google_event_deleted_at).not.toBeNull();
  });

  it("안전망 트리거: 어떤 경로로든 status=cancelled 가 되면 삭제 대기(failed)로 표시되고 크론이 지운다", async () => {
    const id = mk({ event: `ev-${RUN}-raw`, sync: "synced" });
    psql(`update consultations set status='cancelled' where id='${id}'`);
    expect(row(id)).toMatchObject({ google_sync_status: "failed", google_sync_retry_count: 0 });
    await runConsultationCalendarResyncBatch(200);
    expect(deleteMock).toHaveBeenCalledWith(expect.objectContaining({ googleEventId: `ev-${RUN}-raw` }));
    expect(row(id).google_sync_status).toBe("synced");
  });
});

describe("크론(미팅+상담 한 번에) 과 5회 상한", () => {
  it("CRON_SECRET 미설정 503, 틀린 토큰 401, 올바른 토큰이면 상담(생성·패치·삭제)과 미팅을 한 번에 회수한다", async () => {
    const create = mk({ sync: "failed", retries: 2 });
    const patch = mk({ sync: "failed", event: `ev-${RUN}-patch` });
    const del = mk({ status: "cancelled", sync: "failed", event: `ev-${RUN}-del` });
    const fine = mk({ sync: "synced", event: `ev-${RUN}-fine` });
    const meetStart = new Date(BASE + 400 * 3600_000).toISOString();
    const meetEnd = new Date(BASE + 401 * 3600_000).toISOString();
    const meeting = psql(`insert into meeting_requests (household_id, requested_by, status, consultant_id, starts_at, ends_at, google_sync_status, google_sync_retry_count)
      values ('${HOUSEHOLD}','${GUARDIAN}','scheduled','${CA}','${meetStart}','${meetEnd}','failed',0) returning id;`).split("\n")[0];
    delete process.env.CRON_SECRET;
    expect((await cronGET(new Request("http://x/api/cron/resync-meeting-events"))).status).toBe(503);
    process.env.CRON_SECRET = `s-${RUN}`;
    expect((await cronGET(new Request("http://x", { headers: { authorization: "Bearer wrong" } }))).status).toBe(401);
    expect(createMock).not.toHaveBeenCalled();
    // 배치는 한 번에 20건 — 다른 실행이 남긴 실패 행이 앞줄에 있으면 내 행까지 몇 번 더 돌아야 한다(최대 5번).
    let body: { consultations: { enabled: boolean } } = { consultations: { enabled: false } };
    for (let pass = 0; pass < 5; pass += 1) {
      const res = await cronGET(new Request("http://x", { headers: { authorization: `Bearer s-${RUN}` } }));
      expect(res.status).toBe(200);
      body = await res.json();
      const done = [create, patch].every((id) => row(id).google_sync_status === "synced") && row(del).google_event_deleted_at !== null;
      const meetingDone = JSON.parse(psql(`select row_to_json(m) from meeting_requests m where id='${meeting}'`)).google_sync_status === "succeeded";
      if (done && meetingDone) break;
    }
    expect(body.consultations.enabled).toBe(true);
    expect(row(create)).toMatchObject({ google_sync_status: "synced", google_event_id: `ev-created-${RUN}` });
    expect(row(patch).google_sync_status).toBe("synced");
    expect(patchMock).toHaveBeenCalledWith(expect.objectContaining({ googleEventId: `ev-${RUN}-patch` }));
    expect(row(del).google_event_deleted_at).not.toBeNull();
    expect(row(fine).google_sync_status).toBe("synced");
    expect(deleteMock).not.toHaveBeenCalledWith(expect.objectContaining({ googleEventId: `ev-${RUN}-fine` }));
    const m = JSON.parse(psql(`select row_to_json(m) from meeting_requests m where id='${meeting}'`));
    expect(m.google_sync_status).toBe("succeeded");
    delete process.env.CRON_SECRET;
  });

  it("5회 상한: 4번 실패한 행은 이번 실패로 reconciliation_needed(자동 재시도 중단)+fallback 메일 1통, 이후 크론은 건드리지 않는다", async () => {
    const last = mk({ sync: "failed", retries: 4 });
    const capped = mk({ sync: "failed", retries: 5 });
    createMock.mockRejectedValue(new Error("still down"));
    const out = await runConsultationCalendarResyncBatch(200);
    expect(out.permanent).toBeGreaterThanOrEqual(1);
    expect(row(last)).toMatchObject({ google_sync_status: "reconciliation_needed", google_sync_retry_count: 5 });
    expect(row(capped)).toMatchObject({ google_sync_status: "failed", google_sync_retry_count: 5 });
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    createMock.mockClear();
    await runConsultationCalendarResyncBatch(200);
    expect(row(last).google_sync_retry_count).toBe(5);
    expect(row(capped).google_sync_retry_count).toBe(5);
    expect(createMock).not.toHaveBeenCalled();
    // 미팅 배치는 상담 행을 건드리지 않는다
    await runMeetingCalendarResyncBatch(200);
    expect(row(last).google_sync_retry_count).toBe(5);
  });

  it("취소된 상담이 5회 실패해도 학부모에게 일정 안내 메일을 보내지 않는다", async () => {
    const id = mk({ status: "cancelled", sync: "failed", retries: 4, event: `ev-${RUN}-cx` });
    deleteMock.mockRejectedValue(new Error("down"));
    await resyncConsultationCalendarNow(id);
    expect(row(id).google_sync_status).toBe("reconciliation_needed");
    expect(sendEmailMock).not.toHaveBeenCalled();
  });
});

describe("관리자 Google 재동기화 버튼(서버 액션)", () => {
  it("자동 재시도 중단(5회)도 횟수를 초기화하고 다시 시도해 성공 처리한다", async () => {
    const id = mk({ sync: "reconciliation_needed", retries: 5 });
    expect(await resyncConsultationCalendar(id)).toBe("synced");
    expect(row(id)).toMatchObject({ google_sync_status: "synced", google_sync_retry_count: 0, google_event_id: `ev-created-${RUN}` });
  });

  it("다시 실패하면 횟수 1부터 다시 센다", async () => {
    const id = mk({ sync: "reconciliation_needed", retries: 5 });
    createMock.mockRejectedValue(new Error("down"));
    expect(await resyncConsultationCalendar(id)).toBe("failed");
    expect(row(id)).toMatchObject({ google_sync_status: "failed", google_sync_retry_count: 1 });
  });

  it("실패 상태가 아니거나 Google 호출이 꺼져 있으면 거절한다", async () => {
    const ok = mk({ sync: "synced", event: `ev-${RUN}-ok` });
    await expect(resyncConsultationCalendar(ok)).rejects.toThrow("재동기화가 필요한 상태가 아닙니다");
    process.env.CALENDAR_SYNC_ALLOW_REAL_CALLS = "false";
    const f = mk({ sync: "failed" });
    await expect(adminForceResyncConsultationCalendar(f)).rejects.toThrow("CALENDAR_SYNC_ALLOW_REAL_CALLS");
    expect(createMock).not.toHaveBeenCalled();
  });
});
