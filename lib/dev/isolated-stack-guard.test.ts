import { describe, expect, it } from "vitest";
import { checkIsolatedConfig, checkIsolatedTeardown, snapshotFromDockerPs } from "./isolated-stack-guard";

const ok = { containers: ["supabase_db_ALTON_apv", "supabase_kong_ALTON_apv"], ports: [54522, 54521] };
describe("checkIsolatedTeardown", () => {
  it("격리 id + 락 일치 + 격리 컨테이너·포트면 통과", () => expect(checkIsolatedTeardown({ projectId: "ALTON_apv", lockProjectId: "ALTON_apv", snapshot: ok })).toEqual({ ok: true }));
  it("id 없음·락 없음·락 불일치 차단", () => {
    expect(checkIsolatedTeardown({ projectId: undefined, lockProjectId: "ALTON_apv", snapshot: ok }).ok).toBe(false);
    expect(checkIsolatedTeardown({ projectId: "ALTON_apv", lockProjectId: undefined, snapshot: ok }).ok).toBe(false);
    expect(checkIsolatedTeardown({ projectId: "ALTON_apv", lockProjectId: "ALTON_other", snapshot: ok }).ok).toBe(false);
  });
  it("공유 id ALTON 은 락이 같아도 차단", () => {
    const r = checkIsolatedTeardown({ projectId: "ALTON", lockProjectId: "ALTON", snapshot: { containers: ["supabase_db_ALTON"], ports: [54422] } });
    expect(r.ok).toBe(false);
  });
  it("공유 컨테이너·공유 포트가 섞이면 차단", () => {
    expect(checkIsolatedTeardown({ projectId: "ALTON_apv", lockProjectId: "ALTON_apv", snapshot: { containers: [...ok.containers, "supabase_db_ALTON"], ports: ok.ports } }).ok).toBe(false);
    expect(checkIsolatedTeardown({ projectId: "ALTON_apv", lockProjectId: "ALTON_apv", snapshot: { containers: ok.containers, ports: [54422] } }).ok).toBe(false);
    expect(checkIsolatedTeardown({ projectId: "ALTON_apv", lockProjectId: "ALTON_apv", snapshot: { containers: ["supabase_db_Essay_ERP"], ports: [54522] } }).ok).toBe(false);
  });
  it("컨테이너 없음·형식 오류 차단", () => {
    expect(checkIsolatedTeardown({ projectId: "ALTON_apv", lockProjectId: "ALTON_apv", snapshot: { containers: [], ports: [] } }).ok).toBe(false);
    expect(checkIsolatedTeardown({ projectId: "apv", lockProjectId: "apv", snapshot: ok }).ok).toBe(false);
  });
});
describe("checkIsolatedConfig / snapshotFromDockerPs", () => {
  it("config 검사", () => {
    expect(checkIsolatedConfig("ALTON_apv", [54521, 54522]).ok).toBe(true);
    expect(checkIsolatedConfig("ALTON", [54521]).ok).toBe(false);
    expect(checkIsolatedConfig("ALTON_apv", [54421]).ok).toBe(false);
  });
  it("docker ps 파싱은 접미사가 정확히 일치하는 컨테이너만(ALTON 은 ALTON_apv 와 섞이지 않음)", () => {
    const out = "supabase_db_ALTON|0.0.0.0:54422->5432/tcp\nsupabase_db_ALTON_apv|0.0.0.0:54522->5432/tcp\nfoo|0.0.0.0:1->1/tcp";
    expect(snapshotFromDockerPs(out, "ALTON_apv")).toEqual({ containers: ["supabase_db_ALTON_apv"], ports: [54522] });
    expect(snapshotFromDockerPs(out, "ALTON").containers).toEqual(["supabase_db_ALTON"]);
  });
});
