// 커밋 직전 검사(pre-commit 훅이 호출): 스테이징된 supabase/config.toml 이 공유 값이 아니면 커밋을 막는다.
//   npx tsx scripts/dev/check-config-toml.ts           # 스테이징된 파일(인덱스) 검사
//   npx tsx scripts/dev/check-config-toml.ts --file x  # 작업 트리 파일 검사
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { checkConfigToml } from "../../lib/dev/config-toml-guard";

const fileIdx = process.argv.indexOf("--file");
let text: string | null = null;
if (fileIdx > 0) text = readFileSync(process.argv[fileIdx + 1], "utf-8");
else {
  const staged = execFileSync("git", ["diff", "--cached", "--name-only"], { encoding: "utf-8" }).split("\n");
  if (!staged.includes("supabase/config.toml")) process.exit(0); // 이번 커밋에 포함되지 않음
  text = execFileSync("git", ["show", ":supabase/config.toml"], { encoding: "utf-8" });
}
const r = checkConfigToml(text, { ALLOW_CONFIG_TOML: process.env.ALLOW_CONFIG_TOML, CONFIG_TOML_NOTE: process.env.CONFIG_TOML_NOTE });
if (!r.ok) {
  console.error("커밋 차단: supabase/config.toml 이 공유 스택 값이 아닙니다.\n - " + r.reasons.join("\n - "));
  console.error("격리 스택 값이 섞여 들어간 것이면: git restore --staged supabase/config.toml && git checkout origin/preview/m4-integration-verification -- supabase/config.toml");
  console.error("repo config 를 일부러 고치는 경우에만: ALLOW_CONFIG_TOML=1 CONFIG_TOML_NOTE=\"<작업 메모>\" git commit ...");
  process.exit(1);
}
