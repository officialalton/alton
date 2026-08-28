"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { getRoleHomePath } from "@/lib/auth";

export async function login(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.user) {
    redirect(
      "/login?error=" +
        encodeURIComponent("이메일 또는 비밀번호가 올바르지 않습니다.")
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .single();

  redirect(getRoleHomePath(profile?.role));
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
