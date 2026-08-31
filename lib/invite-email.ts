import { sendEmail } from "./email";

const ROLE_LABEL: Record<"parent" | "student", string> = {
  parent: "보호자",
  student: "학생(자녀)",
};

export async function sendInviteEmail(params: {
  to: string;
  name: string;
  token: string;
  role: "parent" | "student";
}): Promise<void> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3010";
  const acceptUrl = `${siteUrl}/api/invite/accept?token=${encodeURIComponent(params.token)}`;

  await sendEmail({
    to: params.to,
    subject: "[Alton Education] 계정 초대",
    html: `
      <p>안녕하세요, ${params.name}님.</p>
      <p>Alton Education ${ROLE_LABEL[params.role]} 계정으로 초대되었습니다.</p>
      <p><a href="${acceptUrl}">여기를 눌러 초대를 수락하세요</a></p>
      <p>이 링크는 7일간 유효합니다. 본인이 요청하지 않았다면 이 메일을 무시하세요.</p>
      <p>감사합니다.<br/>Alton Education</p>
    `,
  });
}
