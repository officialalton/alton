"use server";

import { createClient } from "@/utils/supabase/server";
import { loadLibraryBookWords, type LibraryWord } from "./vocab-library-data";

/**
 * 권 하나를 눌렀을 때만 그 권의 단어를 불러온다(전 권을 한 번에 안 받는다).
 *
 * 2026-10-08 — requireUser()를 거치지 않는다. 그 게이트는 getUser → profiles → 계정 상태 RPC 3개로
 * 순차 왕복 4번이라, 읽기 한 번에 왕복이 5번이었다(리전 간 지연이 큰 환경에서 'Loading…'이 길던 원인).
 * 공용 단어장은 "로그인 사용자 전체 조회" RLS 하나로 보호되는 읽기 전용 공용 데이터라(학생별 데이터 없음)
 * 로그인하지 않은 호출은 RLS 가 빈 결과로 막는다 — 왕복 1번.
 */
export async function loadLibraryBookWordsAction(bookId: string): Promise<LibraryWord[]> {
  const supabase = await createClient();
  return loadLibraryBookWords(supabase, bookId);
}
