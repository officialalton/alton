import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { loadChildren } from "./children-data";
import { loadLessons } from "@/app/student/lessons-data";
import { loadCurricula } from "@/app/student/curriculum-data";
import { loadDashboardData } from "@/app/student/dashboard-data";

// (2026-09-06 제품 오너 지시) 직전 라운드(ae95c39)에서 app/parent/page.tsx의
// 순차 로더를 Promise.all로 병렬화한 직후 "보호자 포털의 수업 리스트가 안
// 나온다"는 회귀 의심 보고가 들어왔다. 로컬 DB(psql로 확인한 실제 seed
// 데이터 — 부모 bbbbbbbb-...0001, 자녀 cccccccc-...0001, active enrollment
// 2건 + legacy_sessions 5건)에 대해 병렬 호출 결과가 병렬화 이전(순차 호출)
// 결과와 정확히 동일한지 고정한다.
//
// 결론(조사 완료): ae95c39의 app/parent/page.tsx / student/dashboard-data.ts
// diff는 의존관계가 있는 호출(예: enrollmentIds가 필요한 sessions 쿼리)을
// 전부 그 의존값이 이미 resolve된 이후 단계에서만 Promise.all로 묶었다 —
// 순서 파괴나 구조분해 실수는 없었다. 이 테스트는 그 사실을 서비스롤 클라
// 이언트(RLS 우회, 애그리게이션 로직만)와 실제 보호자 RLS 세션(로그인 후
// JWT) 양쪽으로 검증한다. 두 경우 모두 병렬/순차 결과가 완전히 일치하고
// 실제 수업 목록도 비어있지 않다 — 즉 병렬화 자체는 버그가 아니다.
const DB_URL_API = "http://127.0.0.1:54421";
const SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

const PARENT_ID = "bbbbbbbb-0000-0000-0000-000000000001";
const PARENT_EMAIL = "minji.kim@example.com";
const PARENT_PASSWORD = "alton-dev-1234"; // supabase/seed.sql 고정 시드 비밀번호

const adminClient = createClient(DB_URL_API, SERVICE_ROLE_KEY);

describe("app/parent/page.tsx 병렬화(ae95c39) 회귀 방지 — 수업 리스트", () => {
  it("service-role 클라이언트: 병렬(Promise.all) 호출과 순차 호출 결과가 완전히 동일하다", async () => {
    const children = await loadChildren(adminClient, PARENT_ID);
    expect(children.length).toBeGreaterThan(0);
    const childId = children[0].studentId;

    const seqLessons = await loadLessons(adminClient, childId);
    const seqCurricula = await loadCurricula(adminClient, childId);
    const seqDashboard = await loadDashboardData(adminClient, childId);

    const [parLessons, parCurricula, parDashboard] = await Promise.all([
      loadLessons(adminClient, childId),
      loadCurricula(adminClient, childId),
      loadDashboardData(adminClient, childId),
    ]);

    expect(parLessons).toEqual(seqLessons);
    expect(parCurricula).toEqual(seqCurricula);
    expect(parDashboard).toEqual(seqDashboard);

    // 실제로 리스트가 비어있지 않은지도 함께 고정(빈 배열끼리 같다고 통과하는
    // 걸 막기 위함).
    expect(seqLessons.upcoming.length + seqLessons.past.length).toBeGreaterThan(0);
    expect(seqDashboard.upcoming.length).toBeGreaterThan(0);
  });

  it("실제 보호자 RLS 세션(로그인 JWT): 병렬/순차 결과가 동일하고 수업 목록이 비어있지 않다", async () => {
    const anonClient = createClient(DB_URL_API, ANON_KEY);
    const { data: signInData, error: signInError } = await anonClient.auth.signInWithPassword({
      email: PARENT_EMAIL,
      password: PARENT_PASSWORD,
    });
    expect(signInError).toBeNull();

    const rlsClient = createClient(DB_URL_API, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${signInData.session!.access_token}` } },
    });

    const children = await loadChildren(rlsClient, PARENT_ID);
    expect(children.length).toBeGreaterThan(0);
    const childId = children[0].studentId;

    const seqLessons = await loadLessons(rlsClient, childId);
    const seqCurricula = await loadCurricula(rlsClient, childId);

    const [parLessons, parCurricula] = await Promise.all([
      loadLessons(rlsClient, childId),
      loadCurricula(rlsClient, childId),
    ]);

    expect(parLessons).toEqual(seqLessons);
    expect(parCurricula).toEqual(seqCurricula);
    expect(seqLessons.upcoming.length + seqLessons.past.length).toBeGreaterThan(0);
  });
});
