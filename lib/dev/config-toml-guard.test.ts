import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { checkConfigToml, isSharedPort } from "./config-toml-guard";

const shared = `project_id = "ALTON"\n[api]\nport = 54421\n[db]\nport = 54422\nshadow_port = 54420\n[db.pooler]\nport = 54429\n[studio]\nport = 54423\n[local_smtp]\nport = 54424\nsmtp_port = 54325\n[analytics]\nport = 54427\n`;
const isolated = shared.replace('"ALTON"', '"ALTON_apverify"').replace(/54(\d)(\d\d)/g, (_m, a, b) => `54${Number(a) + 1}${b}`);

describe("config.toml 커밋 가드(순수 함수)", () => {
  it("공유 값은 통과", () => { expect(checkConfigToml(shared)).toEqual({ ok: true }); });
  it("격리 project_id·포트(545xx·546xx)는 차단하고 사유를 준다", () => {
    const r = checkConfigToml(isolated);
    expect(r.ok).toBe(false);
    if (!r.ok) { expect(r.reasons.join(" ")).toMatch(/ALTON_apverify/); expect(r.reasons.join(" ")).toMatch(/544xx/); }
    expect(checkConfigToml(shared.replace('"ALTON"', '"ALTON_x"')).ok).toBe(false); // project_id 만 달라도 차단
    expect(checkConfigToml(shared.replace("port = 54421", "port = 54521")).ok).toBe(false); // 포트만 달라도 차단
    expect(checkConfigToml("").ok).toBe(false); // project_id 없음
  });
  it("명시 표식(ALLOW_CONFIG_TOML=1 + 8자 이상 작업 메모)이 있을 때만 통과", () => {
    expect(checkConfigToml(isolated, { ALLOW_CONFIG_TOML: "1" }).ok).toBe(false);
    expect(checkConfigToml(isolated, { ALLOW_CONFIG_TOML: "1", CONFIG_TOML_NOTE: "x" }).ok).toBe(false);
    expect(checkConfigToml(isolated, { ALLOW_CONFIG_TOML: "1", CONFIG_TOML_NOTE: "R9 포트 이전 작업" })).toEqual({ ok: true });
    expect(checkConfigToml(isolated, { CONFIG_TOML_NOTE: "R9 포트 이전 작업" }).ok).toBe(false);
  });
  it("공유 포트 판별", () => { expect([54421, 54422, 54420, 54429, 54325, 54427].every(isSharedPort)).toBe(true); expect([54521, 54621, 54322, 54321].some(isSharedPort)).toBe(false); });
});

describe("실제 supabase/config.toml", () => {
  it("HEAD 에 커밋된 config.toml 은 공유 값이다(격리 값이 커밋되면 실패)", () => {
    const head = execFileSync("git", ["show", "HEAD:supabase/config.toml"], { encoding: "utf-8" });
    expect(checkConfigToml(head)).toEqual({ ok: true });
  });
  it("작업 트리 config.toml 도 공유 값이다(격리 스택이 떠 있는 동안 tmp/isolated-stack.lock 이 있으면 건너뜀)", () => {
    if (existsSync("tmp/isolated-stack.lock")) return;
    expect(checkConfigToml(readFileSync("supabase/config.toml", "utf-8"))).toEqual({ ok: true });
  });
});
