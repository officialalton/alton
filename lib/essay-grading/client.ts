import { createToolMessage, generationModel, isNewGenerationModel } from "@/lib/problem-generation/models";
import { flagEnabled } from "./costs";
import { GRADER_TOOL } from "./schema";

// 주입 가능한 LLM 클라이언트. 테스트는 항상 가짜를 주입한다 — 실제 구현(createAnthropicGraderClient)은 테스트에서 호출 금지.
export type GraderRequest = { system: string; user: string; maxOutputTokens: number; model?: string };
export type GraderResponse = { output: unknown; inputTokens: number; outputTokens: number; model: string };
export interface GraderClient { grade(req: GraderRequest): Promise<GraderResponse> }

export class GraderRefusal extends Error { constructor(public code: "flag_off" | "no_key") { super(code); } }

/** 실제 Anthropic 구현. 호출 시점에 플래그와 키를 읽고, 꺼져 있거나 키가 없으면 네트워크 호출 전에 거부한다. */
export function createAnthropicGraderClient(): GraderClient {
  return {
    async grade(req) {
      if (!flagEnabled()) throw new GraderRefusal("flag_off");
      const key = process.env.ANTHROPIC_API_KEY?.trim();
      if (!key) throw new GraderRefusal("no_key");
      const { default: Anthropic } = await import("@anthropic-ai/sdk");
      const client = new Anthropic({ apiKey: key });
      const model = req.model ?? process.env.AI_ESSAY_MODEL?.trim() ?? generationModel();
      // 신모델은 사고를 끌 수 없고 temperature 조정이 안 된다(models.ts) — 구모델일 때만 낮은 temperature.
      const params = { model, max_tokens: req.maxOutputTokens, system: req.system, messages: [{ role: "user" as const, content: req.user }], tools: [GRADER_TOOL], tool_choice: { type: "tool" as const, name: GRADER_TOOL.name }, ...(isNewGenerationModel(model) ? {} : { temperature: 0.1 }) };
      const msg = await createToolMessage(client, params);
      const tool = msg.content.find((c) => c.type === "tool_use");
      return { output: tool && tool.type === "tool_use" ? tool.input : null, inputTokens: msg.usage.input_tokens, outputTokens: msg.usage.output_tokens, model };
    },
  };
}
