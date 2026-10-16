// 래퍼(isolated-stack.sh)가 부르는 검사 CLI. 통과하면 exit 0, 아니면 사유 출력 후 exit 1.
//   tsx scripts/dev/isolated-guard-cli.ts config            # supabase/config.toml 이 격리 값인지
//   tsx scripts/dev/isolated-guard-cli.ts teardown          # tmp/isolated-stack.lock 의 id 로 docker 상태 검사
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { checkIsolatedConfig, checkIsolatedTeardown, snapshotFromDockerPs } from "../../lib/dev/isolated-stack-guard";

const LOCK = "tmp/isolated-stack.lock";
const cmd = process.argv[2];
let r;
if (cmd === "config") {
  const t = readFileSync("supabase/config.toml", "utf-8");
  const id = t.match(/^project_id\s*=\s*"([^"]+)"/m)?.[1];
  const ports = [...t.matchAll(/^\s*(?:port|shadow_port|smtp_port|pop3_port)\s*=\s*(\d+)/gm)].map((m) => Number(m[1]));
  r = checkIsolatedConfig(id, ports);
} else if (cmd === "teardown") {
  const lockId = existsSync(LOCK) ? (JSON.parse(readFileSync(LOCK, "utf-8")) as { projectId?: string }).projectId : undefined;
  const out = lockId ? execFileSync("docker", ["ps", "-a", "--format", "{{.Names}}|{{.Ports}}"], { encoding: "utf-8" }) : "";
  r = checkIsolatedTeardown({ projectId: lockId, lockProjectId: lockId, snapshot: lockId ? snapshotFromDockerPs(out, lockId) : { containers: [], ports: [] } });
  if (r.ok) console.log(lockId);
} else r = { ok: false as const, reason: "usage: config|teardown" };
if (!r.ok) { console.error(`차단: ${r.reason}`); process.exit(1); }
