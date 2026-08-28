// 070(Calendly) 웹훅 구독을 한 번만 등록하는 스크립트.
// Calendly는 콜백 URL이 실제로 공개된 https 주소여야 하므로, Vercel 배포 후에만 실행할 수 있다
// (localhost로는 등록 자체는 되어도 Calendly가 이벤트를 실제로 못 넣어준다).
//
// 사용법:
//   CALENDLY_API_TOKEN=... SITE_URL=https://alton.education node scripts/register-calendly-webhook.mjs
//
// 성공하면 출력되는 signing_key를 .env(.local)의 CALENDLY_WEBHOOK_SIGNING_KEY에 넣어야
// app/api/webhooks/calendly/route.ts가 서명을 검증할 수 있다.

const token = process.env.CALENDLY_API_TOKEN;
const siteUrl = process.env.SITE_URL;

if (!token || !siteUrl) {
  console.error("CALENDLY_API_TOKEN과 SITE_URL 환경변수가 필요합니다.");
  process.exit(1);
}

const me = await fetch("https://api.calendly.com/users/me", {
  headers: { Authorization: `Bearer ${token}` },
}).then((r) => r.json());

const organization = me.resource.current_organization;

const res = await fetch("https://api.calendly.com/webhook_subscriptions", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    url: `${siteUrl}/api/webhooks/calendly`,
    events: ["invitee.created"],
    organization,
    scope: "organization",
  }),
});

const data = await res.json();
if (!res.ok) {
  console.error("웹훅 등록 실패:", data);
  process.exit(1);
}

console.log("웹훅 등록 완료:", data.resource.uri);
console.log("signing_key:", data.resource.signing_key);
console.log("→ 이 signing_key를 CALENDLY_WEBHOOK_SIGNING_KEY 환경변수에 넣어주세요.");
