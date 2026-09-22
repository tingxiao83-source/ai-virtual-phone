import { kvGet, kvSet, registerKvMigration } from "./kv-db";

const OFFLINE_DATE_STATE_KEY = "ai_phone_offline_date_state_v1";

registerKvMigration(OFFLINE_DATE_STATE_KEY);

export type OfflineActivityTimeTag = "day" | "night" | "all-day";
export type OfflineInvitationStatus = "pending" | "accepted" | "active" | "completed" | "cancelled" | "declined";
export type CharacterBusyReason = "offline_date" | "work" | "sleep" | "story_event";

export type OfflineActivity = {
  id: string;
  title: string;
  description: string;
  location: string;
  durationMinutes: number;
  timeTag: OfflineActivityTimeTag;
  era: "1989";
  sceneEmoji: string;
  sceneLabel: string;
};

export type OfflineInvitation = {
  id: string;
  activityId: string;
  characterId: string;
  characterName: string;
  startTime: string;
  endTime: string;
  location: string;
  status: OfflineInvitationStatus;
  responseText?: string;
  createdAt: string;
  updatedAt: string;
};

export type CharacterBusyState = {
  characterId: string;
  busy: boolean;
  busyReason?: CharacterBusyReason;
  busyUntil?: string;
  location?: string;
  linkedInvitationId?: string;
};

export type OfflineDateState = {
  invitations: OfflineInvitation[];
  updatedAt: string;
};

export const OFFLINE_DATE_UPDATED_EVENT = "offline-date-state-updated";

export const DEFAULT_OFFLINE_ACTIVITIES: OfflineActivity[] = [
  {
    id: "town-market-1989",
    title: "镇上赶集",
    description: "沿着镇里的集市慢慢逛。布匹、搪瓷用品、蔬果、小吃和零碎日用品挤在街边摊位上。",
    location: "镇集市",
    durationMinutes: 180,
    timeTag: "day",
    era: "1989",
    sceneEmoji: "🧺",
    sceneLabel: "集市 · 自行车 · 老街摊位",
  },
  {
    id: "open-air-cinema-1989",
    title: "露天电影院",
    description: "天黑后坐在露天放映场看电影。白幕布、木凳、瓜子和放映机声都属于那个年代。",
    location: "露天放映场",
    durationMinutes: 150,
    timeTag: "night",
    era: "1989",
    sceneEmoji: "🎞️",
    sceneLabel: "白幕布 · 木凳 · 夏夜",
  },
  {
    id: "camping-1989",
    title: "郊外野营",
    description: "带着军用水壶、搪瓷杯和简单吃食去河边或林边待上一阵，不使用现代露营装备。",
    location: "郊外河边",
    durationMinutes: 300,
    timeTag: "all-day",
    era: "1989",
    sceneEmoji: "⛺",
    sceneLabel: "河滩 · 树林 · 搪瓷杯",
  },
  {
    id: "xinhua-bookstore-1989",
    title: "逛新华书店",
    description: "在木质书架和玻璃柜台之间翻书、看杂志、挑文具，安静地消磨一段时间。",
    location: "新华书店",
    durationMinutes: 90,
    timeTag: "day",
    era: "1989",
    sceneEmoji: "📚",
    sceneLabel: "书架 · 玻璃柜台 · 纸张味",
  },
  {
    id: "state-restaurant-1989",
    title: "国营饭店吃饭",
    description: "找张木桌坐下，看看墙上的菜单牌，吃一顿符合当地供应和1989年物价的饭。",
    location: "国营饭店",
    durationMinutes: 90,
    timeTag: "all-day",
    era: "1989",
    sceneEmoji: "🥟",
    sceneLabel: "木桌 · 菜单牌 · 搪瓷盘",
  },
];

function cleanText(value: unknown, maxLength: number): string {
  return String(value ?? "").replace(/\u0000/g, "").trim().slice(0, maxLength);
}

function parseIso(value: unknown): string | null {
  const text = cleanText(value, 80);
  const time = new Date(text);
  return text && !Number.isNaN(time.getTime()) ? time.toISOString() : null;
}

function normalizeInvitation(value: unknown): OfflineInvitation | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const id = cleanText(record.id, 140);
  const activityId = cleanText(record.activityId, 120);
  const characterId = cleanText(record.characterId, 120);
  const characterName = cleanText(record.characterName, 120);
  const location = cleanText(record.location, 160);
  const startTime = parseIso(record.startTime);
  const endTime = parseIso(record.endTime);
  const rawStatus = cleanText(record.status, 40);
  const status: OfflineInvitationStatus = rawStatus === "pending" || rawStatus === "accepted" || rawStatus === "active" || rawStatus === "completed" || rawStatus === "cancelled" || rawStatus === "declined"
    ? rawStatus
    : "pending";
  if (!id || !activityId || !characterId || !characterName || !location || !startTime || !endTime) return null;
  return {
    id,
    activityId,
    characterId,
    characterName,
    startTime,
    endTime,
    location,
    status,
    responseText: cleanText(record.responseText, 600) || undefined,
    createdAt: parseIso(record.createdAt) ?? new Date().toISOString(),
    updatedAt: parseIso(record.updatedAt) ?? new Date().toISOString(),
  };
}

function syncInvitationStatus(invitation: OfflineInvitation, nowMs: number): OfflineInvitation {
  if (invitation.status === "cancelled" || invitation.status === "declined" || invitation.status === "completed" || invitation.status === "pending") {
    return invitation;
  }
  const start = new Date(invitation.startTime).getTime();
  const end = new Date(invitation.endTime).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return invitation;
  if (nowMs >= end) return { ...invitation, status: "completed", updatedAt: new Date(nowMs).toISOString() };
  if (nowMs >= start && nowMs < end) return invitation.status === "active" ? invitation : { ...invitation, status: "active", updatedAt: new Date(nowMs).toISOString() };
  return invitation.status === "accepted" ? invitation : { ...invitation, status: "accepted", updatedAt: new Date(nowMs).toISOString() };
}

export function createDefaultOfflineDateState(): OfflineDateState {
  return { invitations: [], updatedAt: new Date().toISOString() };
}

export function loadOfflineDateState(): OfflineDateState {
  if (typeof window === "undefined") return createDefaultOfflineDateState();
  try {
    const raw = kvGet(OFFLINE_DATE_STATE_KEY);
    if (!raw) return createDefaultOfflineDateState();
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const nowMs = Date.now();
    const invitations = (Array.isArray(parsed.invitations) ? parsed.invitations : [])
      .map(normalizeInvitation)
      .filter((item): item is OfflineInvitation => Boolean(item))
      .map(item => syncInvitationStatus(item, nowMs))
      .slice(0, 120);
    const state = {
      invitations,
      updatedAt: parseIso(parsed.updatedAt) ?? new Date().toISOString(),
    };
    const normalizedRaw = JSON.stringify(state);
    if (normalizedRaw !== raw) kvSet(OFFLINE_DATE_STATE_KEY, normalizedRaw);
    return state;
  } catch {
    return createDefaultOfflineDateState();
  }
}

export function saveOfflineDateState(state: OfflineDateState): OfflineDateState {
  const next = { ...state, invitations: state.invitations.slice(0, 120), updatedAt: new Date().toISOString() };
  kvSet(OFFLINE_DATE_STATE_KEY, JSON.stringify(next));
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(OFFLINE_DATE_UPDATED_EVENT, { detail: next }));
  return next;
}

function overlaps(startA: number, endA: number, startB: number, endB: number): boolean {
  return startA < endB && startB < endA;
}

export function getCharacterBusyState(characterId: string, at = new Date()): CharacterBusyState {
  const state = loadOfflineDateState();
  const atMs = at.getTime();
  const active = state.invitations.find(invitation => {
    if (invitation.characterId !== characterId) return false;
    if (invitation.status !== "accepted" && invitation.status !== "active") return false;
    const start = new Date(invitation.startTime).getTime();
    const end = new Date(invitation.endTime).getTime();
    return atMs >= start && atMs < end;
  });
  if (!active) return { characterId, busy: false };
  return {
    characterId,
    busy: true,
    busyReason: "offline_date",
    busyUntil: active.endTime,
    location: active.location,
    linkedInvitationId: active.id,
  };
}

export function hasCharacterScheduleConflict(characterId: string, startTime: string, endTime: string, excludeInvitationId?: string): OfflineInvitation | null {
  const start = new Date(startTime).getTime();
  const end = new Date(endTime).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  return loadOfflineDateState().invitations.find(invitation => {
    if (invitation.characterId !== characterId || invitation.id === excludeInvitationId) return false;
    if (invitation.status !== "accepted" && invitation.status !== "active") return false;
    return overlaps(start, end, new Date(invitation.startTime).getTime(), new Date(invitation.endTime).getTime());
  }) ?? null;
}

export function createOfflineInvitation(input: {
  activityId: string;
  characterId: string;
  characterName: string;
  startTime: string;
}): { ok: boolean; invitation?: OfflineInvitation; error?: string } {
  const activity = DEFAULT_OFFLINE_ACTIVITIES.find(item => item.id === input.activityId);
  if (!activity) return { ok: false, error: "没有找到这个线下活动。" };
  const start = new Date(input.startTime);
  if (Number.isNaN(start.getTime())) return { ok: false, error: "请选择有效的开始时间。" };
  const end = new Date(start.getTime() + activity.durationMinutes * 60_000);
  const conflict = hasCharacterScheduleConflict(input.characterId, start.toISOString(), end.toISOString());
  if (conflict) return { ok: false, error: `${input.characterName} 在这段时间已经有安排：${conflict.location}。` };
  const now = new Date().toISOString();
  const invitation: OfflineInvitation = {
    id: `offline_date_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    activityId: activity.id,
    characterId: cleanText(input.characterId, 120),
    characterName: cleanText(input.characterName, 120),
    startTime: start.toISOString(),
    endTime: end.toISOString(),
    location: activity.location,
    status: "pending",
    createdAt: now,
    updatedAt: now,
  };
  const state = loadOfflineDateState();
  saveOfflineDateState({ ...state, invitations: [invitation, ...state.invitations] });
  return { ok: true, invitation };
}

export function respondToOfflineInvitation(invitationId: string, accepted: boolean, responseText?: string): { ok: boolean; invitation?: OfflineInvitation; error?: string } {
  const state = loadOfflineDateState();
  const target = state.invitations.find(item => item.id === invitationId);
  if (!target) return { ok: false, error: "这条邀请已经不存在。" };
  if (accepted) {
    const conflict = hasCharacterScheduleConflict(target.characterId, target.startTime, target.endTime, target.id);
    if (conflict) return { ok: false, error: `${target.characterName} 在这段时间已经有其他安排。` };
  }
  const nowMs = Date.now();
  const startMs = new Date(target.startTime).getTime();
  const endMs = new Date(target.endTime).getTime();
  let status: OfflineInvitationStatus = accepted ? "accepted" : "declined";
  if (accepted && nowMs >= startMs && nowMs < endMs) status = "active";
  if (accepted && nowMs >= endMs) status = "completed";
  const nextInvitation: OfflineInvitation = {
    ...target,
    status,
    responseText: cleanText(responseText, 600) || (accepted ? "好，到时候见。" : "这次恐怕不行。"),
    updatedAt: new Date().toISOString(),
  };
  saveOfflineDateState({
    ...state,
    invitations: state.invitations.map(item => item.id === invitationId ? nextInvitation : item),
  });
  return { ok: true, invitation: nextInvitation };
}

export function cancelOfflineInvitation(invitationId: string): OfflineDateState {
  const state = loadOfflineDateState();
  return saveOfflineDateState({
    ...state,
    invitations: state.invitations.map(item => item.id === invitationId
      ? { ...item, status: "cancelled" as const, updatedAt: new Date().toISOString() }
      : item),
  });
}

export function buildOfflineBusyPrompt(characterId: string, at = new Date()): string {
  const busy = getCharacterBusyState(characterId, at);
  if (!busy.busy) return "";
  return `【当前线下状态】你现在位于${busy.location ?? "线下活动地点"}，正在参加已经确认的线下活动，预计到${busy.busyUntil ?? "活动结束"}。在此期间你不能同时出现在其他地点、接受时间冲突的线下邀约，或被描述为正在进行另一项不兼容活动。`;
}
