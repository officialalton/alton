// 블라인드 풀이(2026-10-08): 지문·자료를 빼고 질문+선택지만 보여 주고 정답을 고르게 한다. 두 번째는 선택지 순서를 뒤집어 위치 편향을 뺀다.
// 확신이 high 이고 2회 모두 정답이면 정답 누설로 본다(분석·재작성 검증 공용).
export type BlindSample = { picked: number | null; confidence: string; reason: string };
export type BlindResult = { samples: [BlindSample, BlindSample]; hit: [boolean, boolean]; high: [boolean, boolean]; usage: { inTok: number; outTok: number } };
export type BlindClient = { messages: { create: (p: any) => Promise<{ content: { type: string; text?: string }[]; usage: { input_tokens: number; output_tokens: number } }> } };

const L = ["A", "B", "C", "D"];
export function blindPrompt(question: string, options: string[], order: number[]): string {
  const lines = order.map((oi, k) => `${L[k]}. ${options[oi]}`).join("\n");
  return `You are taking a digital SAT Reading & Writing question, but the passage / table / graph has been REMOVED. You see only the question stem and the four options. Pick the option you believe is correct using only what you can see (wording, structure, internal logic) and general knowledge.\n\nQuestion: ${question}\n\n${lines}\n\nReply with JSON only: {"pick":"A|B|C|D","confidence":"high|medium|low","reason":"<12 words"}. Use "high" only if the answer is determinable without the missing passage/data.`;
}
export function parseBlind(text: string, order: number[]): BlindSample {
  const j = JSON.parse(text.match(/\{[\s\S]*\}/)![0]);
  const k = L.indexOf(String(j.pick).trim().toUpperCase());
  return { picked: k >= 0 ? order[k] : null, confidence: String(j.confidence), reason: String(j.reason ?? "") };
}
export async function blindGuess(client: BlindClient, model: string, item: { question: string; options: string[]; correctIndex: number }): Promise<BlindResult> {
  const usage = { inTok: 0, outTok: 0 };
  const one = async (order: number[]): Promise<BlindSample> => {
    for (let a = 0; a < 3; a++) {
      try {
        const m = await client.messages.create({ model, max_tokens: 120, messages: [{ role: "user", content: blindPrompt(item.question, item.options, order) }] });
        usage.inTok += m.usage.input_tokens; usage.outTok += m.usage.output_tokens;
        return parseBlind(m.content.map((c) => (c.type === "text" ? c.text ?? "" : "")).join(""), order);
      } catch { await new Promise((r) => setTimeout(r, 2000 * (a + 1))); }
    }
    return { picked: null, confidence: "error", reason: "" };
  };
  const [s1, s2] = await Promise.all([one([0, 1, 2, 3]), one([3, 2, 1, 0])]);
  return { samples: [s1, s2], hit: [s1.picked === item.correctIndex, s2.picked === item.correctIndex], high: [s1.confidence === "high", s2.confidence === "high"], usage };
}
/** 정답 누설 확정: 2회 모두 정답 + 둘 다 high. */
export const blindLeaks = (r: Pick<BlindResult, "hit" | "high">) => r.hit[0] && r.hit[1] && r.high[0] && r.high[1];
