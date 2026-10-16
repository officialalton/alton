// 2026-09-16 — 읽기 전용 진단(2차): (a) 이 DocuSign 계정의 실제 Users 목록에 문제의
// 수신자 이메일이 있는지 확인(설정 변경·삭제 절대 안 함), (b) 최근 envelope 목록에서
// 실제로 delivered/completed까지 간 사례를 찾아 비교 기준으로 삼는다. 절대 봉투를
// 새로 만들거나 재발송하지 않는다.
// 실행: npx tsx scripts/docusign-account-diagnose.ts
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
  const { getAccessToken } = await import("../lib/docusign");
  const token = await getAccessToken();
  const base = `${process.env.DOCUSIGN_BASE_URI}/restapi/v2.1/accounts/${process.env.DOCUSIGN_ACCOUNT_ID}`;

  async function get(p: string) {
    const res = await fetch(`${base}${p}`, { headers: { Authorization: `Bearer ${token}` } });
    const text = await res.text();
    let json: unknown;
    try { json = JSON.parse(text); } catch { json = text; }
    return { status: res.status, json };
  }

  console.log("=== 1) 계정 Users 목록(읽기 전용) — matchbox512 관련 이메일이 실제 멤버인지 확인 ===");
  const users = await get("/users?count=100");
  console.log(`status ${users.status}`);
  const userList = (users.json as { users?: { userName: string; email: string; userId: string; userStatus: string }[] })?.users ?? [];
  console.log(`전체 사용자 수: ${userList.length}`);
  for (const u of userList) {
    console.log(`- ${u.userName} <${u.email}> status=${u.userStatus} userId=${u.userId}`);
  }
  const matches = userList.filter((u) => u.email?.toLowerCase().includes("matchbox512"));
  console.log(`\nmatchbox512 포함 이메일 멤버: ${matches.length}개`);
  console.log(JSON.stringify(matches, null, 2));

  console.log("\n=== 2) 최근 30일 envelope 목록에서 delivered/completed까지 간 실제 성공 사례 찾기 ===");
  const fromDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const list = await get(`/envelopes?from_date=${encodeURIComponent(fromDate)}&count=100`);
  console.log(`status ${list.status}`);
  const envelopes = (list.json as { envelopes?: { envelopeId: string; status: string; sentDateTime?: string; emailSubject: string }[] })?.envelopes ?? [];
  console.log(`조회된 envelope 수: ${envelopes.length}`);
  const byStatus: Record<string, number> = {};
  for (const e of envelopes) byStatus[e.status] = (byStatus[e.status] ?? 0) + 1;
  console.log("상태별 개수:", JSON.stringify(byStatus, null, 2));

  const succeeded = envelopes.filter((e) => ["delivered", "completed", "declined"].includes(e.status));
  console.log(`\ndelivered/completed/declined까지 간 envelope: ${succeeded.length}개`);
  for (const e of succeeded.slice(0, 10)) {
    console.log(`- ${e.envelopeId} status=${e.status} sent=${e.sentDateTime} subject=${e.emailSubject}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
