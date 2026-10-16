// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { selectInChunks } from "./select-in-chunks";
import { loadTeacherMockExamStudents } from "@/app/teacher/mock-exam-assign-data";

// 2026-09-29 — `.in()` 에 id 수백 개(PostgREST "URI too long")가 들어가도 로더가 실제 로컬
// PostgREST 에서 동작하는지. 읽기 전용이라 몇 번을 돌려도 안전하다(행을 만들지 않는다).
function env(name: string): string | undefined {
  if (process.env[name]) return process.env[name];
  try {
    const text = readFileSync(path.resolve(__dirname, "../.env.local"), "utf-8");
    return text.match(new RegExp(`^${name}=(.*)$`, "m"))?.[1]?.trim().replace(/^["']|["']$/g, "");
  } catch {
    return undefined;
  }
}

const url = env("NEXT_PUBLIC_SUPABASE_URL");
const key = env("SUPABASE_SECRET_KEY");
const isLocal = !!url && /127\.0\.0\.1|localhost/.test(url);

describe.skipIf(!url || !key || !isLocal)("id 500개 초과 .in() — 로컬 PostgREST", () => {
  const admin: SupabaseClient = createClient(url!, key!, { auth: { persistSession: false } });
  const fake = (n: number) => Array.from({ length: n }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`);

  async function realProfileIds(n: number): Promise<string[]> {
    const { data, error } = await admin.from("profiles").select("id").order("id").limit(n);
    if (error) throw new Error(error.message);
    return (data ?? []).map((p) => p.id as string);
  }

  it("원시 .in() 은 600개에서 실패하고 selectInChunks 는 성공한다", async () => {
    const real = await realProfileIds(3);
    expect(real.length).toBeGreaterThan(0);
    const all = [...fake(600), ...real];
    const raw = await admin.from("profiles").select("id").in("id", all);
    expect(raw.error).not.toBeNull();
    const chunked = await selectInChunks(all, (chunk) => admin.from("profiles").select("id").in("id", chunk));
    expect(chunked.error).toBeNull();
    expect(chunked.data.map((r) => r.id).sort()).toEqual([...real].sort());
  });

  it("로더(loadTeacherMockExamStudents)가 학생 600명 넘는 교사에서도 이름을 채운다", async () => {
    const ids = await realProfileIds(650);
    if (ids.length < 600) return; // 시드가 작은 환경에서는 건너뜀
    // 교사의 담당 학생 조회만 650명으로 대체하고 나머지(profiles 조회)는 실제 PostgREST 로 보낸다.
    const client = new Proxy(admin, {
      get(target, prop, receiver) {
        if (prop !== "from") return Reflect.get(target, prop, receiver);
        return (table: string) => {
          if (table === "enrollments") {
            const q: Record<string, unknown> = {
              select: () => q,
              eq: () => q,
              then: (res: (v: unknown) => void) => res({ data: ids.map((id) => ({ student_id: id })), error: null }),
            };
            return q;
          }
          if (table === "teacher_assignments") {
            const q: Record<string, unknown> = {
              select: () => q,
              eq: () => q,
              in: () => q,
              then: (res: (v: unknown) => void) => res({ data: [], error: null }),
            };
            return q;
          }
          return target.from(table);
        };
      },
    });
    const students = await loadTeacherMockExamStudents(client, "teacher-x");
    expect(students).toHaveLength(ids.length);
    const { data } = await admin.from("profiles").select("id, name").in("id", ids.slice(0, 50));
    const named = new Map((data ?? []).map((p) => [p.id as string, p.name as string | null]));
    for (const s of students.filter((x) => named.has(x.studentId)).slice(0, 50)) {
      expect(s.studentName).toBe(named.get(s.studentId) ?? null);
    }
  }, 60000);
});
