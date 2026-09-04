import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { sendEmail } from "@/lib/email";

export async function GET(req: Request) {
  const email = new URL(req.url).searchParams.get("email");
  if (!email) return NextResponse.json({ error: "missing email" }, { status: 400 });
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.generateLink({ type: "recovery", email });
  if (error || !data?.properties?.hashed_token) {
    return NextResponse.json({ error }, { status: 500 });
  }
  const setPasswordUrl = new URL(
    `/set-password?token_hash=${encodeURIComponent(data.properties.hashed_token)}&type=recovery`,
    req.url
  );
  await sendEmail({
    to: email,
    subject: "[Alton Education] 학생 계정 비밀번호 설정 (검증)",
    html: `<p>검증용 발송입니다.</p><p><a href="${setPasswordUrl.toString()}">비밀번호 설정 링크</a></p>`,
  });
  return NextResponse.json({ sent: true });
}
