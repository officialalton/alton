"use server";

import { after } from "next/server";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase-admin";
import { loadMockExamAttemptDetail } from "@/lib/mock-exam/attempt-data";
import { parseFrqAnswer } from "@/lib/ap-exam/frq-answer";
import { createAnthropicGraderClient } from "./client";
import { flagEnabled } from "./costs";
import { parseEssayContext } from "./context";
import { loadEssayPayload } from "./payload";
import { rubricIdForSubject } from "./rubric";
import { processEssay, type Job } from "./queue";
import { createSupabaseEssayStore } from "./store";

type Result = { ok: true; value: { enabled: boolean; queued: number } } | { ok: false; error: string };

/** 제출 직후(결과 화면 진입 시) 호출. 본인 채점 완료 AP English 응시의 에세이 파트마다 큐에 넣고 응답 뒤에(after) 순차 처리한다. 멱등 — 이미 done/processing 이면 건너뛰고, 재시도 가능한 failed 는 다시 시도한다.
 *  플래그 꺼짐이면 아무 것도 하지 않는다(DB·모델 호출 없음). */
export async function enqueueEssayGradingAction(attemptId: string): Promise<Result> {
  if (!flagEnabled()) return { ok: true, value: { enabled: false, queued: 0 } };
  try {
    const { user, supabase } = await requireUser();
    const attempt = await loadMockExamAttemptDetail(supabase, attemptId); // 본인 응시만(RPC 권한)
    if (!attempt || attempt.studentId !== user.id || attempt.examProgram !== "ap" || !rubricIdForSubject(attempt.apSubject) || attempt.status !== "graded") return { ok: false, error: "Not available." };
    const rubricId = rubricIdForSubject(attempt.apSubject)!; // englang | englit(문학은 별도 루브릭 id·버전 — 점수 행도 따로)
    const admin = createAdminClient();
    const deps = { store: createSupabaseEssayStore(admin), client: createAnthropicGraderClient() };
    const jobs: Job[] = [];
    for (const it of attempt.items) {
      if (it.format !== "essay") continue;
      const answers = parseFrqAnswer(it.response ?? "");
      const payload = await loadEssayPayload(admin, it.problemId);
      for (const p of it.parts ?? []) {
        const ctx = parseEssayContext(payload, p.label) ?? { taskPrompt: p.prompt, sources: [], anchors: [] };
        jobs.push({ attemptId, setItemId: it.setItemId, partLabel: p.label, studentId: user.id, essay: answers[p.label] ?? "", ...ctx, rubricId });
      }
    }
    // 보정(앵커) 샘플이 없는 문항은 채점하지 않는다 — 점수 신뢰도를 보증할 수 없다.
    const runnable = jobs.filter((j) => j.anchors.length >= 3);
    after(async () => { for (const j of runnable) await processEssay(deps, j); }); // 순차(동시 비용 폭주 방지)
    return { ok: true, value: { enabled: true, queued: runnable.length } };
  } catch {
    return { ok: false, error: "Could not start AI scoring." };
  }
}
