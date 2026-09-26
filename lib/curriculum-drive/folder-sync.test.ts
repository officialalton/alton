// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { curriculumDriveConfig } from "./config";
import {
  driveFolderApi,
  executeFolderOps,
  planFolderOps,
  reconcileRecordedFolders,
  type DriveFolderApi,
  type FolderRow,
  type FolderStore,
} from "./folder-sync";

const row = (over: Partial<FolderRow>): FolderRow => ({
  id: `r_${over.scope}_${over.ref_id}`,
  scope: "subject",
  ref_id: "x",
  desired_name: "이름",
  applied_name: null,
  drive_folder_id: null,
  sync_status: "pending",
  attempts: 0,
  ...over,
});

describe("교재 Drive 설정", () => {
  it("ENABLED 가 아니면 null — Drive 를 부르지 않는다", () => {
    expect(curriculumDriveConfig({})).toBeNull();
    expect(curriculumDriveConfig({ CURRICULUM_DRIVE_ENABLED: "true" })).toBeNull();
    expect(curriculumDriveConfig({ CURRICULUM_DRIVE_ENABLED: "true", CURRICULUM_DRIVE_ID: "d1" })).toEqual({
      driveId: "d1",
      rootFolderId: "d1",
      allowRealWrites: false,
    });
  });
});

describe("폴더 계획 — 과목 → 키워드, 상위가 있어야 만든다", () => {
  const links = { keywordSubject: new Map([["k1", "s1"], ["k2", "s1"]]) };

  it("과목은 루트 아래에, 키워드는 과목 폴더 id 가 있어야 만들고 없으면 사유와 함께 건너뛴다", () => {
    const ops = planFolderOps(
      [
        row({ scope: "keyword", ref_id: "k1", desired_name: "추론" }),
        row({ scope: "subject", ref_id: "s1", desired_name: "SAT Reading" }),
      ],
      links,
      "root"
    );
    expect(ops.map((o) => `${o.kind}:${o.row.ref_id}`)).toEqual(["create:s1", "skip:k1"]);
    expect(ops[0]).toMatchObject({ parentDriveFolderId: "root" });
    expect(ops[1]).toMatchObject({ reason: "과목 폴더가 아직 없습니다." });
  });

  it("과목 폴더가 있으면 그 아래에 키워드 폴더를 만들고, 만들어진 것과 retired(예전 단원 폴더)는 건너뛴다", () => {
    const ops = planFolderOps(
      [
        row({ scope: "subject", ref_id: "s1", drive_folder_id: "F_S", sync_status: "created", applied_name: "SAT" }),
        row({ scope: "unit", ref_id: "u1", drive_folder_id: "F_U", sync_status: "retired" }),
        row({ scope: "unit", ref_id: "u2", sync_status: "pending" }),
        row({ scope: "keyword", ref_id: "k1", desired_name: "추론" }),
      ],
      links,
      "root"
    );
    expect(ops).toHaveLength(1);
    expect(ops[0]).toMatchObject({ kind: "create", row: { ref_id: "k1" }, parentDriveFolderId: "F_S" });
  });

  it("이름이 바뀐 폴더는 rename 이고, 폴더 id 가 없으면 건너뛴다", () => {
    const ops = planFolderOps(
      [
        row({ scope: "subject", ref_id: "s1", drive_folder_id: "F_S", sync_status: "rename_pending", desired_name: "새 이름" }),
        row({ scope: "subject", ref_id: "s2", sync_status: "rename_pending", desired_name: "x" }),
      ],
      links,
      "root"
    );
    expect(ops[0]).toMatchObject({ kind: "rename", driveFolderId: "F_S", name: "새 이름" });
    expect(ops[1].kind).toBe("skip");
  });
});

describe("기록된 폴더 재확인 — 사람이 Drive 에서 지웠으면 다시 만들 대상으로 되돌린다", () => {
  it("사라진 폴더의 행은 id 를 잊고 pending 으로, 살아 있는 것과 retired 는 그대로", async () => {
    const api: DriveFolderApi = {
      folderExists: vi.fn(async (id: string) => id !== "GONE"),
      findChildFolder: vi.fn(async () => null),
      createFolder: vi.fn(async () => "NEW"),
      renameFolder: vi.fn(async () => undefined),
    };
    const store: FolderStore = {
      markMissing: vi.fn(async () => undefined),
      markCreated: vi.fn(async () => undefined),
      markRenamed: vi.fn(async () => undefined),
      markFailed: vi.fn(async () => undefined),
    };
    const out = await reconcileRecordedFolders(
      [
        row({ scope: "subject", ref_id: "s1", drive_folder_id: "GONE", sync_status: "created", applied_name: "SAT" }),
        row({ scope: "subject", ref_id: "s2", drive_folder_id: "ALIVE", sync_status: "created", applied_name: "AP" }),
        row({ scope: "unit", ref_id: "u1", drive_folder_id: "GONE", sync_status: "retired" }),
      ],
      api,
      store
    );
    expect(out.checked).toBe(2);
    expect(out.missing).toEqual(["r_subject_s1"]);
    expect(store.markMissing).toHaveBeenCalledWith("r_subject_s1");
    expect(out.rows[0]).toMatchObject({ drive_folder_id: null, sync_status: "pending" });
    expect(out.rows[1]).toMatchObject({ drive_folder_id: "ALIVE", sync_status: "created" });
    expect(out.rows[2]).toMatchObject({ sync_status: "retired", drive_folder_id: "GONE" });
  });
});

describe("실행 — 실제 쓰기 플래그가 꺼져 있으면 아무것도 쓰지 않는다", () => {
  const api: DriveFolderApi = {
    folderExists: vi.fn(async () => true),
    findChildFolder: vi.fn(async () => null),
    createFolder: vi.fn(async () => "NEW"),
    renameFolder: vi.fn(async () => undefined),
  };
  const store: FolderStore = {
    markMissing: vi.fn(async () => undefined),
    markCreated: vi.fn(async () => undefined),
    markRenamed: vi.fn(async () => undefined),
    markFailed: vi.fn(async () => undefined),
  };
  const ops = planFolderOps([row({ scope: "subject", ref_id: "s1", desired_name: "SAT" })], {
    keywordSubject: new Map(),
  }, "root");

  it("dry run 은 계획만 센다", async () => {
    const out = await executeFolderOps(ops, api, store, false);
    expect(out).toMatchObject({ created: 1, dryRun: true });
    expect(api.createFolder).not.toHaveBeenCalled();
    expect(store.markCreated).not.toHaveBeenCalled();
  });

  it("실제 쓰기는 같은 이름 폴더가 있으면 새로 만들지 않고 그 id 를 쓴다", async () => {
    const dupApi: DriveFolderApi = { ...api, findChildFolder: vi.fn(async () => "EXISTING") };
    const out = await executeFolderOps(ops, dupApi, store, true);
    expect(out.created).toBe(1);
    expect(dupApi.createFolder).not.toHaveBeenCalled();
    expect(store.markCreated).toHaveBeenCalledWith(ops[0].row.id, "EXISTING", "SAT");
  });

  it("실패는 사유를 남기고 다음 항목을 계속한다", async () => {
    const failing: DriveFolderApi = {
      ...api,
      createFolder: vi.fn(async () => {
        throw new Error("403 insufficient permissions");
      }),
    };
    const out = await executeFolderOps(ops, failing, store, true);
    expect(out.failed).toEqual([{ rowId: ops[0].row.id, error: expect.stringContaining("403") }]);
    expect(store.markFailed).toHaveBeenCalled();
  });
});

describe("Drive 폴더 API 래퍼", () => {
  it("조회는 이름·상위·폴더 종류로 찾고, 생성은 parents 로 상위를 잇는다", async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    const fetchImpl = (async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      if (url.includes("/files/MISSING")) return new Response("not found", { status: 404 });
      if (url.includes("/files/TRASHED")) return new Response(JSON.stringify({ id: "TRASHED", trashed: true }), { status: 200 });
      if ((init?.method ?? "GET") === "GET") return new Response(JSON.stringify({ files: [] }), { status: 200 });
      return new Response(JSON.stringify({ id: "F1" }), { status: 200 });
    }) as unknown as typeof fetch;
    const api = driveFolderApi(fetchImpl, "tok", "drive1");

    expect(await api.folderExists("MISSING")).toBe(false);
    expect(await api.folderExists("TRASHED")).toBe(false);
    calls.length = 0;

    expect(await api.findChildFolder("P", "단원 'A'")).toBeNull();
    expect(decodeURIComponent(calls[0].url)).toContain("'P' in parents and name = '단원 \\'A\\''");
    expect(calls[0].url).toContain("driveId=drive1");

    expect(await api.createFolder("P", "단원")).toBe("F1");
    expect(JSON.parse(String(calls[1].init?.body))).toEqual({
      name: "단원",
      mimeType: "application/vnd.google-apps.folder",
      parents: ["P"],
    });
    await api.renameFolder("F1", "새");
    expect(calls[2].init?.method).toBe("PATCH");
  });
});
