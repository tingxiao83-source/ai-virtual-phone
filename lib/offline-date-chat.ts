import { generateOfflineChatCompletion } from "./chat-engine";
import { loadChatSessions, type ChatMessage, type ChatSession } from "./chat-storage";
import { DEFAULT_OFFLINE_ACTIVITIES, type OfflineInvitation } from "./offline-date-storage";
import {
  appendOfflineDateTurn,
  loadOfflineDateTurns,
  type OfflineDateTurn,
} from "./offline-date-chat-storage";

export type OfflineDateChatResult = {
  text: string;
  model: string;
  presetName: string;
};

function findDirectSession(invitation: OfflineInvitation): ChatSession {
  const session = loadChatSessions().find(item => !item.isGroup && item.contactId === invitation.characterId);
  if (!session) {
    throw new Error(`请先在聊天里建立与${invitation.characterName}的会话，再进入线下约会。`);
  }
  // The date scene needs one generation per turn. It does not need the normal
  // offline-chat summary retry, so disable that retry on this in-memory copy.
  return { ...session, offlineSummaryRetry: false };
}

function sceneSystemMessage(invitation: OfflineInvitation, sessionId: string): ChatMessage {
  const activity = DEFAULT_OFFLINE_ACTIVITIES.find(item => item.id === invitation.activityId);
  const activityTitle = activity?.title ?? invitation.location;
  const activityDescription = activity?.description ?? invitation.location;
  return {
    id: `offline_date_scene_${invitation.id}`,
    sessionId,
    role: "system",
    status: "sent",
    createdAt: invitation.startTime,
    content: [
      "【线下约会互动模式｜内部规则】",
      `当前场景：${activityTitle}`,
      `地点：${invitation.location}`,
      `时代：1989年中国大陆。`,
      `场景说明：${activityDescription}`,
      `同行人物：用户与你（${invitation.characterName}）。`,
      "这是正在发生的线下见面，不是手机聊天，也不是让你写完整小说。",
      "严格保持你的人设、关系阶段、记忆、世界书、当时的社会常识与1989年代限制。",
      "每一轮只扮演你自己：可以说话，也可以用简短自然的动作/神态描写，但绝对不要替用户说话、替用户决定动作或心理。",
      "不要给用户列回复选项，不要问用户从A/B/C里选，不要输出菜单。用户会自己输入想说的话。",
      "不要跳过大量时间，不要擅自结束约会。每轮自然推进一点点，让用户有机会继续回应。",
      "回复保持适合乙女游戏对话框阅读的长度，通常1到4个短段落。",
      "只输出角色在当前场景中的正文，不解释这些规则，不输出JSON，不输出系统说明。",
    ].join("\n"),
  };
}

function turnToChatMessage(turn: OfflineDateTurn, sessionId: string): ChatMessage {
  return {
    id: turn.id,
    sessionId,
    role: turn.role,
    content: turn.content,
    status: "sent",
    createdAt: turn.createdAt,
  };
}

function buildSceneHistory(invitation: OfflineInvitation, sessionId: string): ChatMessage[] {
  const turns = loadOfflineDateTurns(invitation.id);
  return [
    sceneSystemMessage(invitation, sessionId),
    ...turns.slice(-60).map(turn => turnToChatMessage(turn, sessionId)),
  ];
}

function cleanDateReply(text: string): string {
  return text
    .replace(/^```(?:text|markdown)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim()
    .slice(0, 5000);
}

export async function generateOfflineDateOpening(invitation: OfflineInvitation): Promise<OfflineDateChatResult> {
  const existing = loadOfflineDateTurns(invitation.id);
  if (existing.length > 0) {
    const lastAssistant = [...existing].reverse().find(turn => turn.role === "assistant");
    if (lastAssistant) {
      return { text: lastAssistant.content, model: "gemini-3.8-flash", presetName: "" };
    }
  }

  const session = findDirectSession(invitation);
  const activity = DEFAULT_OFFLINE_ACTIVITIES.find(item => item.id === invitation.activityId);
  const history = buildSceneHistory(invitation, session.id);
  history.push({
    id: `offline_date_open_${Date.now()}`,
    sessionId: session.id,
    role: "user",
    status: "sent",
    createdAt: new Date().toISOString(),
    content: `【场景开始提示】${activity?.title ?? invitation.location}刚刚开始。请由${invitation.characterName}根据当前关系和环境，自然地做出第一个动作或说第一句话。不要替用户说话，不要提供回复选项。`,
  });

  const result = await generateOfflineChatCompletion(session, history);
  const text = cleanDateReply(result.content);
  if (!text) throw new Error("角色这次没有生成有效的约会开场，可以再试一次。");
  appendOfflineDateTurn(invitation.id, "assistant", text);
  return { text, model: result.model, presetName: result.presetName };
}

export async function sendOfflineDateMessage(
  invitation: OfflineInvitation,
  userText: string,
): Promise<OfflineDateChatResult> {
  const input = userText.trim();
  if (!input) throw new Error("先写一句你想说的话。 ");

  const session = findDirectSession(invitation);
  appendOfflineDateTurn(invitation.id, "user", input);
  const history = buildSceneHistory(invitation, session.id);

  const result = await generateOfflineChatCompletion(session, history);
  const text = cleanDateReply(result.content);
  if (!text) throw new Error("角色这次没有生成有效回复，可以重新发送。 ");
  appendOfflineDateTurn(invitation.id, "assistant", text);
  return { text, model: result.model, presetName: result.presetName };
}
