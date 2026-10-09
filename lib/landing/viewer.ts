import { createClient } from "@/utils/supabase/server";
import { hasFeature, loadStudentFeatureAccess } from "@/lib/feature-access";
import { viewerFromAccount, type LandingViewer } from "./cta";

/** 공개 페이지용 가벼운 조회: 세션이 없으면 getUser 1회, 있으면 profile(+학생이면 권한) 조회. 실패는 비로그인으로 본다. */
export async function loadLandingViewer(): Promise<LandingViewer> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { kind: "anonymous" };
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (!profile) return { kind: "anonymous" };
    let tutoring = false;
    if (profile.role === "student") {
      tutoring = hasFeature(await loadStudentFeatureAccess(supabase, user.id), "class");
    }
    return viewerFromAccount(profile.role, tutoring);
  } catch {
    return { kind: "anonymous" };
  }
}
