// 2026-09-16 — 읽기 전용: 지난 90일 envelope 전체를 훑어 특정 수신자 이메일(부분 일치)이
// 걸린 모든 envelope를 찾는다(수동 UI 발송으로 성공한 실제 envelope를 찾기 위함).
// 실행: npx tsx scripts/docusign-find-recipient.ts <email-substring>
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
  const needle = (process.argv[2] ?? "").toLowerCase();
  if (!needle) throw new Error("사용법: npx tsx scripts/docusign-find-recipient.ts <email-substring>");
  const { getAccessToken } = await import("../lib/docusign");
  const token = await getAccessToken();
  const base = `${process.env.DOCUSIGN_BASE_URI}/restapi/v2.1/accounts/${process.env.DOCUSIGN_ACCOUNT_ID}`;

  async function get(p: string) {
    const res = await fetch(`${base}${p}`, { headers: { Authorization: `Bearer ${token}` } });
    return { status: res.status, json: JSON.parse(await res.text()) };
  }

  const fromDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const list = await get(`/envelopes?from_date=${encodeURIComponent(fromDate)}&count=1000`);
  const envelopes = (list.json.envelopes ?? []) as { envelopeId: string; status: string; sentDateTime?: string; emailSubject: string }[];
  console.log(`총 envelope(90일): ${envelopes.length}`);
  for (const e of envelopes) {
    const r = await get(`/envelopes/${e.envelopeId}/recipients`);
    const signers = (r.json.signers ?? []) as Record<string, unknown>[];
    for (const s of signers) {
      const email = String(s.email ?? "").toLowerCase();
      if (email.includes(needle)) {
        console.log(`\n>>> envelopeId=${e.envelopeId} status=${e.status} subject="${e.emailSubject}" sent=${e.sentDateTime}`);
        console.log(JSON.stringify(s, null, 2));
      }
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
