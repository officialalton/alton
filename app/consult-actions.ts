"use server";

import { createAdminClient } from "@/lib/supabase-admin";

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
}
