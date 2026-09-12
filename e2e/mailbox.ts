// R2 Task 4 — 로컬 Mailpit(local_smtp)에서 실제로 발송된 초대 메일을 찾아
// ALTON 자체 토큰을 추출한다. 링크를 우리가 직접 만들지 않고 실제로 보낸
// 메일 본문에서 파싱해야 "메일 발송 → 링크 클릭 → 수락"의 전체 경로를
// 검증할 수 있다.
const MAILPIT_URL = "http://127.0.0.1:54424";

export async function findLatestEmailTo(
  toAddress: string,
  subjectContains?: string
): Promise<{ html: string; text: string; subject: string }> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const res = await fetch(
      `${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:${toAddress}`)}`
    );
    const data = (await res.json()) as {
      messages: { ID: string; Subject: string; Created: string }[];
    };
    const candidates = subjectContains
      ? data.messages.filter((m) => m.Subject.includes(subjectContains))
      : data.messages;
    if (candidates.length > 0) {
      const latest = candidates.sort((a, b) => (a.Created < b.Created ? 1 : -1))[0];
      const msgRes = await fetch(`${MAILPIT_URL}/api/v1/message/${latest.ID}`);
      const msg = (await msgRes.json()) as { HTML: string; Text: string; Subject: string };
      return { html: msg.HTML, text: msg.Text, subject: msg.Subject };
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`${toAddress} 앞으로 온 메일을 찾지 못했습니다(subject 조건: ${subjectContains ?? "없음"}).`);
}

export function extractInviteAcceptUrl(html: string): string {
  const match = html.match(/https?:\/\/[^\s"<]+\/api\/invite\/accept\?token=[^\s"<]+/);
  if (!match) throw new Error("메일 본문에서 초대 수락 링크를 찾지 못했습니다.");
  return match[0];
}

// M4 (6/N) — 체험 온보딩 안내 메일 본문에서 redeem 링크를 추출.
export function extractTrialOnboardingRedeemUrl(html: string): string {
  const match = html.match(/https?:\/\/[^\s"<]+\/api\/trial-onboarding\/redeem\?token=[^\s"<]+/);
  if (!match) throw new Error("메일 본문에서 체험 온보딩 링크를 찾지 못했습니다.");
  return match[0];
}

// M4 (6/N) — 로그인 이메일 변경 확인 메일 본문에서 confirm-email-change 링크를 추출.
export function extractLoginEmailChangeConfirmUrl(html: string): string {
  const match = html.match(/https?:\/\/[^\s"<]+\/api\/trial-onboarding\/confirm-email-change\?token=[^\s"<]+/);
  if (!match) throw new Error("메일 본문에서 로그인 이메일 확인 링크를 찾지 못했습니다.");
  return match[0];
}
