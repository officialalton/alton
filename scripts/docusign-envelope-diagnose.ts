// 2026-09-16 — 읽기 전용 진단: DocuSign에 실제로 저장된 envelope/recipient 설정을 API로
// 직접 조회한다(로컬 코드가 아니라 DocuSign 쪽 진짜 상태 확인). 절대 봉투를 새로 만들지 않는다.
// 실행: npx tsx scripts/docusign-envelope-diagnose.ts <envelopeId>
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

const envPath = path.resolve(process.cwd(), ".env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf-8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

async function main() {
  const envelopeId = process.argv[2];
  if (!envelopeId) throw new Error("사용법: npx tsx scripts/docusign-envelope-diagnose.ts <envelopeId>");
  const { getAccessToken } = await import("../lib/docusign");
  const token = await getAccessToken();
  const base = `${process.env.DOCUSIGN_BASE_URI}/restapi/v2.1/accounts/${process.env.DOCUSIGN_ACCOUNT_ID}`;

  async function get(path: string) {
    const res = await fetch(`${base}${path}`, { headers: { Authorization: `Bearer ${token}` } });
    const text = await res.text();
    console.log(`\n=== GET ${path} (status ${res.status}) ===`);
    try { console.log(JSON.stringify(JSON.parse(text), null, 2)); } catch { console.log(text); }
  }

  await get(`/envelopes/${envelopeId}`);
  await get(`/envelopes/${envelopeId}/recipients`);
  await get(`/envelopes/${envelopeId}/notification`);
  await get(`/envelopes/${envelopeId}/audit_events`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
