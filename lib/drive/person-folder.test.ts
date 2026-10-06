import { beforeEach, describe, expect, it, vi } from "vitest";
import { personFolderName, sanitizeDriveName, archiveRootFolderId, teacherAgreementFileName, familyAgreementFileName } from "./archive-config";
import { findOrCreatePersonFolder } from "./person-folder";

const ok = (body: unknown) => ({ ok: true, json: async () => body, text: async () => "" });
const args = { rootId: "ROOT", kind: "teacher" as const, personId: "11111111-2222-3333-4444-555555555555", displayName: "Sora Park" };

describe("archive naming", () => {
  it("sanitizes names and uses name + short id only", () => {
    expect(sanitizeDriveName('A/B\\C:"D"  <x>')).toBe("A B C D x");
    expect(sanitizeDriveName("   ")).toBe("Unnamed");
    expect(personFolderName("Sora Park", "11111111-2222-3333-4444-555555555555")).toBe("Sora Park (11111111)");
  });
  it("builds the agreed file names", () => {
    expect(teacherAgreementFileName({ templateVersion: "0.2-EN-CA", signedAt: "2026-11-01T23:00:00Z", envelopeId: "abcdef12-0000" })).toBe(
      "Teacher-Agreement_0.2-EN-CA_2026-11-01_abcdef12.pdf"
    );
    expect(
      familyAgreementFileName({ studentName: "Ji Hoon", templateVersion: "0.3-EN-CA", signedAt: "2026-11-02T10:00:00Z", envelopeId: "abcdef12-0000", artifactType: "signed_document" })
    ).toBe("Family-Agreement_Ji-Hoon_0.3-EN-CA_2026-11-02_abcdef12.pdf");
  });
  it("uses the owner folder ids by default and allows env override", () => {
    expect(archiveRootFolderId("teacher")).toBe("1e8Tk9ZLSWr3mXR6azIn_hU3mw1NkZOlL");
    expect(archiveRootFolderId("family")).toBe("1q0PbjWndFGIF_-GoXaFdMICwI8woxz3f");
    process.env.DRIVE_FAMILY_CONTRACTS_ROOT_FOLDER_ID = "OVERRIDE";
    expect(archiveRootFolderId("family")).toBe("OVERRIDE");
    delete process.env.DRIVE_FAMILY_CONTRACTS_ROOT_FOLDER_ID;
  });
});

describe("findOrCreatePersonFolder", () => {
  beforeEach(() => vi.unstubAllGlobals());

  it("reuses an existing folder found by appProperties and refreshes a stale name", async () => {
    const f = vi.fn().mockResolvedValueOnce(ok({ files: [{ id: "F1", name: "Old Name (11111111)" }] })).mockResolvedValueOnce(ok({}));
    vi.stubGlobal("fetch", f);
    expect(await findOrCreatePersonFolder("tok", args)).toBe("F1");
    expect(decodeURIComponent(String(f.mock.calls[0][0]))).toContain("altonPersonId' and value='11111111-2222-3333-4444-555555555555'");
    expect(f.mock.calls[1][1].method).toBe("PATCH");
    expect(JSON.parse(f.mock.calls[1][1].body)).toEqual({ name: "Sora Park (11111111)" });
  });
  it("creates the folder under the root with appProperties when none exists", async () => {
    const f = vi
      .fn()
      .mockResolvedValueOnce(ok({ files: [] }))
      .mockResolvedValueOnce(ok({ id: "NEW" }))
      .mockResolvedValueOnce(ok({ files: [{ id: "NEW", name: "Sora Park (11111111)" }] }));
    vi.stubGlobal("fetch", f);
    expect(await findOrCreatePersonFolder("tok", args)).toBe("NEW");
    const body = JSON.parse(f.mock.calls[1][1].body);
    expect(body).toMatchObject({ name: "Sora Park (11111111)", parents: ["ROOT"], appProperties: { altonKind: "teacher" } });
    expect(f).toHaveBeenCalledTimes(3);
  });
  it("on a creation race the oldest folder wins and the duplicate is trashed", async () => {
    const f = vi
      .fn()
      .mockResolvedValueOnce(ok({ files: [] }))
      .mockResolvedValueOnce(ok({ id: "MINE" }))
      .mockResolvedValueOnce(ok({ files: [{ id: "OLDER", name: "Sora Park (11111111)" }, { id: "MINE", name: "Sora Park (11111111)" }] }))
      .mockResolvedValueOnce(ok({}));
    vi.stubGlobal("fetch", f);
    expect(await findOrCreatePersonFolder("tok", args)).toBe("OLDER");
    expect(f.mock.calls[3][0]).toContain("/files/MINE");
    expect(JSON.parse(f.mock.calls[3][1].body)).toEqual({ trashed: true });
  });
});
