"use server";

import { requireUser } from "@/lib/auth";

// 컨설턴트 Phase 2(스펙 §Transfer to the Assigned Consultant "Availability and
// meetings" — 본인 가능시간 직접 관리) — consult_availability_rules/exceptions에
// consultant_id = 본인으로 쓴다. RLS(20261453000000)가 본인 것만 쓰게 이미
// 막아준다.
export type ConsultantAvailabilityRule = {
  id: string;
  weekday: number;
  startTime: string;
  endTime: string;
  active: boolean;
};

export async function listMyAvailabilityRulesAction(): Promise<ConsultantAvailabilityRule[]> {
  const { user, supabase } = await requireUser();
  const { data, error } = await supabase
    .from("consult_availability_rules")
    .select("id, weekday, start_time, end_time, active")
    .eq("consultant_id", user.id)
    .order("weekday", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    id: r.id as string,
    weekday: r.weekday as number,
    startTime: r.start_time as string,
    endTime: r.end_time as string,
    active: r.active as boolean,
  }));
}

export async function addMyAvailabilityRuleAction(params: { weekday: number; startTime: string; endTime: string }): Promise<void> {
  const { user, supabase } = await requireUser();
  const { error } = await supabase.from("consult_availability_rules").insert({
    weekday: params.weekday,
    start_time: params.startTime,
    end_time: params.endTime,
    consultant_id: user.id,
    created_by: user.id,
  });
  if (error) {
    if (error.code === "23P01") throw new Error("같은 요일에 겹치는 시간대가 이미 등록되어 있습니다.");
    throw new Error(error.message);
  }
}

/** 스펙 §Assignment Modes "accepting-new-work flag" — 자동배정 대상에서 스스로 빠지고 들어올 수 있다. */
export async function loadMyAcceptingNewWorkAction(): Promise<boolean> {
  const { user, supabase } = await requireUser();
  const { data, error } = await supabase.from("consultant_settings").select("accepting_new_work").eq("consultant_id", user.id).maybeSingle();
  if (error) throw new Error(error.message);
  return data?.accepting_new_work ?? true;
}

export async function setMyAcceptingNewWorkAction(accepting: boolean): Promise<void> {
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("set_consultant_accepting_new_work", { p_accepting: accepting });
  if (error) throw new Error(error.message);
}

export async function deactivateMyAvailabilityRuleAction(ruleId: string): Promise<void> {
  const { user, supabase } = await requireUser();
  const { error } = await supabase
    .from("consult_availability_rules")
    .update({ active: false })
    .eq("id", ruleId)
    .eq("consultant_id", user.id);
  if (error) throw new Error(error.message);
}
