import { NextResponse } from "next/server";
import { getWorkspaceUserByEmail } from "@/lib/google-workspace-directory-readonly";

export async function GET(req: Request) {
  const email = new URL(req.url).searchParams.get("email");
  if (!email) return NextResponse.json({ error: "missing email" }, { status: 400 });
  try {
    const user = await getWorkspaceUserByEmail(email);
    return NextResponse.json({ user });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
