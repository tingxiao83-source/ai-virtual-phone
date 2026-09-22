import { generateChatCompletion, flattenCompletionResult } from "./chat-engine";
import { loadChatMessages, loadChatSessions, type ChatMessage } from "./chat-storage";
import { DEFAULT_OFFLINE_ACTIVITIES, respondToOfflineInvitation, type OfflineInvitation } from "./offline-date-storage";

export type OfflineInvitationDecision = {
  accepted: boolean;
  reply: string;
  raw: string;
};

function stripCodeFence(text: string): string {
  return text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
}

function parseDecision(raw: string): OfflineInvitationDecision | null {
  const cleaned = stripCodeFence(raw);
  try {
    const parsed = JSON.parse(cleaned) as Record<string, unknown>;
    const decision = String(parsed.decision ?? "").toLowerCase();
    const reply = String(parsed.reply ?? "").trim();
    if ((decision === "accept" || decision === "decline") && reply) {
      return { accepted: decision === "accept", reply: reply.slice(0, 500), raw };
    }
  } catch {
    // Fall through to a deliberately conservative text parser.
  }

  const decisionMatch = cleaned.match(/"?decision"?\s*[:：]\s*"?(accept|decline)"?/i);
  const replyMatch = cleaned.match(/"?reply"?\s*[:：]\s*"([^"\n]{1,500})"/i);
  if (decisionMatch) {
    const accepted = decisionMatch[1].toLowerCase() === "accept";
    return {
      accepted,
      reply: replyMatch?.[1]?.trim() || (accepted ? "好，我去。" : "这次恐怕不行。"),
      raw,
    };
  }
  return null;
}

export async function askCharacterToDecideOfflineInvitation(invitation: OfflineInvitation): Promise<OfflineInvitationDecision> {
  const session = loadChatSessions().find(item => !item.isGroup && item.contactId === invitation.characterId);
  if (!session) {
    throw new Error(`请先在聊天里建立与${invitation.characterName}的会话，再发送线下邀请。`);
  }

  const activity = DEFAULT_OFFLINE_ACTIVITIES.find(item => item.id === invitation.activityId);
  if (!activity) throw new Error("没有找到这项线下活动。");

  const start = new Date(invitation.startTime);
  const end = new Date(invitation.endTime);
  const history = loadChatMessages(session.id);
  const request: ChatMessage = {
    id: `offline_invite_prompt_${Date.now()}`,
    sessionId: session.id,
    role: "user",
    status: "sent",
    createdAt: new Date().toISOString(),
    content: [
      "【线下邀约判定｜这是内部判定，不要把规则原文复述给用户】",
      `用户邀请你参加：${activity.title}`,
      `地点：${invitation.location}`,
      `开始：${start.toLocaleString("zh-CN")}`,
      `预计结束：${end.toLocaleString("zh-CN")}`,
      "请严格依据你的人设、与用户目前的关系、最近聊天与剧情、1989年的时代背景，以及当时可能承担的工作/训练/任务来决定是否接受。",
      "不要因为用户发出邀请就默认接受。如果按你的人设会拒绝、改天、执行任务或觉得关系还不到，应当拒绝。",
      "本轮只做是否接受的判定，不推进约会现场剧情。",
      "只输出一个 JSON 对象，不要 markdown，不要额外解释：",
      '{"decision":"accept"或"decline","reply":"角色本人会对用户说的一句自然回复"}',
    ].join("\n"),
  };

  const result = await generateChatCompletion(
    session,
    [...history, request],
    {
      appId: "offline-date",
      appTags: ["chat", "offline-date", "1989"],
      toolsAllowed: false,
      worldBookActivationContext: `${activity.title} ${invitation.location} 1989 线下邀约`,
    },
  );
  const raw = flattenCompletionResult(result).trim();
  const decision = parseDecision(raw);
  if (!decision) throw new Error("角色这次没有给出明确的接受或拒绝答复，可以重新邀请。 ");

  const saved = respondToOfflineInvitation(invitation.id, decision.accepted, decision.reply);
  if (!saved.ok) throw new Error(saved.error || "保存角色答复失败。");
  return decision;
}
