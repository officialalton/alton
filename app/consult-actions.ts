"use server";

import { createAdminClient } from "@/lib/supabase-admin";
import { sendEmail } from "@/lib/email";

export async function submitConsultRequest(params: {
  parentName: string;
  email: string;
  phone: string;
  studentName: string;
  studentGrade: string;
  location: string;
  concerns: string;
}): Promise<void> {
  if (!params.parentName.trim() || !params.email.trim()) {
    throw new Error("이름과 이메일은 필수입니다.");
  }

  const admin = createAdminClient();
  const concernsWithContext = [
    params.studentName ? `학생 이름: ${params.studentName}` : null,
    params.location ? `거주 지역: ${params.location}` : null,
    params.concerns ? `\n${params.concerns}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const { error } = await admin.from("consult_requests").insert({
    category: "family",
    person_name: params.parentName.trim(),
    email: params.email.trim(),
    phone: params.phone.trim() || null,
    student_grade: params.studentGrade.trim() || null,
    concerns: concernsWithContext || null,
  });
  if (error) throw new Error(error.message);

  await sendEmail({
    to: params.email.trim(),
    subject: "[Alton Education] 상담 신청이 접수되었습니다",
    html: `
      <p>${params.parentName.trim()}님, 안녕하세요.</p>
      <p>Alton Education 1:1 수업 상담 신청이 정상적으로 접수되었습니다.</p>
      <p>영업일 기준 1~2일 내에 담당자가 입력하신 연락처로 연락드리겠습니다.</p>
      <p>감사합니다.<br/>Alton Education</p>
    `,
  });
}
