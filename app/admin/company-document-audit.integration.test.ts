import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

// P4-3 — 회사 문서 접근 기록.
//
// UAT에서 파일 열기가 "지금은 열 수 없습니다"로 실패했다. Drive 읽기는 성공했고
// 감사 기록에서 깨졌다: target_id가 uuid인데 Drive 파일 id는 uuid가 아니다.
// 감사 기록 실패를 조용히 삼키지 않는 설계라 열기 전체가 실패한 것이고,
// 그 판단 자체는 옳다 — 기록을 남기지 못했다면 열어주면 안 된다.

const DB_URL = "postgresql://postgres:postgres@127.0.0.1:54422/postgres";
const ADMIN_ID = "aaaaaaaa-0000-0000-0000-000000000001";
const DRIVE_FILE_ID = "1g71Jn4A2OVdlwuDIQuKUiNdtn4DWXVGv";

function psql(sql: string): string {
  return execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", sql], {
    encoding: "utf-8",
  }).trim();
}

function psqlExpectError(sql: string): string {
  try {
    execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", sql], {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    throw new Error("expected psql to fail, but it succeeded");
  } catch (err) {
    return (err as { stderr?: Buffer })?.stderr?.toString() ?? String(err);
  }
}

describe("회사 문서 접근 기록은 Drive 파일 id를 그대로 남긴다", () => {
  it("uuid가 아닌 Drive 파일 id로도 기록이 저장된다", () => {
    const id = psql(
      `insert into document_access_events (actor_id, target_kind, target_external_id, action, detail)
       values ('${ADMIN_ID}', 'company_document', '${DRIVE_FILE_ID}', 'file_retrieved', '{"fileName":"x.pdf"}')
       returning id;`
    );
    expect(id).not.toBe("");
    expect(
      psql(`select target_external_id from document_access_events where id = '${id}';`)
    ).toBe(DRIVE_FILE_ID);
    // 내부 행을 가리키는 컬럼은 비어 있어야 한다 — 섞이면 무엇을 봤는지 흐려진다.
    expect(psql(`select target_id is null from document_access_events where id = '${id}';`)).toBe("t");
    // 이 표는 INSERT-only다(reject_document_access_event_mutation) — 치우지 않는다.
    // 감사 기록을 테스트 편의로 지울 수 있게 만들면 감사가 아니게 된다.
  });

  it("회사 문서를 내부 uuid 자리에 넣으면 거부한다", () => {
    const stderr = psqlExpectError(
      `insert into document_access_events (actor_id, target_kind, target_id, action)
       values ('${ADMIN_ID}', 'company_document', '${ADMIN_ID}', 'file_retrieved');`
    );
    expect(stderr).toMatch(/target_id_shape|check constraint/i);
  });

  it("계약 서명본은 여전히 내부 uuid를 쓴다", () => {
    const stderr = psqlExpectError(
      `insert into document_access_events (actor_id, target_kind, target_external_id, action)
       values ('${ADMIN_ID}', 'contract_artifact', 'not-a-uuid', 'file_retrieved');`
    );
    expect(stderr).toMatch(/target_id_shape|check constraint/i);
  });

  it("둘 다 비거나 둘 다 차 있으면 거부한다", () => {
    expect(
      psqlExpectError(
        `insert into document_access_events (actor_id, target_kind, action)
         values ('${ADMIN_ID}', 'company_document', 'file_retrieved');`
      )
    ).toMatch(/target_id_or_external|check constraint/i);

    expect(
      psqlExpectError(
        `insert into document_access_events (actor_id, target_kind, target_id, target_external_id, action)
         values ('${ADMIN_ID}', 'company_document', '${ADMIN_ID}', '${DRIVE_FILE_ID}', 'file_retrieved');`
      )
    ).toMatch(/target_id_or_external|check constraint/i);
  });
});
