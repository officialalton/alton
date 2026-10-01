// 키워드 스크립트 공용 접속(service role). 값은 환경변수에서만 읽고 출력하지 않는다.
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";

export function loadEnvLocal() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf-8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

/** SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 우선, 없으면 기존 임포트 스크립트와 같은 NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY. */
export async function connect(): Promise<{ db: SupabaseClient; target: string } | null> {
  loadEnvLocal();
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  const { createClient } = await import("@supabase/supabase-js");
  const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const target = /^https?:\/\/(127\.0\.0\.1|localhost)/.test(url) ? "local" : new URL(url).host;
  return { db, target };
}

/** range 페이지 읽기(1000행 단위). */
export async function selectAll<T>(q: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await q(from, from + 999);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) return out;
  }
}
