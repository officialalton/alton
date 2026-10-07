import { describe, expect, it } from "vitest";
import { addAttendee, listAttendees, recordAttendeeStatus, validateAttendeeInput } from "./attendees";

function fakeAdmin(rows: Record<string, unknown>[] = []) {
  const calls: { table: string; op: string; payload?: unknown; filters: unknown[] }[] = [];
  const chain = (op: string, payload?: unknown) => {
    const rec = { table: "lesson_additional_attendees", op, payload, filters: [] as unknown[] };
    calls.push(rec);
    const c: Record<string, unknown> = {};
    for (const m of ["eq", "is", "not", "or", "order", "select"]) c[m] = (...a: unknown[]) => (rec.filters.push([m, ...a]), c);
    c.maybeSingle = async () => ({ data: { notice_given_at: null, consent_recorded_at: null }, error: null });
    c.then = (res: (v: unknown) => unknown) => res({ data: op === "update" ? [] : rows, error: null });
    return c;
  };
  return { calls, from: () => ({ select: () => chain("select"), insert: (p: unknown) => chain("insert", p), update: (p: unknown) => chain("update", p) }) };
}

describe("attendees", () => {
  it("validates names and relationships", () => {
    expect(validateAttendeeInput("  Mina ", " sister ")).toEqual({ ok: true, displayName: "Mina", relationship: "sister" });
    expect(validateAttendeeInput("   ", null).ok).toBe(false);
    expect(validateAttendeeInput("x".repeat(121), null).ok).toBe(false);
  });
  it("lists by the target column (one query)", async () => {
    const a = fakeAdmin([{ id: "1", display_name: "Mina", relationship: null, notice_given_at: null, consent_recorded_at: "2026-11-01" }]);
    const items = await listAttendees(a as never, { kind: "meeting_request", id: "m1" });
    expect(a.calls).toHaveLength(1);
    expect(a.calls[0].filters).toContainEqual(["eq", "meeting_request_id", "m1"]);
    expect(items[0]).toMatchObject({ displayName: "Mina", noticeGivenAt: null, consentRecordedAt: "2026-11-01" });
  });
  it("adding an attendee never records notice or consent", async () => {
    const a = fakeAdmin();
    await addAttendee(a as never, { kind: "session", id: "s1" }, { displayName: "Mina", relationship: "sister" }, "t1");
    const insert = a.calls.find((c) => c.op === "insert")!;
    expect(insert.payload).toEqual({ session_id: "s1", display_name: "Mina", relationship: "sister", recorded_by: "t1" });
    expect(JSON.stringify(insert.payload)).not.toMatch(/notice_given_at|consent_recorded_at/);
  });
  it("recording only fills empty timestamps and consent requires an existing notice", async () => {
    const a = fakeAdmin();
    await expect(recordAttendeeStatus(a as never, "x1", { consent: true }, "admin")).rejects.toThrow("안내를 먼저");
    const upd = a.calls.filter((c) => c.op === "update");
    expect(upd[0].filters).toContainEqual(["is", "consent_recorded_at", null]);
    expect(upd[0].filters).toContainEqual(["not", "notice_given_at", "is", null]);
    const n = fakeAdmin();
    await recordAttendeeStatus(n as never, "x1", { notice: true }, "admin");
    expect(n.calls.find((c) => c.op === "update")!.filters).toContainEqual(["is", "notice_given_at", null]);
  });
});
