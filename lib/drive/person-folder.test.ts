import { beforeEach, describe, expect, it, vi } from "vitest";
import { personFolderName, sanitizeDriveName, archiveRootFolderId, archiveFileName } from "./archive-config";
import { findOrCreatePersonFolder } from "./person-folder";

const ok = (body: unknown) => ({ ok: true, json: async () => body, text: async () => "" });
const args = { rootId: "ROOT", kind: "teacher" as const, personId: "11111111-2222-3333-4444-555555555555", displayName: "Sora Park" };

describe("archive naming", () => {
  it("sanitizes names and uses name + short id only", () => {
    expect(sanitizeDriveName('A/B\\C:"D"  <x>')).toBe("A B C D x");
    expect(sanitizeDriveName("   ")).toBe("Unnamed");
    expect(personFolderName("Sora Park", "11111111-2222-3333-4444-555555555555")).toBe("Sora Park (11111111)");
  });
  it("builds id-only file names (no names, emails or birth dates)", () => {
    expect(archiveFileName({ contractType: "teacher_agreement", contractId: "c-1", version: "0.2-EN-CA", signedAt: "2026-11-01T23:00:00Z" })).toBe(
      "teacher_agreement_c-1_0.2-EN-CA_2026-11-01.pdf"
    );
    expect(archiveFileName({ contractType: "family_agreement", contractId: "v-9", version: "0.3-EN-CA", signedAt: "2026-11-02T10:00:00Z", certificate: true })).toBe(
      "family_agreement_v-9_0.3-EN-CA_2026-11-02_certificate.pdf"
    );
    expect(archiveFileName({ contractType: "family_amendment", contractId: "a b@x.com", version: "1", signedAt: "2026-11-02" })).not.toMatch(/[@ ]/);
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

describe("archive safety", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    process.env.DRIVE_ARTIFACTS_ALLOW_REAL_WRITES = "true";
  });
  const tokenMock = vi.hoisted(() => vi.fn());
  vi.mock("@/lib/google-workspace-auth", () => ({ getDriveApiAccessToken: async () => "tok" }));
  vi.mock("@/lib/docusign", () => ({ downloadCompletedDocument: async () => Buffer.from("pdf"), downloadCertificateOfCompletion: async () => Buffer.from("c") }));
  vi.mock("@/lib/supabase-admin", () => ({ createAdminClient: () => ({}) }));
  void tokenMock;

  it("never creates sharing permissions or links, and skips an existing logical file (no overwrite)", async () => {
    const { archiveSignedAmendment } = await import("./amendment-archive");
    const f = vi
      .fn()
      .mockResolvedValueOnce(ok({ files: [{ id: "PF", name: "Sora Park (11111111)" }] })) // person folder
      .mockResolvedValueOnce(ok({ files: [{ id: "EXISTING" }] })); // identity hit
    vi.stubGlobal("fetch", f);
    const r = await archiveSignedAmendment({
      kind: "teacher", personId: "11111111-2222-3333-4444-555555555555", personName: "Sora Park",
      amendmentId: "am-1", parentContractId: "c-1", version: "1", signedAt: "2026-11-05T00:00:00Z", envelopeId: "env",
    });
    expect(r.driveFileId).toBe("EXISTING");
    expect(f.mock.calls.every((c) => !String(c[0]).includes("/permissions"))).toBe(true);
    expect(f.mock.calls.every((c) => !(c[1]?.method === "POST" && String(c[0]).includes("upload")))).toBe(true);
  });

  it("archives an amendment as a new id-named file with parent link and no permissions call", async () => {
    const { archiveSignedAmendment } = await import("./amendment-archive");
    const f = vi
      .fn()
      .mockResolvedValueOnce(ok({ files: [{ id: "PF", name: "Min Kim (11111111)" }] }))
      .mockResolvedValueOnce(ok({ files: [] })) // identity miss
      .mockResolvedValueOnce(ok({ files: [] })) // name miss
      .mockResolvedValueOnce(ok({ id: "NEWFILE" }));
    vi.stubGlobal("fetch", f);
    const r = await archiveSignedAmendment({
      kind: "family", personId: "11111111-2222-3333-4444-555555555555", personName: "Min Kim",
      amendmentId: "am-2", parentContractId: "c-2", version: "2", signedAt: "2026-11-05T00:00:00Z", envelopeId: "env",
    });
    expect(r.driveFileId).toBe("NEWFILE");
    const upload = (f.mock.calls[3][1].body as Buffer).toString("binary");
    expect(upload).toContain("family_amendment_am-2_2_2026-11-05.pdf");
    expect(upload).toContain("altonParentContractId");
    expect(f.mock.calls.every((c) => !String(c[0]).includes("/permissions"))).toBe(true);
  });
});
