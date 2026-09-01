import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { verifyDocusignWebhookSignature } from "@/lib/docusign";
import { queueDriveArtifactSync } from "@/lib/drive-artifacts";

// R3: docusign_envelope_id 컬럼이 contracts에 생겼으므로(20260912000000 마이그레이션)
// 이 라우트를 no-op 스텁에서 실제 처리로 복구한다.
// R3 교정(2026-09-13): envelope 연동이 contracts에서 contract_versions로 이관됐다
// (20260913000000 마이그레이션) — envelopeId 조회/갱신 대상을 contract_versions로 바꾼다.
//
// 정책(product-architecture-v3.md §5.5):
// - 서명 검증은 dev를 포함한 모든 환경에서 필수, 우회 없음(fail closed).
// - external_event_receipts(provider, event_id) unique로 idempotency 보장 —
//   이미 처리한 이벤트면 재처리하지 않고 200을 반환한다.
// - 완료(completed) 이벤트에서는 Drive 업로드를 이 요청 안에서 기다리지 않는다
//   (스텁이라 실제로 아직 업로드하지도 않는다) — drive_artifacts에 sync_status='queued'
//   행만 남기고 웹훅 응답은 즉시 반환한다(비동기 재시도 요구사항).

type DocusignConnectPayload = {
  event?: string; // 계정 레벨 Connect(aggregate) 형식일 때만 존재: "envelope-completed" 등
  data?: {
    envelopeId?: string;
    envelopeSummary?: {
      envelopeId?: string;
      status?: string;
      recipients?: { signers?: Array<{ declineReason?: string }> };
    };
  };
  // 2026-09-01 실측 확인: envelope 레벨 eventNotification(계정 레벨 Connect가 아님)은
  // event/data 래퍼 없이 envelope summary 필드를 최상위에 그대로 평탄하게 보낸다
  // (예: 최상위 envelopeId/status/emailSubject/... — GET /envelopes/{id} 응답과 유사한
  // 모양). 이 경로가 우리가 실제로 받는 형태다 — 아래에서 폴백으로 읽는다.
  envelopeId?: string;
  status?: string;
  recipients?: { signers?: Array<{ declineReason?: string }> };
};

const EVENT_TO_ENVELOPE_STATUS: Record<string, string> = {
  "envelope-sent": "sent",
  "envelope-delivered": "delivered",
  "envelope-completed": "completed",
  "envelope-declined": "declined",
  "envelope-voided": "voided",
};

// 순서 역전 웹훅 방어: DocuSign Connect는 재시도/네트워크 지연으로 이벤트를
// 발생 순서와 다르게 배달할 수 있다(정책: "중복·순서 역전 웹훅 멱등 처리"). 이미
// 더 "최종적인" 상태가 기록돼 있는데 그보다 앞선 단계의 이벤트가 뒤늦게 도착하면
// 상태를 되돌리지 않는다. completed/declined/voided는 최종 상태로 취급한다.
const TERMINAL_ENVELOPE_STATUSES = new Set(["completed", "declined", "voided"]);

// 진단 로그 필드만 남긴다 — 원문 바이트·서명 헤더값·계약/개인정보는 절대 포함하지
// 않는다. request.text()는 이 함수 안에서 정확히 한 번만 호출해, HMAC 검증과
// JSON.parse가 동일한 원문 바이트를 대상으로 하도록 보장한다(둘이 다른 바이트를
// 보면 서명은 통과했는데 파싱만 깨지는 것처럼 보이는 혼선이 생길 수 있다).
function logDiagnostic(stage: string, extra: Record<string, unknown>) {
  console.info(JSON.stringify({ type: "docusign_webhook_diagnostic", stage, ...extra }));
}

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type");
  const rawBody = await request.text();
  const signatureHeader = request.headers.get("X-DocuSign-Signature-1");

  const looksLikeJson = rawBody.trimStart().startsWith("{") || rawBody.trimStart().startsWith("[");
  const looksLikeXml = rawBody.trimStart().startsWith("<");

  if (!verifyDocusignWebhookSignature(rawBody, signatureHeader)) {
    logDiagnostic("signature_verification_failed", {
      contentType,
      bodyLength: rawBody.length,
      looksLikeJson,
      looksLikeXml,
      hasSignatureHeader: signatureHeader !== null,
    });
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let body: DocusignConnectPayload;
  try {
    body = JSON.parse(rawBody) as DocusignConnectPayload;
  } catch {
    logDiagnostic("json_parse_failed", {
      contentType,
      bodyLength: rawBody.length,
      looksLikeJson,
      looksLikeXml,
    });
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  // 1) 계정 레벨 Connect(aggregate) 형식: event/data.envelopeId
  // 2) envelope 레벨 eventNotification(실제로 우리가 받는 형식, 2026-09-01 실측):
  //    래퍼 없이 최상위 envelopeId/status — event 필드 자체가 없으므로 status로부터
  //    "envelope-<status>"를 합성해 기존 EVENT_TO_ENVELOPE_STATUS 매핑을 그대로 쓴다.
  const envelopeId = body.data?.envelopeId ?? body.data?.envelopeSummary?.envelopeId ?? body.envelopeId;
  const rawStatus = body.data?.envelopeSummary?.status ?? body.status;
  const event = body.event ?? (rawStatus ? `envelope-${rawStatus}` : undefined);
  if (!envelopeId || !event) {
    logDiagnostic("missing_event_or_envelope_id", {
      contentType,
      bodyLength: rawBody.length,
      topLevelKeys: Object.keys(body ?? {}),
      dataKeys: body?.data ? Object.keys(body.data) : null,
      hasEvent: event !== undefined,
      hasEnvelopeId: envelopeId !== undefined,
    });
    return NextResponse.json({ error: "missing event/envelopeId" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Idempotency: 이미 처리한 (provider, event_id) 조합이면 재처리하지 않고 200.
  // event_id는 DocuSign이 봉투 하나당 여러 이벤트를 보낼 수 있으므로 envelopeId
  // 단독이 아니라 envelopeId+event 조합으로 구성한다.
  const eventId = `${envelopeId}:${event}`;
  const { data: existingReceipt } = await admin
    .from("external_event_receipts")
    .select("id, processed_at")
    .eq("provider", "docusign")
    .eq("event_id", eventId)
    .maybeSingle();

  if (existingReceipt?.processed_at) {
    return NextResponse.json({ ok: true, skipped: "already processed" });
  }

  if (!existingReceipt) {
    const { error: insertError } = await admin
      .from("external_event_receipts")
      .insert({ provider: "docusign", event_id: eventId, payload: body });
    if (insertError) {
      // unique violation이면 동시 요청 경쟁 — 이미 처리 중/됨으로 취급하고 그냥 200.
      return NextResponse.json({ ok: true, skipped: "race: already recorded" });
    }
  }

  const envelopeStatus = EVENT_TO_ENVELOPE_STATUS[event];
  if (!envelopeStatus) {
    // 우리가 모르는 이벤트 타입 — 영수증은 남기되(위에서 이미 insert) 계약 갱신은 skip.
    await admin
      .from("external_event_receipts")
      .update({ processed_at: new Date().toISOString() })
      .eq("provider", "docusign")
      .eq("event_id", eventId);
    return NextResponse.json({ ok: true, skipped: `unhandled event: ${event}` });
  }

  const { data: contractVersion } = await admin
    .from("contract_versions")
    .select("id, contract_id, docusign_envelope_status")
    .eq("docusign_envelope_id", envelopeId)
    .maybeSingle();

  if (!contractVersion) {
    await admin
      .from("external_event_receipts")
      .update({ processed_at: new Date().toISOString() })
      .eq("provider", "docusign")
      .eq("event_id", eventId);
    return NextResponse.json({ ok: true, skipped: "unknown envelopeId" });
  }
  const contract = { id: contractVersion.contract_id };

  // 순서 역전 방어: 이미 최종 상태(completed/declined/voided)가 기록돼 있는데
  // 이번 이벤트가 그보다 앞선 비최종 상태(sent/delivered)면 무시한다 — 뒤늦게
  // 도착한 낡은 이벤트가 더 최종적인 상태를 덮어써 규정을 되돌리면 안 된다.
  const currentStatus = contractVersion.docusign_envelope_status as string | null;
  const isRegression =
    currentStatus !== null &&
    TERMINAL_ENVELOPE_STATUSES.has(currentStatus) &&
    !TERMINAL_ENVELOPE_STATUSES.has(envelopeStatus);

  const nowIso = new Date().toISOString();

  if (isRegression) {
    console.info(
      JSON.stringify({
        type: "docusign_envelope_event_ignored_out_of_order",
        contractId: contract.id,
        envelopeId,
        event,
        currentStatus,
        incomingStatus: envelopeStatus,
        at: nowIso,
      })
    );
    await admin
      .from("external_event_receipts")
      .update({ processed_at: nowIso })
      .eq("provider", "docusign")
      .eq("event_id", eventId);
    return NextResponse.json({ ok: true, skipped: "out-of-order: current status is more final" });
  }

  const { error: updateError } = await admin
    .from("contract_versions")
    .update({ docusign_envelope_status: envelopeStatus, docusign_status_updated_at: nowIso })
    .eq("id", contractVersion.id);
  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // 감사 로그: 웹훅으로 들어온 DocuSign 봉투 이벤트를 who(DocuSign 자체, 발신자
  // 개념 없음)/what/when 형태로 남긴다. 이 저장소에는 아직 범용 audit 테이블이
  // 없어(grep 결과 없음) 구조화 로그로 남긴다 — 전용 테이블이 생기면 여기를
  // 그 테이블 insert로 교체한다.
  console.info(
    JSON.stringify({
      type: "docusign_envelope_event",
      contractId: contract.id,
      envelopeId,
      event,
      envelopeStatus,
      at: nowIso,
    })
  );

  if (envelopeStatus === "completed") {
    // 정책(2026-09-13/결제 handoff): 서명 상태와 Drive 보관 상태는 분리한다 —
    // DocuSign 서명 완료 시 계약을 결제 가능 상태(v3_contract_status.active)로
    // 전환하되, Drive 업로드는 스텁이며 이 요청 응답을 블로킹하지 않는다(queued 행만
    // 남긴다). Drive 저장 실패는 drive_artifacts.sync_status로만 남고 이 상태 전이를
    // 되돌리지 않는다.
    const { error: activateError } = await admin
      .from("contracts")
      .update({ status: "active" })
      .eq("id", contract.id);
    if (activateError) {
      return NextResponse.json({ error: activateError.message }, { status: 500 });
    }
    await queueDriveArtifactSync({ contractId: contract.id, envelopeId });
  }

  if (envelopeStatus === "declined") {
    // 정책(2026-09-13): 보호자 서명 거부는 이 계약 버전의 envelope 상태를 declined로
    // 기록(위에서 이미 처리)하고, ALTON 계약 자체는 새 상태를 추가하지 않고 기존
    // v3_contract_status의 void로 종료한다. 거부 사유는 payload에 있으면 함께 저장한다
    // (20260915000000 추가 컬럼).
    const declineReason = (
      body.data?.envelopeSummary?.recipients?.signers ?? body.recipients?.signers
    )?.find((s) => s.declineReason)?.declineReason;
    await admin
      .from("contracts")
      .update({
        status: "void",
        void_reason: declineReason ?? "DocuSign: 보호자 서명 거부(declined)",
        voided_at: nowIso,
      })
      .eq("id", contract.id);
  }

  await admin
    .from("external_event_receipts")
    .update({ processed_at: nowIso })
    .eq("provider", "docusign")
    .eq("event_id", eventId);

  return NextResponse.json({ ok: true });
}
