import { NextResponse } from "next/server";
import { getWorkspaceUserByEmail } from "@/lib/google-workspace-directory-readonly";

export async function GET(req: Request) {
  const email = new URL(req.url).searchParams.get("email");
  if (!email) return NextResponse.json({ error: "missing email" }, { status: 400 });
  const user = await getWorkspaceUserByEmail(email);
  return NextResponse.json({ user });
}
