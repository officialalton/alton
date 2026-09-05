import { NextResponse } from "next/server";
import { syncOneReservationCalendarEvent } from "@/lib/booking/calendar-sync";
import { createAdminClient } from "@/lib/supabase-admin";

export async function GET(req: Request) {
  const reservationId = new URL(req.url).searchParams.get("reservationId");
  if (!reservationId) return NextResponse.json({ error: "missing reservationId" }, { status: 400 });
  const result = await syncOneReservationCalendarEvent(reservationId);
  const admin = createAdminClient();
  const { data } = await admin
    .from("reservations")
    .select("google_sync_status, google_meet_link, google_event_id, google_sync_last_error")
    .eq("id", reservationId)
    .maybeSingle();
  return NextResponse.json({ result, reservation: data });
}
