import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";

export async function POST(request: Request) {
  const url = new URL(request.url);
  const expectedToken = process.env.DOCUSIGN_WEBHOOK_TOKEN;
  if (url.searchParams.get("token") !== expectedToken) {
    return NextResponse.json({ error: "invalid token" }, { status: 401 });
  }

  const body = (await request.json()) as {
    event?: string;
    data?: { envelopeId?: string };
  };

  if (body.event !== "envelope-completed") {
    return NextResponse.json({ ok: true, skipped: body.event });
  }

  const envelopeId = body.data?.envelopeId;
  if (!envelopeId) {
    return NextResponse.json({ error: "missing envelopeId" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: contract } = await admin
    .from("contracts")
    .select("id, student_id")
    .eq("docusign_envelope_id", envelopeId)
    .maybeSingle();
  if (!contract) {
    return NextResponse.json({ ok: true, skipped: "unknown envelope" });
  }

  const { error: contractError } = await admin
    .from("contracts")
    .update({ status: "signed", signed_at: new Date().toISOString() })
    .eq("id", contract.id);
  if (contractError) {
    return NextResponse.json({ error: contractError.message }, { status: 500 });
  }

  const { error: studentError } = await admin
    .from("students")
    .update({ status: "active" })
    .eq("id", contract.student_id);
  if (studentError) {
    return NextResponse.json({ error: studentError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
