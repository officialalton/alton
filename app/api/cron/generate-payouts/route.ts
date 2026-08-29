import { NextResponse } from "next/server";
import { generatePayoutsAsCron } from "@/app/admin/payouts-actions";
import { previousMonthRange } from "@/app/admin/payouts-data";

export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!expected || authHeader !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await generatePayoutsAsCron(previousMonthRange(new Date()));
  return NextResponse.json({ ok: true, ...result });
}
