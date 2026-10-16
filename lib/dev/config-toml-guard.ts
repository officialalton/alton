// supabase/config.toml 커밋 가드(순수 함수): 공유 스택 값(project_id "ALTON", 포트 544xx 계열 + smtp 54325)이 아니면 차단한다.
// 격리 스택 래퍼가 임시로 바꾼 값이 실수로 커밋되는 사고(3회)를 막는다. 실제 repo config 를 일부러 고칠 때만 ALLOW_CONFIG_TOML=1(+ 작업 메모 CONFIG_TOML_NOTE)로 통과.
export const SHARED_PROJECT_ID = "ALTON";
const PORT_KEYS = /^\s*(?:port|shadow_port|smtp_port|pop3_port)\s*=\s*(\d+)/gm;
/** 공유 스택 포트 계열: 544xx(54420~54429) 와 smtp 54325. 그 밖(예: 545xx·546xx 격리 계열)은 차단. */
export const isSharedPort = (p: number) => (p >= 54420 && p <= 54429) || p === 54325;

export type ConfigCheck = { ok: true } | { ok: false; reasons: string[] };
export function checkConfigToml(text: string, env: { ALLOW_CONFIG_TOML?: string; CONFIG_TOML_NOTE?: string } = {}): ConfigCheck {
  const reasons: string[] = [];
  const id = text.match(/^project_id\s*=\s*"([^"]*)"/m)?.[1];
  if (id !== SHARED_PROJECT_ID) reasons.push(`project_id 가 "${SHARED_PROJECT_ID}" 가 아닙니다(${id ?? "없음"}) — 격리 스택 값으로 보입니다.`);
  const bad = [...text.matchAll(PORT_KEYS)].map((m) => Number(m[1])).filter((p) => !isSharedPort(p));
  if (bad.length) reasons.push(`공유 스택(544xx) 밖의 포트: ${[...new Set(bad)].join(", ")}`);
  if (!reasons.length) return { ok: true };
  if (env.ALLOW_CONFIG_TOML === "1" && (env.CONFIG_TOML_NOTE ?? "").trim().length >= 8) return { ok: true }; // 의도된 수정: 표식 + 작업 메모(8자 이상) 필수
  return { ok: false, reasons };
}
