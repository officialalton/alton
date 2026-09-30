// 문제 생성·검수 모델 설정과 모델별 요청 옵션(2026-09-30). 환경변수로 덮어쓸 수 있다.
//   GENERATION_MODEL: 문항 생성·재생성·자료·수선 호출, REVIEW_MODEL: 독립 채점, WEAK_MODEL: 약한 모델 풀이(실험용, 기본 그대로)
// 기본 생성·검수 모델은 claude-sonnet-5-5. 신모델(sonnet-5-5·opus-5-5·fable)은 tool_choice 강제(type:"tool"/"any")를 지원하지 않고
// 사고(thinking)를 끌 수 없으며 사고 토큰이 max_tokens 를 같이 쓴다 — 그래서 호출 옵션을 createToolMessage 한 곳에서 모델별로 정한다.
import type Anthropic from "@anthropic-ai/sdk";

export const DEFAULT_GENERATION_MODEL = "claude-sonnet-5-5";
export const DEFAULT_REVIEW_MODEL = "claude-sonnet-5-5";
export const DEFAULT_WEAK_MODEL = "claude-haiku-4-5";
export const generationModel = () => process.env.GENERATION_MODEL?.trim() || DEFAULT_GENERATION_MODEL;
export const reviewModel = () => process.env.REVIEW_MODEL?.trim() || DEFAULT_REVIEW_MODEL;
export const weakModel = () => process.env.WEAK_MODEL?.trim() || DEFAULT_WEAK_MODEL;

/** 신모델: tool_choice 강제 불가 + thinking 필수. 구모델(예: claude-sonnet-5, haiku-4-5)은 기존 그대로. */
export const isNewGenerationModel = (model: string) => /^claude-(sonnet-5-5|opus-5|fable)/.test(model);
/** 사고 토큰이 max_tokens 를 같이 쓰므로 신모델은 여유를 더한다. */
export const THINKING_HEADROOM = 3000;

type Params = Anthropic.MessageCreateParamsNonStreaming;
/** 모델별 요청 옵션을 적용한 새 params 를 돌려준다(입력은 바꾸지 않는다). 구모델은 그대로. */
export function adaptParams(params: Params): Params {
  if (!isNewGenerationModel(params.model)) return params;
  const next: Record<string, unknown> = { ...params, max_tokens: params.max_tokens + THINKING_HEADROOM };
  // 강제 도구 선택은 자동 선택으로 — 프롬프트는 각 호출부가 이미 도구 호출을 요구하고, 누락은 createToolMessage 가 오류로 처리한다.
  const tc = params.tool_choice as { type?: string } | undefined;
  if (tc && (tc.type === "tool" || tc.type === "any")) next.tool_choice = { type: "auto" };
  next.thinking = params.model.startsWith("claude-sonnet") ? { type: "between_tools" } : { type: "adaptive" };
  next.output_config = { effort: "low" };
  return next as unknown as Params;
}

/**
 * 도구 호출 전용 messages.create. 신모델 옵션을 적용하고, 기대한 tool_use 블록이 없으면(도구 호출 안 함·토큰 부족으로 잘림) 1회 재시도 후
 * 명확한 오류를 던진다 — 조용한 실패 금지. 호출부가 하던 기존 검사(응답 형식 등)는 그대로 그 뒤에서 동작한다.
 */
export async function createToolMessage(client: Pick<Anthropic, "messages">, params: Params, attempts = 2): Promise<Anthropic.Message> {
  const expected = (params.tool_choice as { type?: string; name?: string } | undefined)?.name ?? (params.tools?.[0] as { name?: string } | undefined)?.name;
  let last = "";
  for (let i = 0; i < attempts; i++) {
    const message = await client.messages.create(adaptParams(params));
    const hasTool = message.content.some((c) => c.type === "tool_use" && (!expected || c.name === expected));
    if (hasTool) return message;
    last = `stop_reason=${message.stop_reason}`;
  }
  throw new Error(`모델(${params.model})이 기대한 도구(${expected ?? "?"}) 호출을 반환하지 않았습니다(${last}). max_tokens 부족 또는 도구 호출 거부일 수 있습니다.`);
}
