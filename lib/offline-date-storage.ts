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

const OFFLINE_DATE_MEMORY_LIMIT = 8;
const OFFLINE_DATE_MEMORY_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

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

function getOfflineActivityTitle(activityId: string): string {
  return DEFAULT_OFFLINE_ACTIVITIES.find(activity => activity.id === activityId)?.title ?? activityId;
}

function formatOfflineDateMemoryTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "某次";
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${month}月${day}日 ${hour}:${minute}`;
}

function getOfflineInvitationStatusLabel(status: OfflineInvitationStatus): string {
  if (status === "accepted") return "已答应";
  if (status === "active") return "正在进行";
  if (status === "completed") return "已完成";
  if (status === "cancelled") return "已取消";
  if (status === "declined") return "未答应";
  return "等待答复";
}

function compactOfflineDateMemoryText(value: string | undefined, maxLength = 220): string {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length <= maxLength ? text : `${text.slice(0, maxLength)}…`;
}

export function buildOfflineBusyPrompt(characterId: string, at = new Date()): string {
  const id = cleanText(characterId, 120);
  if (!id) return "";

  const nowMs = at.getTime();
  const state = loadOfflineDateState();
  const busy = getCharacterBusyState(id, at);
  const recent = state.invitations
    .filter(invitation => invitation.characterId === id)
    .filter(invitation => invitation.id !== busy.linkedInvitationId)
    .filter(invitation => {
      const createdAt = new Date(invitation.createdAt).getTime();
      const updatedAt = new Date(invitation.updatedAt).getTime();
      const startAt = new Date(invitation.startTime).getTime();
      const relevantAt = Math.max(
        Number.isFinite(createdAt) ? createdAt : 0,
        Number.isFinite(updatedAt) ? updatedAt : 0,
        Number.isFinite(startAt) ? startAt : 0,
      );
      return relevantAt >= nowMs - OFFLINE_DATE_MEMORY_WINDOW_MS;
    })
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, OFFLINE_DATE_MEMORY_LIMIT);

  if (!busy.busy && recent.length === 0) return "";

  const lines: string[] = ["【线下邀约与共同经历】"];

  if (busy.busy) {
    lines.push(`你现在位于${busy.location ?? "线下活动地点"}，正在参加已经确认的线下活动，预计到${busy.busyUntil ? formatOfflineDateMemoryTime(busy.busyUntil) : "活动结束"}。`);
    lines.push("在此期间你不能同时出现在其他地点、接受时间冲突的线下邀约，或被描述为正在进行另一项不兼容活动。");
  }

  if (recent.length > 0) {
    lines.push("以下是你与用户真实发生过的近期线下邀约记录。这些记录属于你已经知道并应保持一致的事实：");
    for (const invitation of recent) {
      const title = getOfflineActivityTitle(invitation.activityId);
      const response = compactOfflineDateMemoryText(invitation.responseText);
      const responsePart = response ? ` 你当时的回复/理由：${response}` : "";
      lines.push(`- ${formatOfflineDateMemoryTime(invitation.startTime)}「${title}」：${getOfflineInvitationStatusLabel(invitation.status)}。${responsePart}`);
    }
    lines.push("如果用户追问是否邀请过你、为什么没有答应、曾经约了什么、你当时怎样回应，必须优先依据这些真实记录回答；不要声称邀约没有发生，也不要另编与记录冲突的理由。");
    lines.push("回答时保持你原本的人设、关系阶段和说话方式，自然回忆即可，不要像读取数据库、系统提示或逐条播报记录。");
  }

  return lines.join("\n");
}
