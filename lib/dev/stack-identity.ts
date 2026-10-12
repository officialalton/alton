// DB·API 대상 스택 동일성 검증(순수 함수 + 얇은 docker 래퍼). 포트 관계(API+1=DB)만으로는 부족하다 — 실제로 그 포트를 게시하는 컨테이너가
// 어느 Supabase project 인지(`supabase_db_<id>`·`supabase_kong_<id>`)를 docker 로 확인해 DB 와 API 가 같은 격리 project 인지, 공유 스택(ALTON)이 아닌지 본다.
// 쓰기를 하는 모든 스크립트는 "모든 env 파일(.env.local, .env, process env)을 다 읽은 뒤" 대상을 결정하고, 첫 쓰기 전에 이 검사를 통과해야 한다.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export const SHARED_PROJECT_ID = "ALTON";
const ISOLATED_RX = /^ALTON_[A-Za-z0-9]+$/;
export type StackResult = { ok: true; projectId: string } | { ok: false; reasons: string[] };

/** 효과적 env: process env > .env.local > .env (먼저 읽은 값이 이긴다). 검사와 이후 연결이 같은 값을 쓰도록 호출자는 결과를 process.env 에 반영한다. */
export function mergeEnv(processEnv: Record<string, string | undefined>, files: string[]): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = { ...processEnv };
  for (const text of files) {
    for (const line of text.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !out[m[1]]) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
  return out;
}
export function readEnvFiles(cwd = process.cwd()): string[] {
  return [".env.local", ".env"].map((f) => path.resolve(cwd, f)).filter(existsSync).map((p) => readFileSync(p, "utf-8"));
}

const hostPortOf = (url: string): number | null => {
  const m = url.match(/^(?:[a-z][a-z0-9+.-]*:\/\/)(?:[^@/]*@)?(?:127\.0\.0\.1|localhost|\[::1\]):(\d{2,5})(?:[/?#]|$)/i);
  return m ? Number(m[1]) : null;
};

/** docker ps --format '{{.Names}}|{{.Ports}}' 출력에서 호스트 포트를 게시하는 supabase_<kind>_<projectId> 컨테이너의 project id 들. */
export function projectsPublishing(dockerPs: string, kind: "db" | "kong", hostPort: number): string[] {
  const ids: string[] = [];
  for (const line of dockerPs.split("\n")) {
    const [name, ports = ""] = line.trim().split("|");
    const m = name?.match(new RegExp(`^supabase_${kind}_(.+)$`));
    if (!m) continue;
    if ([...ports.matchAll(/:(\d+)->/g)].some((x) => Number(x[1]) === hostPort)) ids.push(m[1]);
  }
  return ids;
}

/** DB URL 과 API URL(들)이 같은 격리 project 의 db/kong 컨테이너를 가리키는지. apiUrls 는 설정된 모든 API URL 변수의 값. */
export function verifySameIsolatedStack(input: { dbUrl: string | undefined; apiUrls: string[]; dockerPs: string }): StackResult {
  const reasons: string[] = [];
  const db = input.dbUrl?.trim() ?? "";
  const dbPort = db ? hostPortOf(db) : null;
  if (!dbPort) reasons.push("DB URL 이 없거나 로컬(127.0.0.1/localhost) 포트 URL 이 아니다.");
  const apis = input.apiUrls.map((u) => u.trim()).filter(Boolean);
  if (apis.length === 0) reasons.push("API URL 이 없다.");
  const apiPorts = apis.map((u) => ({ u, p: hostPortOf(u) }));
  for (const a of apiPorts) if (!a.p) reasons.push(`API URL ${a.u} 이 로컬 포트 URL 이 아니다.`);
  if (reasons.length) return { ok: false, reasons };

  const dbIds = projectsPublishing(input.dockerPs, "db", dbPort!);
  if (dbIds.length !== 1) reasons.push(`DB 포트 ${dbPort} 를 게시하는 supabase_db_* 컨테이너가 ${dbIds.length}개다(정확히 1개여야 한다).`);
  const ids = new Set<string>(dbIds);
  for (const a of apiPorts) {
    const kids = projectsPublishing(input.dockerPs, "kong", a.p!);
    if (kids.length !== 1) reasons.push(`API 포트 ${a.p} 를 게시하는 supabase_kong_* 컨테이너가 ${kids.length}개다(정확히 1개여야 한다).`);
    kids.forEach((k) => ids.add(k));
  }
  if (reasons.length) return { ok: false, reasons };
  if (ids.size !== 1) return { ok: false, reasons: [`DB 와 API 가 서로 다른 project 를 가리킨다: ${[...ids].join(", ")}.`] };
  const id = [...ids][0];
  if (id.toLowerCase() === SHARED_PROJECT_ID.toLowerCase()) return { ok: false, reasons: [`대상이 공유 스택(project ${id}) 이다.`] };
  if (!ISOLATED_RX.test(id)) return { ok: false, reasons: [`project id ${id} 는 격리 스택 형식(ALTON_<이름>)이 아니다.`] };
  return { ok: true, projectId: id };
}

/** DB 접속이 없고 API(supabase-js)만 쓰는 스크립트용: 모든 API URL 이 같은 격리 project 의 kong 컨테이너를 가리키는지. */
export function verifyIsolatedApi(input: { apiUrls: string[]; dockerPs: string }): StackResult {
  const apis = input.apiUrls.map((u) => u.trim()).filter(Boolean);
  if (apis.length === 0) return { ok: false, reasons: ["API URL 이 없다."] };
  const reasons: string[] = []; const ids = new Set<string>();
  for (const u of apis) {
    const p = hostPortOf(u);
    if (!p) { reasons.push(`API URL ${u} 이 로컬 포트 URL 이 아니다.`); continue; }
    const kids = projectsPublishing(input.dockerPs, "kong", p);
    if (kids.length !== 1) reasons.push(`API 포트 ${p} 를 게시하는 supabase_kong_* 컨테이너가 ${kids.length}개다(정확히 1개여야 한다).`);
    kids.forEach((k) => ids.add(k));
  }
  if (reasons.length) return { ok: false, reasons };
  if (ids.size !== 1) return { ok: false, reasons: [`API URL 들이 서로 다른 project 를 가리킨다: ${[...ids].join(", ")}.`] };
  const id = [...ids][0];
  if (id.toLowerCase() === SHARED_PROJECT_ID.toLowerCase()) return { ok: false, reasons: [`대상이 공유 스택(project ${id}) 이다.`] };
  if (!ISOLATED_RX.test(id)) return { ok: false, reasons: [`project id ${id} 는 격리 스택 형식(ALTON_<이름>)이 아니다.`] };
  return { ok: true, projectId: id };
}

/** API 만 쓰는 스크립트 진입부: 모든 env 파일을 읽어 process.env 에 반영한 뒤 API 대상이 격리 스택인지 docker 로 확인(아니면 쓰기 전에 종료). */
export function assertIsolatedApiOrExit(apiVars: string[]): { projectId: string; apiUrl: string } {
  const merged = mergeEnv(process.env, readEnvFiles());
  for (const [k, v] of Object.entries(merged)) if (v !== undefined && process.env[k] === undefined) process.env[k] = v;
  const apiUrls = apiVars.map((k) => merged[k] ?? "").filter(Boolean);
  let ps = "";
  try { ps = dockerPsSnapshot(); } catch (e) { console.error(`docker 로 대상 스택을 확인하지 못했다(${(e as Error).message}). 중단.`); process.exit(1); }
  const r = verifyIsolatedApi({ apiUrls, dockerPs: ps });
  if (!r.ok) { console.error(`대상 스택 검증 실패 — 쓰기 전에 중단: ${r.reasons.join(" ")}`); process.exit(1); }
  return { projectId: r.projectId, apiUrl: apiUrls[0] };
}

export function dockerPsSnapshot(): string {
  return execFileSync("docker", ["ps", "--format", "{{.Names}}|{{.Ports}}"], { encoding: "utf-8", timeout: 15_000 });
}

/** 스크립트 진입부용: env 파일 전부를 읽어 process.env 에 반영한 뒤 대상 동일성을 검사한다. 실패하면 메시지를 내고 종료(쓰기 전). */
export function assertIsolatedTargetOrExit(opts: { apiVars: string[]; dbVar?: string }): { projectId: string; dbUrl: string; apiUrl: string } {
  const merged = mergeEnv(process.env, readEnvFiles());
  for (const [k, v] of Object.entries(merged)) if (v !== undefined && process.env[k] === undefined) process.env[k] = v;
  const dbUrl = merged[opts.dbVar ?? "SUPABASE_TEST_DB_URL"] ?? "";
  const apiUrls = opts.apiVars.map((k) => merged[k] ?? "").filter(Boolean);
  let ps = "";
  try { ps = dockerPsSnapshot(); } catch (e) { console.error(`docker 로 대상 스택을 확인하지 못했다(${(e as Error).message}). 중단.`); process.exit(1); }
  const r = verifySameIsolatedStack({ dbUrl, apiUrls, dockerPs: ps });
  if (!r.ok) { console.error(`대상 스택 검증 실패 — 쓰기 전에 중단: ${r.reasons.join(" ")}`); process.exit(1); }
  return { projectId: r.projectId, dbUrl, apiUrl: apiUrls[0] };
}
