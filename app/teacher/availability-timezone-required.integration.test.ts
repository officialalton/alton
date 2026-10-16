import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanupPerRunTeacher, createPerRunTeacher } from "@/test/per-run-teacher";

// 선생님 시간대 온보딩 — 저장된 profiles.timezone 이 없으면 가능 시간·휴무 저장이 실제 DB 앞에서 막히고,
// 시간대를 저장하면 같은 계정이 곧바로 저장할 수 있다. 실행마다 전용 선생님(재실행 안전), 본인 행만 정리.

const DB_URL = process.env.SUPABASE_TEST_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54422/postgres";
const SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const admin = createClient(process.env.SUPABASE_TEST_API_URL ?? "http://127.0.0.1:54421", SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function psql(sql: string): string {
  return execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", sql], { encoding: "utf-8" }).trim();
}

const state = vi.hoisted(() => ({ teacherId: "" }));
vi.mock("@/lib/auth", () => ({ requireUser: async () => ({ user: { id: state.teacherId }, supabase: admin }) }));

import { addTeacherAvailabilityException, addTeacherAvailabilityRule } from "./availability-actions";
import { TEACHER_TIMEZONE_REQUIRED_MESSAGE } from "@/lib/teacher-timezone";

const rule = { dayOfWeek: 2, startTimeLocal: "09:00", endTimeLocal: "12:00", timezone: "America/Los_Angeles", effectiveFrom: "2030-01-01" };
const count = (table: string) => Number(psql(`select count(*) from ${table} where teacher_id = '${state.teacherId}'`));

beforeAll(() => {
  state.teacherId = createPerRunTeacher(psql, { emailPrefix: "tz-required" });
});

afterAll(() => {
  if (!state.teacherId) return;
  psql(`delete from teacher_availability_exceptions where teacher_id = '${state.teacherId}';
        delete from teacher_availability_rules where teacher_id = '${state.teacherId}';`);
  cleanupPerRunTeacher(psql, state.teacherId);
});

describe("시간대 미설정 선생님의 가능 시간 저장", () => {
  it("저장된 시간대가 없으면 규칙·휴무가 모두 거절되고 DB 에 행이 생기지 않는다", async () => {
    expect(psql(`select coalesce(timezone,'') from profiles where id = '${state.teacherId}'`)).toBe("");
    await expect(addTeacherAvailabilityRule(rule)).rejects.toThrow(TEACHER_TIMEZONE_REQUIRED_MESSAGE);
    await expect(addTeacherAvailabilityException({ exceptionDate: "2030-01-08", kind: "blocked", timezone: "America/Los_Angeles" })).rejects.toThrow(
      TEACHER_TIMEZONE_REQUIRED_MESSAGE,
    );
    expect(count("teacher_availability_rules")).toBe(0);
    expect(count("teacher_availability_exceptions")).toBe(0);
  });

  it("시간대를 저장하면 같은 선생님이 바로 저장할 수 있다", async () => {
    psql(`update profiles set timezone = 'Asia/Seoul' where id = '${state.teacherId}'`);
    await expect(addTeacherAvailabilityRule(rule)).resolves.toEqual(expect.any(String));
    await expect(addTeacherAvailabilityException({ exceptionDate: "2030-01-08", kind: "blocked", timezone: "Asia/Seoul" })).resolves.toEqual(expect.any(String));
    expect(count("teacher_availability_rules")).toBe(1);
    expect(count("teacher_availability_exceptions")).toBe(1);
  });
});
