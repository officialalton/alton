import { createAdminClient } from "@/lib/supabase-admin";

// 컨설턴트 예약 링크(/schedule/[token]) — 무효·만료 토큰 판정.
// 토큰 검증은 DB RPC 안에서만 하고, 무효/만료면 RPC 가 아래 문구로 raise 한다
// (20261454000000_r_consultant_scheduling_link.sql). 서버 액션이 throw 하면 프로덕션은
// 문구를 가리고 일반 오류만 보이므로, 판정은 결과값으로 돌려 화면에서 직접 안내한다.
export const SCHEDULING_LINK_INVALID_MESSAGE = "This scheduling link is invalid or has expired.";
export const SCHEDULING_LINK_UNAVAILABLE_MESSAGE = "We couldn't load the scheduling details. Please try again in a moment.";

export const SCHEDULING_LINK_SLOT_TAKEN_MESSAGE = "That time is no longer available. Please choose another time.";

export type SchedulingLinkFailure = { ok: false; reason: "invalid_link" | "unavailable"; error: string };

type RpcError = { code?: string; message?: string } | null;

// RPC 오류 → 화면용 결과. 무효 토큰은 안내 문구, DB 가 직접 raise 한 한국어 사유(P0001, 예:
// 이미 마감된 시간)는 그대로, 그 밖의 인프라 오류는 일반 문구로 바꾸고 원문은 로그에만 남긴다.
export function toSchedulingLinkFailure(error: NonNullable<RpcError>, context: string): SchedulingLinkFailure {
  const message = error.message ?? "";
  if (message.includes("invalid or has expired")) {
    return { ok: false, reason: "invalid_link", error: SCHEDULING_LINK_INVALID_MESSAGE };
  }
  // 동시 확정 레이스: 사전 검사를 통과한 뒤 같은 컨설턴트의 시간이 먼저 잡히면 consultations_no_overlap(23P01).
  // 미팅과 겹친 경우(consultations_no_meeting_overlap, 20261913000000)는 DB 문구를 그대로 쓴다.
  if (error.code === "23P01") {
    return { ok: false, reason: "unavailable", error: /\bmeeting\b/i.test(message) ? message : SCHEDULING_LINK_SLOT_TAKEN_MESSAGE };
  }
  if (error.code === "P0001" && message) return { ok: false, reason: "unavailable", error: message };
  console.error(JSON.stringify({ type: "consultant_scheduling_link_rpc_failed", context, code: error.code ?? null, error: message }));
  return { ok: false, reason: "unavailable", error: SCHEDULING_LINK_UNAVAILABLE_MESSAGE };
}

// 페이지 진입 시 토큰이 살아 있는지 확인한다(1분 창 조회로 RPC 의 토큰 검증만 태운다).
export async function checkSchedulingLink(token: string): Promise<"valid" | "invalid" | "unknown"> {
  try {
    const admin = createAdminClient();
    const from = new Date();
    const { error } = await admin.rpc("list_consultant_open_slots", {
      p_token: token,
      p_from: from.toISOString(),
      p_to: new Date(from.getTime() + 60_000).toISOString(),
    });
    if (!error) return "valid";
    return toSchedulingLinkFailure(error, "probe").reason === "invalid_link" ? "invalid" : "unknown";
  } catch {
    return "unknown";
  }
}

/**
 * True when the consultation behind this link carries no first-consultation AI-notes consent stamp (a request created
 * internally rather than through the landing form). Then the scheduling page shows the same single consent wording.
 * Unknown / unreadable => false (never blocks booking on a lookup failure; AI notes then simply stay off).
 */
export async function schedulingLinkNeedsAiNotesConsent(token: string): Promise<boolean> {
  try {
    const admin = createAdminClient();
    const { data: link } = await admin.from("consultation_scheduling_links").select("consultation_id").eq("token", token).maybeSingle();
    const consultationId = (link as { consultation_id?: string } | null)?.consultation_id;
    if (!consultationId) return false;
    const { data } = await admin.from("consultations").select("ai_notes_consent_version").eq("id", consultationId).maybeSingle();
    return !!data && !(data as { ai_notes_consent_version?: string | null }).ai_notes_consent_version;
  } catch {
    return false;
  }
}
