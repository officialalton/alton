"use server";

// P4-1(B) — 가구 아카이브·복귀 관리자 서버 액션.
// 처리 본체는 lib/household/household-archive.ts, DB 소스오브트루스는
// supabase/migrations/20261283000000_p4_1b_household_archive.sql.
//
// 클라이언트는 householdId만 보낸다 — 대상 자녀·매칭·예약은 서버가 다시 조회한다.

import { requireAdminOrCapability } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-admin";
import {
  archiveHousehold,
  previewHouseholdArchiveImpact,
  restoreHousehold,
  type HouseholdArchiveResult,
} from "@/lib/household/household-archive";
import { loadEmailById } from "./users-data";

const ARCHIVE_CAPABILITY = "매칭권한";

export type HouseholdArchivePreview = {
  childCount: number;
  activeAssignmentCount: number;
  cancellableReservationCount: number;
  liveReservationCount: number;
};

export async function previewHouseholdArchiveImpactAction(
  householdId: string
): Promise<HouseholdArchivePreview> {
  await requireAdminOrCapability(ARCHIVE_CAPABILITY);
  const rows = await previewHouseholdArchiveImpact(householdId);
  return {
    childCount: rows.length,
    activeAssignmentCount: rows.reduce((n, r) => n + r.activeAssignmentCount, 0),
    cancellableReservationCount: rows.reduce((n, r) => n + r.cancellableReservationCount, 0),
    liveReservationCount: rows.reduce((n, r) => n + r.liveReservationCount, 0),
  };
}

export async function archiveHouseholdAction(householdId: string): Promise<HouseholdArchiveResult> {
  const { actorUserId } = await requireAdminOrCapability(ARCHIVE_CAPABILITY);
  try {
    return await archiveHousehold({ householdId, actorId: actorUserId });
  } catch (e) {
    return { status: "failed", requestId: "", error: e instanceof Error ? e.message : String(e) };
  }
}

export async function restoreHouseholdAction(householdId: string): Promise<{ restored: boolean }> {
  const { actorUserId } = await requireAdminOrCapability(ARCHIVE_CAPABILITY);
  return restoreHousehold({ householdId, actorId: actorUserId });
}

export type ArchivedHouseholdListItem = {
  householdId: string;
  guardianId: string | null;
  guardianName: string;
  guardianEmail: string;
  childrenNames: string[];
  archivedAt: string;
  archivedByName: string | null;
  endedAssignments: number;
  cancelledReservations: number;
};

export async function listArchivedHouseholdsAction(): Promise<ArchivedHouseholdListItem[]> {
  await requireAdminOrCapability(ARCHIVE_CAPABILITY);
  const admin = createAdminClient();

  const { data: households, error } = await admin
    .from("households")
    .select("id, primary_guardian_id, archived_at, archived_by")
    .not("archived_at", "is", null)
    .order("archived_at", { ascending: false });
  if (error) throw new Error(error.message);
  if (!households?.length) return [];

  const householdIds = households.map((h) => h.id as string);
  const profileIds = Array.from(
    new Set(
      households
        .flatMap((h) => [h.primary_guardian_id as string | null, h.archived_by as string | null])
        .filter((v): v is string => Boolean(v))
    )
  );

  const [{ data: members, error: membersError }, { data: profiles, error: profilesError }, { data: events, error: eventsError }] =
    await Promise.all([
      admin
        .from("household_members")
        .select("household_id, profile_id, role, child:profiles(name)")
        .eq("role", "child")
        .in("household_id", householdIds),
      profileIds.length
        ? admin.from("profiles").select("id, name").in("id", profileIds)
        : Promise.resolve({ data: [], error: null }),
      admin
        .from("household_archive_events")
        .select("household_id, action, detail, created_at")
        .eq("action", "archived")
        .in("household_id", householdIds)
        .order("created_at", { ascending: false }),
    ]);
  if (membersError) throw new Error(membersError.message);
  if (profilesError) throw new Error(profilesError.message);
  if (eventsError) throw new Error(eventsError.message);

  const childrenByHousehold = new Map<string, string[]>();
  for (const m of members ?? []) {
    const rel = Array.isArray(m.child) ? m.child[0] : m.child;
    const name = (rel as { name?: string } | null)?.name ?? "";
    const list = childrenByHousehold.get(m.household_id as string) ?? [];
    if (name) list.push(name);
    childrenByHousehold.set(m.household_id as string, list);
  }
  const nameById = new Map((profiles ?? []).map((p) => [p.id as string, (p.name as string) ?? ""]));
  // 가장 최근 'archived' 이벤트만 쓴다(아카이브 → 복귀 → 재아카이브 이력이 있을 수 있다).
  const latestEventByHousehold = new Map<string, Record<string, unknown>>();
  for (const e of events ?? []) {
    if (!latestEventByHousehold.has(e.household_id as string)) {
      latestEventByHousehold.set(e.household_id as string, e.detail as Record<string, unknown>);
    }
  }

  const guardianIds = households
    .map((h) => h.primary_guardian_id as string | null)
    .filter((v): v is string => Boolean(v));
  const emailById = await loadEmailById(guardianIds);

  return households.map((h) => {
    const detail = latestEventByHousehold.get(h.id as string) ?? {};
    const guardianId = (h.primary_guardian_id as string | null) ?? null;
    return {
      householdId: h.id as string,
      guardianId,
      guardianName: guardianId ? nameById.get(guardianId) ?? "" : "",
      guardianEmail: guardianId ? emailById.get(guardianId) ?? "" : "",
      childrenNames: childrenByHousehold.get(h.id as string) ?? [],
      archivedAt: h.archived_at as string,
      archivedByName: h.archived_by ? nameById.get(h.archived_by as string) ?? null : null,
      endedAssignments: Number(detail.ended_assignments ?? 0),
      cancelledReservations: Number(detail.cancelled_reservations ?? 0),
    };
  });
}
