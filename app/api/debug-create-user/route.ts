import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";

export async function GET(req: Request) {
  const email = new URL(req.url).searchParams.get("email");
  if (!email) return NextResponse.json({ error: "missing email" }, { status: 400 });
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { name: "debug-probe" },
  });
  return NextResponse.json({ data: data ? { id: data.user?.id, email: data.user?.email } : null, error });
}
