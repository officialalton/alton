// AP 스크립트 공용 접속(허용 목록 방식). --target local(기본) | --target <비프로덕션 ref> --i-know-nonprod <ref>. 그 외 호스트·프로덕션은 거부(lib/ap-generation/verify-guard.ts).
// 접속 값은 NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY 환경변수에서만 읽고 출력하지 않는다. 이 헬퍼는 접속만 하며 쓰기 여부(--execute, 기본 dry-run)는 호출한 스크립트가 정한다.
import { loadEnvLocal } from "../keywords/db";
import { resolveVerifyTarget } from "../../lib/ap-generation/verify-guard";

export async function connectAllowlisted(argv = process.argv) {
  const arg = (n: string) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : undefined; };
  loadEnvLocal();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new Error("SUPABASE_SECRET_KEY 환경변수가 없습니다.");
  const target = resolveVerifyTarget({ url, target: arg("target"), confirm: arg("i-know-nonprod") });
  const { createClient } = await import("@supabase/supabase-js");
  const db = createClient(url!, key, { auth: { autoRefreshToken: false, persistSession: false } });
  return { db, target, label: target.kind === "local" ? "local" : `nonprod(${target.ref})` };
}
