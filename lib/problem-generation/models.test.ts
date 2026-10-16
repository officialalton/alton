import { describe, it, expect, vi } from "vitest";
import { adaptParams, createToolMessage, isNewGenerationModel, generationModel, reviewModel, weakModel, DEFAULT_GENERATION_MODEL } from "./models";

const base = (model: string) => ({ model, max_tokens: 1000, tools: [{ name: "t", description: "d", input_schema: { type: "object", properties: {} } }], tool_choice: { type: "tool", name: "t" }, messages: [{ role: "user", content: "x" }] }) as never;
const toolMsg = { content: [{ type: "tool_use", name: "t", id: "1", input: {} }], stop_reason: "tool_use" };

describe("모델별 요청 옵션", () => {
  it("기본 생성·검수 모델은 sonnet-5-5, 약한 모델은 haiku 그대로, 환경변수로 덮어쓴다", () => {
    delete process.env.GENERATION_MODEL; delete process.env.REVIEW_MODEL; delete process.env.WEAK_MODEL;
    expect(generationModel()).toBe("claude-sonnet-5-5"); expect(reviewModel()).toBe("claude-sonnet-5-5"); expect(weakModel()).toBe("claude-haiku-4-5");
    process.env.GENERATION_MODEL = "claude-opus-5-5"; expect(generationModel()).toBe("claude-opus-5-5"); delete process.env.GENERATION_MODEL;
  });
  it("구모델은 params 를 그대로 둔다(tool_choice 강제 유지)", () => {
    const p = base("claude-sonnet-5");
    expect(isNewGenerationModel("claude-sonnet-5")).toBe(false);
    expect(adaptParams(p)).toBe(p);
  });
  it("Sonnet 5.5: tool_choice auto + between_tools + max_tokens 여유", () => {
    const a = adaptParams(base(DEFAULT_GENERATION_MODEL)) as unknown as Record<string, unknown>;
    expect(a.tool_choice).toEqual({ type: "auto" }); expect(a.thinking).toEqual({ type: "between_tools" }); expect(a.max_tokens).toBe(4000); expect(a.output_config).toEqual({ effort: "low" });
  });
  it("Opus·Fable: adaptive + effort low", () => {
    for (const m of ["claude-opus-5-5", "claude-fable-5-1"]) { const a = adaptParams(base(m)) as unknown as Record<string, unknown>; expect(a.thinking).toEqual({ type: "adaptive" }); expect(a.tool_choice).toEqual({ type: "auto" }); }
  });
});

describe("createToolMessage: tool_use 누락 처리", () => {
  it("첫 응답에 도구 호출이 있으면 그대로 돌려준다", async () => {
    const create = vi.fn().mockResolvedValue(toolMsg);
    expect(await createToolMessage({ messages: { create } } as never, base("claude-sonnet-5-5"))).toBe(toolMsg);
    expect(create).toHaveBeenCalledTimes(1);
  });
  it("누락되면 1회 재시도해 성공하면 통과", async () => {
    const create = vi.fn().mockResolvedValueOnce({ content: [{ type: "text", text: "no" }], stop_reason: "max_tokens" }).mockResolvedValueOnce(toolMsg);
    await createToolMessage({ messages: { create } } as never, base("claude-sonnet-5-5"));
    expect(create).toHaveBeenCalledTimes(2);
  });
  it("계속 누락되면 명확한 오류(조용한 실패 없음)", async () => {
    const create = vi.fn().mockResolvedValue({ content: [{ type: "thinking" }], stop_reason: "max_tokens" });
    await expect(createToolMessage({ messages: { create } } as never, base("claude-sonnet-5-5"))).rejects.toThrow(/호출을 반환하지 않았습니다.*max_tokens/);
    expect(create).toHaveBeenCalledTimes(2);
  });
  it("다른 이름의 도구만 있으면 누락으로 본다", async () => {
    const create = vi.fn().mockResolvedValue({ content: [{ type: "tool_use", name: "other", id: "1", input: {} }], stop_reason: "tool_use" });
    await expect(createToolMessage({ messages: { create } } as never, base("claude-sonnet-5-5"))).rejects.toThrow();
  });
});
