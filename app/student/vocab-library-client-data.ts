"use server";

import { requireUser } from "@/lib/auth";
import { loadLibraryBookWords, type LibraryWord } from "./vocab-library-data";

/** 권 하나를 눌렀을 때만 그 권의 단어를 불러온다(전 권을 한 번에 안 받는다). */
export async function loadLibraryBookWordsAction(bookId: string): Promise<LibraryWord[]> {
  const { supabase } = await requireUser();
  return loadLibraryBookWords(supabase, bookId);
}
