import { checkIntegrationTargetWithDocker, integrationGuardMessage } from "./lib/dev/integration-db-guard";
import { dockerPsSnapshot, mergeEnv, readEnvFiles } from "./lib/dev/stack-identity";

// vitest "integration" 프로젝트 globalSetup — 테스트 파일이 하나도 실행되기 전에 대상 DB 를 검사한다.
// 모든 env 파일(.env.local, .env)과 process env 를 다 읽어 효과적 값을 정한 뒤(테스트가 읽는 process.env 와 같은 값이 되도록 반영) 포트 검사 + docker 컨테이너 동일 격리 project 검사.
export default function setup() {
  const merged = mergeEnv(process.env, readEnvFiles());
  for (const k of ["SUPABASE_TEST_DB_URL", "SUPABASE_TEST_API_URL"]) if (process.env[k] === undefined && merged[k] !== undefined) process.env[k] = merged[k];
  const r = checkIntegrationTargetWithDocker(process.env, dockerPsSnapshot);
  if (!r.ok) throw new Error(integrationGuardMessage(r.reasons));
}
