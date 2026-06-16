import { generateContent } from "./claude";
import { generateChatCompletion } from "./openai";

export type Persona = "strategist" | "critic" | "creative" | "judge";
export type Provider = "claude" | "openai";

export interface CouncilTurn {
  speaker: string;        // display name e.g. "Claude (Strategist)"
  provider: Provider;
  persona: Persona;
  content: string;
}

export interface CouncilResult {
  topic: string;
  turns: CouncilTurn[];   // full debate transcript
  synthesis: string;      // final answer
  synthesisBy: Provider;  // who synthesized
}

const PERSONA_SYSTEM: Record<Persona, string> = {
  strategist: "Bạn là chuyên gia chiến lược marketing cho spa Việt Nam. Đề xuất hướng đi rõ ràng, dựa trên dữ liệu, có cơ sở. Luôn ngắn gọn, tập trung vào lợi ích kinh doanh.",
  critic: "Bạn là người phản biện sắc bén. Tìm điểm yếu, rủi ro, hoặc giả định sai trong đề xuất. Đưa lựa chọn thay thế nếu có. Đừng phá hoại — phản biện xây dựng.",
  creative: "Bạn là chuyên gia sáng tạo content cho spa Việt Nam. Đề xuất ý tưởng độc đáo, cảm xúc, dễ viral. Hiểu insight phụ nữ Việt yêu làm đẹp.",
  judge: "Bạn là người tổng hợp khách quan. Đọc toàn bộ thảo luận, đưa ra QUYẾT ĐỊNH CUỐI CÙNG rõ ràng. Nêu lý do ngắn gọn cho mỗi điểm quyết định.",
};

const PROVIDER_LABEL: Record<Provider, string> = {
  claude: "Claude",
  openai: "GPT",
};

async function callAI(provider: Provider, prompt: string, system: string): Promise<string> {
  if (provider === "openai") return generateChatCompletion(prompt, system);
  return generateContent(prompt, system);
}

/**
 * Run a 2-round debate between Claude and OpenAI on a topic.
 * Round 1: Claude (strategist) → OpenAI (critic)
 * Round 2: Claude (responds to critique) → OpenAI (final position)
 * Then: Synthesizer (Claude by default) reads transcript → produces final decision.
 */
export async function councilDebate(opts: {
  topic: string;
  context: string;
  synthesizer?: Provider;
  priorContext?: string;       // optional CEO memory context to inject
}): Promise<CouncilResult> {
  const { topic, context, synthesizer = "claude", priorContext } = opts;

  const baseContext = `CHỦ ĐỀ: ${topic}\n\nBỐI CẢNH:\n${context}${priorContext ? `\n\n${priorContext}` : ""}`;
  const turns: CouncilTurn[] = [];

  // Round 1: Claude as Strategist
  const strategistPrompt = `${baseContext}\n\nHãy đưa ra đề xuất hoặc phân tích ban đầu. 3-5 câu, đi vào trọng tâm. Không lan man.`;
  let strategistOut = "";
  try {
    strategistOut = await callAI("claude", strategistPrompt, PERSONA_SYSTEM.strategist);
  } catch (e) {
    strategistOut = `(Claude lỗi: ${e instanceof Error ? e.message : "unknown"})`;
  }
  turns.push({ speaker: "Claude (Chiến lược gia)", provider: "claude", persona: "strategist", content: strategistOut });

  // Round 1: OpenAI as Critic
  const criticPrompt1 = `${baseContext}\n\nĐề xuất của chuyên gia chiến lược:\n"${strategistOut}"\n\nHãy phản biện ngắn (2-4 câu): điểm yếu, giả định đáng nghi, hoặc đưa lựa chọn thay thế nếu thấy cần.`;
  let criticOut1 = "";
  try {
    criticOut1 = await callAI("openai", criticPrompt1, PERSONA_SYSTEM.critic);
  } catch (e) {
    criticOut1 = `(GPT lỗi: ${e instanceof Error ? e.message : "unknown"} — bỏ qua phản biện vòng 1)`;
  }
  turns.push({ speaker: "GPT (Phản biện)", provider: "openai", persona: "critic", content: criticOut1 });

  // Round 2: Claude responds to critique
  const claudeReplyPrompt = `${baseContext}\n\nĐề xuất ban đầu của bạn:\n"${strategistOut}"\n\nPhản biện:\n"${criticOut1}"\n\nPhản hồi 2-3 câu: bạn đồng ý chỗ nào, không đồng ý chỗ nào, có điều chỉnh đề xuất ban đầu không?`;
  let claudeReply = "";
  try {
    claudeReply = await callAI("claude", claudeReplyPrompt, PERSONA_SYSTEM.strategist);
  } catch (e) {
    claudeReply = `(Claude lỗi vòng 2: ${e instanceof Error ? e.message : "unknown"})`;
  }
  turns.push({ speaker: "Claude (Phản hồi)", provider: "claude", persona: "strategist", content: claudeReply });

  // Round 2: OpenAI final position
  const openaiFinalPrompt = `${baseContext}\n\nCuộc tranh luận:\n[Claude]: ${strategistOut}\n[GPT phản biện]: ${criticOut1}\n[Claude phản hồi]: ${claudeReply}\n\nĐưa ý kiến cuối cùng của bạn 2 câu: bạn vẫn giữ nguyên phản biện hay đã thay đổi quan điểm sau khi Claude phản hồi?`;
  let openaiFinal = "";
  try {
    openaiFinal = await callAI("openai", openaiFinalPrompt, PERSONA_SYSTEM.critic);
  } catch (e) {
    openaiFinal = `(GPT lỗi vòng 2: ${e instanceof Error ? e.message : "unknown"})`;
  }
  turns.push({ speaker: "GPT (Ý kiến cuối)", provider: "openai", persona: "critic", content: openaiFinal });

  // Synthesizer reads transcript → final decision
  const transcript = turns.map((t) => `[${t.speaker}]: ${t.content}`).join("\n\n");
  const synthPrompt = `${baseContext}\n\nTOÀN BỘ THẢO LUẬN:\n${transcript}\n\nDựa vào cuộc thảo luận trên, đưa ra QUYẾT ĐỊNH/KẾT LUẬN CUỐI CÙNG. Format:
1. Quyết định: [1 câu rõ ràng]
2. Lý do: [2-3 câu dựa trên các điểm 2 bên đồng thuận]
3. Lưu ý/Rủi ro: [1 câu — điểm cần để ý sau này]`;

  let synthesis = "";
  try {
    synthesis = await callAI(synthesizer, synthPrompt, PERSONA_SYSTEM.judge);
  } catch (e) {
    // Fallback synth: combine both providers naively
    synthesis = `(Synthesizer lỗi: ${e instanceof Error ? e.message : "unknown"})\n\nTóm tắt thô:\n- ${strategistOut}\n- ${claudeReply}`;
  }

  return { topic, turns, synthesis, synthesisBy: synthesizer };
}

/**
 * Lightweight 1-round critique: Claude proposes, OpenAI critiques, Claude synthesizes.
 * Cheaper than full debate — use for low-stakes decisions.
 */
export async function quickCritique(opts: {
  topic: string;
  context: string;
  priorContext?: string;
}): Promise<CouncilResult> {
  const { topic, context, priorContext } = opts;
  const turns: CouncilTurn[] = [];

  const baseContext = `CHỦ ĐỀ: ${topic}\n\nBỐI CẢNH:\n${context}${priorContext ? `\n\n${priorContext}` : ""}`;

  let claudeOut = "";
  try {
    claudeOut = await callAI("claude", `${baseContext}\n\nĐưa đề xuất 3-5 câu.`, PERSONA_SYSTEM.strategist);
  } catch (e) {
    claudeOut = `(Claude lỗi: ${e instanceof Error ? e.message : "unknown"})`;
  }
  turns.push({ speaker: `${PROVIDER_LABEL.claude} (Đề xuất)`, provider: "claude", persona: "strategist", content: claudeOut });

  let gptOut = "";
  try {
    gptOut = await callAI("openai", `${baseContext}\n\nĐề xuất:\n"${claudeOut}"\n\nPhản biện 2-3 câu.`, PERSONA_SYSTEM.critic);
  } catch (e) {
    gptOut = `(GPT lỗi: ${e instanceof Error ? e.message : "unknown"})`;
  }
  turns.push({ speaker: `${PROVIDER_LABEL.openai} (Phản biện)`, provider: "openai", persona: "critic", content: gptOut });

  const synthPrompt = `${baseContext}\n\n[Đề xuất]: ${claudeOut}\n[Phản biện]: ${gptOut}\n\nTổng hợp quyết định cuối 2-3 câu.`;
  let synthesis = "";
  try {
    synthesis = await callAI("claude", synthPrompt, PERSONA_SYSTEM.judge);
  } catch (e) {
    synthesis = `(Synth lỗi: ${e instanceof Error ? e.message : "unknown"})`;
  }

  return { topic, turns, synthesis, synthesisBy: "claude" };
}
