import { NextResponse } from "next/server";
import { requirePayoutCapability } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-admin";
import { mercuryKrwInputListCsv, payoutListCsv, reconciliationCsv, type PayoutListRow, type ReconRow } from "@/lib/payout/reconciliation-csv";

// 지급 목록 / Mercury KRW 입력표 / 대사 파일 다운로드(2026-10-07). 대사 파일은 참조 전용이며 계좌번호·Stripe 거래를 담지 않는다.
// 권한: reconciliation = accounting_reconcile, 나머지 = view. 파일 이름에 개인정보를 넣지 않는다.
const TYPES = ["reconciliation", "payout-list", "mercury-krw-input"] as const;
type ExportType = (typeof TYPES)[number];

export async function GET(request: Request) {
  const url = new URL(request.url);
  const type = url.searchParams.get("type") as ExportType | null;
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  if (!type || !TYPES.includes(type)) return NextResponse.json({ error: "unknown export type" }, { status: 400 });
  if ((from && !/^\d{4}-\d{2}-\d{2}$/.test(from)) || (to && !/^\d{4}-\d{2}-\d{2}$/.test(to))) {
    return NextResponse.json({ error: "from/to must be YYYY-MM-DD" }, { status: 400 });
  }
  try {
    await requirePayoutCapability(type === "reconciliation" ? "accounting_reconcile" : "view");
  } catch {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const admin = createAdminClient();
  let q = admin.from("payout_reconciliation_rows").select("*").order("payment_deadline", { ascending: true }).limit(5000);
  if (from) q = q.gte("payment_deadline", from);
  if (to) q = q.lte("payment_deadline", to);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: "query failed" }, { status: 500 });
  const rows = (data ?? []) as unknown as ReconRow[];

  let body: string;
  if (type === "reconciliation") {
    body = reconciliationCsv(rows);
  } else {
    const ids = [...new Set(rows.map((r) => r.recipient_profile_id))];
    const [{ data: profiles }, { data: tAcc }, { data: cAcc }, { data: links }] = await Promise.all([
      ids.length ? admin.from("profiles").select("id, name").in("id", ids) : { data: [] },
      ids.length ? admin.from("teacher_payout_accounts").select("teacher_id, bank_name, account_number_last4").in("teacher_id", ids) : { data: [] },
      ids.length ? admin.from("consultant_payout_accounts").select("consultant_id, bank_name, account_number_last4").in("consultant_id", ids) : { data: [] },
      ids.length ? admin.from("payout_recipient_links").select("profile_id, status").in("profile_id", ids) : { data: [] },
    ]);
    const names = new Map((profiles ?? []).map((p) => [p.id as string, p.name as string]));
    const acc = new Map<string, { bank_name: string; last4: string }>();
    for (const a of tAcc ?? []) acc.set(a.teacher_id as string, { bank_name: a.bank_name as string, last4: a.account_number_last4 as string });
    for (const a of cAcc ?? []) acc.set(a.consultant_id as string, { bank_name: a.bank_name as string, last4: a.account_number_last4 as string });
    const linkStatus = new Map((links ?? []).map((l) => [l.profile_id as string, l.status as string]));
    const listRows: PayoutListRow[] = rows.map((r) => ({
      ...r,
      recipient_name: names.get(r.recipient_profile_id) ?? null,
      bank_name: acc.get(r.recipient_profile_id)?.bank_name ?? null,
      account_last4: acc.get(r.recipient_profile_id)?.last4 ?? null,
      recipient_status: linkStatus.get(r.recipient_profile_id) ?? null,
    }));
    body = type === "payout-list" ? payoutListCsv(listRows) : mercuryKrwInputListCsv(listRows);
  }
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="alton-${type}-${from ?? "all"}-${to ?? "all"}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
