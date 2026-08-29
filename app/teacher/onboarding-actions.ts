"use server";

import { createClient } from "@/utils/supabase/server";

export async function submitCalendlyOnboarding(url: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("로그인이 필요합니다.");

  const trimmed = url.trim();
  if (!trimmed) throw new Error("Calendly 예약 링크를 입력해주세요.");

  const { error } = await supabase
    .from("teachers")
    .update({ calendly_scheduling_url: trimmed, status: "active" })
    .eq("id", user.id);
  if (error) throw new Error(error.message);
}
