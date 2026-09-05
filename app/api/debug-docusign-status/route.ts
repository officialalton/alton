import { NextResponse } from "next/server";
import { getEnvelopeStatus } from "@/lib/docusign";

export async function GET(request: Request) {
  const envelopeId = new URL(request.url).searchParams.get("envelopeId");
  if (!envelopeId) return NextResponse.json({ error: "envelopeId required" }, { status: 400 });
  try {
    const status = await getEnvelopeStatus(envelopeId);
    return NextResponse.json(status);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
