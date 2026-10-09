import { checkIntegrationTarget, integrationGuardMessage } from "./lib/dev/integration-db-guard";

// vitest "integration" 프로젝트 globalSetup — 테스트 파일이 하나도 실행되기 전에 대상 DB 를 검사한다.
export default function setup() {
  const r = checkIntegrationTarget(process.env);
  if (!r.ok) throw new Error(integrationGuardMessage(r.reasons));
}
