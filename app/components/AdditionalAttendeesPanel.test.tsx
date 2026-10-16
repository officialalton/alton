import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AdditionalAttendeesPanel, { ADMIN_ATTENDEE_COPY, TEACHER_ATTENDEE_COPY } from "./AdditionalAttendeesPanel";

const one = [{ id: "a1", displayName: "Mina", relationship: "sister", noticeGivenAt: null, consentRecordedAt: null }];

describe("AdditionalAttendeesPanel", () => {
  it("loads only when opened (no request while closed) and shows notice/consent status", async () => {
    const load = vi.fn().mockResolvedValue({ ok: true, data: one });
    render(<AdditionalAttendeesPanel copy={ADMIN_ATTENDEE_COPY} load={load} onAdd={vi.fn()} onRecord={vi.fn()} />);
    expect(load).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("참석자 관리"));
    await waitFor(() => expect(screen.getByText("Mina")).toBeInTheDocument());
    expect(load).toHaveBeenCalledTimes(1);
    expect(screen.getByText("안내 미기록")).toBeInTheDocument();
    expect(screen.getByText("동의 미기록")).toBeInTheDocument();
    expect(screen.getByText(/녹화·전사·AI 노트가 시작되지 않습니다/)).toBeInTheDocument();
  });
  it("admin records notice first, then consent", async () => {
    const onRecord = vi.fn().mockResolvedValue({ ok: true, data: [{ ...one[0], noticeGivenAt: "2026-11-01" }] });
    render(<AdditionalAttendeesPanel copy={ADMIN_ATTENDEE_COPY} load={vi.fn().mockResolvedValue({ ok: true, data: one })} onAdd={vi.fn()} onRecord={onRecord} />);
    fireEvent.click(screen.getByText("참석자 관리"));
    await waitFor(() => screen.getByText("안내 기록"));
    expect(screen.queryByText("동의 기록")).toBeNull();
    fireEvent.click(screen.getByText("안내 기록"));
    await waitFor(() => expect(onRecord).toHaveBeenCalledWith("a1", { notice: true }));
    await waitFor(() => expect(screen.getByText("동의 기록")).toBeInTheDocument());
  });
  it("teacher side can add and view but has no way to record notice or consent", async () => {
    const onAdd = vi.fn().mockResolvedValue({ ok: true, data: one });
    render(<AdditionalAttendeesPanel copy={TEACHER_ATTENDEE_COPY} load={vi.fn().mockResolvedValue({ ok: true, data: [] })} onAdd={onAdd} />);
    fireEvent.click(screen.getByText("Additional attendees"));
    await waitFor(() => screen.getByText("No additional attendees."));
    fireEvent.change(screen.getByPlaceholderText("Attendee name"), { target: { value: "Mina" } });
    fireEvent.click(screen.getByText("Add attendee"));
    await waitFor(() => expect(onAdd).toHaveBeenCalledWith({ displayName: "Mina", relationship: "" }));
    await waitFor(() => expect(screen.getByText("Notice not recorded")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: /record/i })).toBeNull();
    expect(screen.getByText("Notice and consent are recorded by ALTON staff.")).toBeInTheDocument();
  });
});
