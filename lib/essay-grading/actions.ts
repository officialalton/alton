"use server";

import { after } from "next/server";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase-admin";
import { loadMockExamAttemptDetail } from "@/lib/mock-exam/attempt-data";
import { parseFrqAnswer } from "@/lib/ap-exam/frq-answer";
import { createAnthropicGraderClient } from "./client";
import { flagEnabled } from "./costs";
import { concatSaqAnswers, parseEssayContext } from "./context";
import { loadEssayPayload } from "./payload";
import { processEssay, type Job } from "./queue";
import { essayGradingSubject } from "./subject";
import { EURO_RUBRIC_ID, USH_RUBRIC_ID, WHAP_RUBRIC_ID } from "./rubric";
import { createSupabaseEssayStore } from "./store";

type Result = { ok: true; value: { enabled: boolean; queued: number } } | { ok: false; error: string };

/** 제출 직후(결과 화면 진입 시) 호출. 본인 채점 완료 AP English·U.S. History 응시의 에세이 파트마다 큐에 넣고 응답 뒤에(after) 순차 처리한다. 멱등 — 이미 done/processing 이면 건너뛰고, 재시도 가능한 failed 는 다시 시도한다.
 *  플래그 꺼짐이면 아무 것도 하지 않는다(DB·모델 호출 없음). */
export async function enqueueEssayGradingAction(attemptId: string): Promise<Result> {
  if (!flagEnabled()) return { ok: true, value: { enabled: false, queued: 0 } };
  try {
    const { user, supabase } = await requireUser();
    const attempt = await loadMockExamAttemptDetail(supabase, attemptId); // 본인 응시만(RPC 권한)
    if (!attempt || attempt.studentId !== user.id || attempt.examProgram !== "ap" || !essayGradingSubject(attempt.apSubject) || attempt.status !== "graded") return { ok: false, error: "Not available." };
    const admin = createAdminClient();
    const deps = { store: createSupabaseEssayStore(admin), client: createAnthropicGraderClient() };
    const jobs: Job[] = [];
    for (const it of attempt.items) {
      if (it.format !== "essay") continue;
      const answers = parseFrqAnswer(it.response ?? "");
      const payload = await loadEssayPayload(admin, it.problemId);
      const parts = it.parts ?? [];
      const parsed = parts[0] ? parseEssayContext(payload, parts[0].label) : null;
      const first = parsed && attempt.apSubject === "ap_european_history" && parsed.rubricId === WHAP_RUBRIC_ID ? { ...parsed, rubricId: EURO_RUBRIC_ID } : parsed; // 유럽사 FRQ payload 는 whap_frq 형식 — 루브릭만 euro-v1 로
      if ((first?.rubricId === USH_RUBRIC_ID || first?.rubricId === WHAP_RUBRIC_ID || first?.rubricId === EURO_RUBRIC_ID) && first.taskType === "saq" && parts.length > 0) {
        // SAQ: 한 문항(A·B·C)을 한 건으로 채점 — 답한 파트를 "(A) … (B) … (C) …" 로 합치고 첫 파트 라벨을 키로 쓴다.
        const essay = concatSaqAnswers(parts, answers);
        jobs.push({ attemptId, setItemId: it.setItemId, partLabel: parts[0].label, studentId: user.id, essay, ...first });
        continue;
      }
      for (const p of parts) {
        const c0 = parseEssayContext(payload, p.label) ?? { taskPrompt: p.prompt, sources: [], anchors: [] };
        const ctx = attempt.apSubject === "ap_european_history" && (c0 as { rubricId?: string }).rubricId === WHAP_RUBRIC_ID ? { ...c0, rubricId: EURO_RUBRIC_ID } : c0;
        jobs.push({ attemptId, setItemId: it.setItemId, partLabel: p.label, studentId: user.id, essay: answers[p.label] ?? "", ...ctx, ...(attempt.apSubject === "ap_english_literature" ? { rubricId: "englit" } : {}) });
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
