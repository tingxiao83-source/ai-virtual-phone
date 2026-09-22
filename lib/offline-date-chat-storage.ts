import { kvGet, kvSet, registerKvMigration } from "./kv-db";
import {
  DEFAULT_OFFLINE_ACTIVITIES,
  loadOfflineDateState,
  saveOfflineDateState,
  type OfflineInvitation,
} from "./offline-date-storage";

const OFFLINE_DATE_CHAT_KEY = "ai_phone_offline_date_chat_v1";
registerKvMigration(OFFLINE_DATE_CHAT_KEY);

export type OfflineDateTurnRole = "user" | "assistant";

export type OfflineDateTurn = {
  id: string;
  invitationId: string;
  role: OfflineDateTurnRole;
  content: string;
  createdAt: string;
};

type OfflineDateChatState = {
  turns: OfflineDateTurn[];
  updatedAt: string;
};

function cleanText(value: unknown, maxLength: number): string {
  return String(value ?? "").replace(/\u0000/g, "").trim().slice(0, maxLength);
}

function normalizeTurn(value: unknown): OfflineDateTurn | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const id = cleanText(record.id, 140);
  const invitationId = cleanText(record.invitationId, 140);
  const role = record.role === "assistant" ? "assistant" : record.role === "user" ? "user" : null;
  const content = cleanText(record.content, 8000);
  const createdAtRaw = cleanText(record.createdAt, 80);
  const createdAtDate = new Date(createdAtRaw);
  const createdAt = createdAtRaw && !Number.isNaN(createdAtDate.getTime())
    ? createdAtDate.toISOString()
    : new Date().toISOString();
  if (!id || !invitationId || !role || !content) return null;
  return { id, invitationId, role, content, createdAt };
}

function loadState(): OfflineDateChatState {
  if (typeof window === "undefined") return { turns: [], updatedAt: new Date().toISOString() };
  try {
    const raw = kvGet(OFFLINE_DATE_CHAT_KEY);
    if (!raw) return { turns: [], updatedAt: new Date().toISOString() };
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const turns = (Array.isArray(parsed.turns) ? parsed.turns : [])
      .map(normalizeTurn)
      .filter((item): item is OfflineDateTurn => Boolean(item))
      .slice(-1200);
    return {
      turns,
      updatedAt: cleanText(parsed.updatedAt, 80) || new Date().toISOString(),
    };
  } catch {
    return { turns: [], updatedAt: new Date().toISOString() };
  }
}

function saveState(state: OfflineDateChatState): OfflineDateChatState {
  const next = {
    turns: state.turns.slice(-1200),
    updatedAt: new Date().toISOString(),
  };
  kvSet(OFFLINE_DATE_CHAT_KEY, JSON.stringify(next));
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("offline-date-chat-updated", { detail: next }));
  }
  return next;
}

export function loadOfflineDateTurns(invitationId: string): OfflineDateTurn[] {
  return loadState().turns.filter(turn => turn.invitationId === invitationId);
}

export function appendOfflineDateTurn(
  invitationId: string,
  role: OfflineDateTurnRole,
  content: string,
): OfflineDateTurn {
  const text = cleanText(content, 8000);
  if (!text) throw new Error("不能保存空白约会对话。");
  const turn: OfflineDateTurn = {
    id: `offline_date_turn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    invitationId,
    role,
    content: text,
    createdAt: new Date().toISOString(),
  };
  const state = loadState();
  saveState({ ...state, turns: [...state.turns, turn] });
  return turn;
}

export function startOfflineDateNow(invitationId: string): { ok: boolean; invitation?: OfflineInvitation; error?: string } {
  const state = loadOfflineDateState();
  const target = state.invitations.find(item => item.id === invitationId);
  if (!target) return { ok: false, error: "没有找到这次约会。" };
  if (target.status === "pending") return { ok: false, error: "对方还没有答应这次邀约。" };
  if (target.status === "declined") return { ok: false, error: "这次邀约已经被拒绝。" };
  if (target.status === "cancelled") return { ok: false, error: "这次约会已经取消。" };
  if (target.status === "completed") return { ok: true, invitation: target };
  if (target.status === "active") return { ok: true, invitation: target };

  const activity = DEFAULT_OFFLINE_ACTIVITIES.find(item => item.id === target.activityId);
  if (!activity) return { ok: false, error: "没有找到这项线下活动。" };

  const now = new Date();
  const end = new Date(now.getTime() + activity.durationMinutes * 60_000);
  const conflict = state.invitations.find(item => {
    if (item.id === target.id || item.characterId !== target.characterId) return false;
    if (item.status !== "accepted" && item.status !== "active") return false;
    const otherStart = new Date(item.startTime).getTime();
    const otherEnd = new Date(item.endTime).getTime();
    return now.getTime() < otherEnd && otherStart < end.getTime();
  });
  if (conflict) return { ok: false, error: `${target.characterName} 现在已经有其他线下安排：${conflict.location}。` };

  const invitation: OfflineInvitation = {
    ...target,
    startTime: now.toISOString(),
    endTime: end.toISOString(),
    status: "active",
    updatedAt: now.toISOString(),
  };
  saveOfflineDateState({
    ...state,
    invitations: state.invitations.map(item => item.id === target.id ? invitation : item),
  });
  return { ok: true, invitation };
}

export function endOfflineDateNow(invitationId: string): { ok: boolean; invitation?: OfflineInvitation; error?: string } {
  const state = loadOfflineDateState();
  const target = state.invitations.find(item => item.id === invitationId);
  if (!target) return { ok: false, error: "没有找到这次约会。" };
  const now = new Date().toISOString();
  const invitation: OfflineInvitation = {
    ...target,
    endTime: now,
    status: "completed",
    updatedAt: now,
  };
  saveOfflineDateState({
    ...state,
    invitations: state.invitations.map(item => item.id === target.id ? invitation : item),
  });
  return { ok: true, invitation };
}
