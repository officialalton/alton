import type { createAdminClient } from "@/lib/supabase-admin";

/** 문항의 stock JSON(payload: sources·samples 포함) 로더.
 *  TODO(문항 생성 단계): English FRQ 문항이 problems 에 적재될 때 payload 의 저장 열이 확정되면 여기서 읽는다.
 *  지금은 null → actions 가 앵커 샘플 부족으로 채점을 건너뛴다(점수 신뢰도 보증 불가 시 채점하지 않는 안전 기본값). */
export async function loadEssayPayload(_admin: ReturnType<typeof createAdminClient>, _problemId: string): Promise<unknown | null> {
  return null;
}
