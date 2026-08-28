import crypto from "crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";

// 070(Calendly): 상담 예약이 실제로 잡히면 Calendly가 이 엔드포인트로 웹훅을 보낸다.
// 등록은 scripts/register-calendly-webhook.mjs로 한 번만 하면 되고(배포된 URL 필요),
// 그때 발급되는 signing_key를 CALENDLY_WEBHOOK_SIGNING_KEY에 넣어야 서명 검증이 된다.
function verifySignature(rawBody: string, signatureHeader: string | null): boolean {
  const signingKey = process.env.CALENDLY_WEBHOOK_SIGNING_KEY;
  if (!signingKey) return true; // 로컬 개발 등 서명 키 미설정 시 검증 생략
  if (!signatureHeader) return false;

  const parts = Object.fromEntries(
    signatureHeader.split(",").map((p) => p.split("=") as [string, string])
  );
  const t = parts.t;
  const v1 = parts.v1;
  if (!t || !v1) return false;

  const expected = crypto
    .createHmac("sha256", signingKey)
    .update(`${t}.${rawBody}`)
    .digest("hex");

  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(v1));
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("Calendly-Webhook-Signature");

  if (!verifySignature(rawBody, signature)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  const body = JSON.parse(rawBody) as {
    event: string;
    payload: {
      email?: string;
      name?: string;
      questions_and_answers?: { question: string; answer: string }[];
      scheduled_event?: {
        uri: string;
        start_time: string;
        end_time?: string;
        location?: { join_url?: string };
      };
      tracking?: { utm_content?: string | null };
    };
  };

  if (body.event !== "invitee.created") {
    return NextResponse.json({ ok: true, skipped: body.event });
  }

  const { email, name, questions_and_answers, scheduled_event, tracking } = body.payload;

  // 개별 회차 예약(학생 포털에서 담당 선생님과 예약, LessonsTab의 CalendlyWidget)은
  // embed URL에 ?utm_content=<enrollmentId>를 실어 보내고, Calendly가 이 값을
  // tracking.utm_content로 그대로 웹훅에 되돌려준다 — 이 값이 있으면 상담 신청이
  // 아니라 세션 예약으로 처리한다.
  if (tracking?.utm_content) {
    return handleSessionBooking(tracking.utm_content, scheduled_event);
  }

  if (!email || !name) {
    return NextResponse.json({ error: "missing invitee info" }, { status: 400 });
  }

  // Calendly 이벤트 타입의 커스텀 질문(학년/연락처 등)으로 받은 답변을 해당 컬럼에 매핑하고,
  // 나머지 질문(학생 이름, 거주 지역, 고민 등)은 concerns에 그대로 모아 기록한다.
  let studentGrade: string | null = null;
  let phone: string | null = null;
  const remaining: string[] = [];
  for (const qa of questions_and_answers ?? []) {
    if (qa.question.includes("학년")) studentGrade = qa.answer;
    else if (qa.question.includes("연락처") || qa.question.includes("전화")) phone = qa.answer;
    else remaining.push(`${qa.question}: ${qa.answer}`);
  }

  const admin = createAdminClient();
  const { error } = await admin.from("consult_requests").insert({
    category: "family",
    person_name: name,
    email,
    phone,
    student_grade: studentGrade,
    concerns: remaining.length ? remaining.join("\n") : null,
    status: "confirmed",
    scheduled_at: scheduled_event?.start_time ?? null,
    calendly_event_uri: scheduled_event?.uri ?? null,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

async function handleSessionBooking(
  enrollmentId: string,
  scheduledEvent?: {
    uri: string;
    start_time: string;
    end_time?: string;
    location?: { join_url?: string };
  }
): Promise<NextResponse> {
  if (!scheduledEvent) {
    return NextResponse.json({ error: "missing scheduled_event" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: enrollment } = await admin
    .from("enrollments")
    .select("id, current_session")
    .eq("id", enrollmentId)
    .maybeSingle();
  if (!enrollment) {
    // 잘못된/오래된 utm_content — 재시도해도 고쳐지지 않으므로 200으로 확인 응답
    return NextResponse.json({ ok: true, skipped: "unknown enrollment" });
  }

  const { data: existingSessions } = await admin
    .from("sessions")
    .select("session_number")
    .eq("enrollment_id", enrollmentId)
    .order("session_number", { ascending: false })
    .limit(1);
  const nextSessionNumber = (existingSessions?.[0]?.session_number ?? 0) + 1;

  const durationMinutes = scheduledEvent.end_time
    ? Math.round(
        (new Date(scheduledEvent.end_time).getTime() -
          new Date(scheduledEvent.start_time).getTime()) /
          60000
      )
    : 30;

  const { error: insertError } = await admin.from("sessions").insert({
    enrollment_id: enrollmentId,
    session_number: nextSessionNumber,
    status: "upcoming",
    scheduled_at: scheduledEvent.start_time,
    duration_minutes: durationMinutes,
    meeting_link: scheduledEvent.location?.join_url ?? null,
    calendly_event_uri: scheduledEvent.uri,
  });
  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  await admin
    .from("enrollments")
    .update({ current_session: nextSessionNumber })
    .eq("id", enrollmentId);

  return NextResponse.json({ ok: true });
}
