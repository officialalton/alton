"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { currentRequestOrigin } from "@/lib/request-origin";

export async function requestReset(formData: FormData) {
  const email = formData.get("email") as string;
  const siteUrl = await currentRequestOrigin();

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl}/set-password`,
  });

  // 이메일 존재 여부와 무관하게 항상 동일한 결과를 보여준다 (계정 존재 여부 노출 방지).
  redirect("/reset-password?sent=1");
}
