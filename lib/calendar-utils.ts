import type { CalendarColorKey, CalendarScheduleItem } from "./calendar-types";

const WEEKDAY_LABELS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"] as const;

/**
 * 故事日历固定在 1989 年，但月份、日期和当前时间仍跟随现实系统。
 * 例如现实 2026-09-21 15:30 -> 故事日历 1989-09-21 15:30。
 */
export const STORY_CALENDAR_YEAR = 1989;

/**
 * 仅把现实“今天”映射到故事年份，已经属于故事/历史日期的 Date 不改写。
 * 这样日历视图、星期、农历、日程存储和角色日程都会使用 1989 的真实日期关系，
 * 同时不会破坏对任意历史日期的普通日期运算。
 */
export function toStoryCalendarDate(date: Date): Date {
  const result = new Date(date);
  const now = new Date();

  const isRealToday =
    result.getFullYear() === now.getFullYear() &&
    result.getMonth() === now.getMonth() &&
    result.getDate() === now.getDate();

  if (!isRealToday) return result;

  const month = result.getMonth();
  const maxDay = new Date(STORY_CALENDAR_YEAR, month + 1, 0).getDate();
  const day = Math.min(result.getDate(), maxDay);

  result.setFullYear(STORY_CALENDAR_YEAR, month, day);
  return result;
}

/** 时间轴视图默认展示范围（仅影响显示，不再限制数据） */
export const CALENDAR_HOUR_START = 0;
export const CALENDAR_HOUR_END = 24;

export const CALENDAR_COLOR_KEYS: CalendarColorKey[] = [
  "blue",
  "green",
  "amber",
  "rose",
  "violet",
  "teal",
  "slate",
  "lilac",
];

export function isCalendarColorKey(value: unknown): value is CalendarColorKey {
  return typeof value === "string" && (CALENDAR_COLOR_KEYS as string[]).includes(value);
}

const EMOJI_SEQUENCE_RE = /\p{Extended_Pictographic}\uFE0F?(?:\u200D\p{Extended_Pictographic}\uFE0F?)*/u;

/** 事项 emoji：从输入中提取第一个 emoji 序列；没有 emoji 时返回空串。 */
export function sanitizeScheduleEmoji(value: unknown): string {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed || trimmed === "无") return "";
  const match = trimmed.match(EMOJI_SEQUENCE_RE);
  return match ? match[0] : "";
}

export function formatIsoDate(date: Date): string {
  const storyDate = toStoryCalendarDate(date);
  const year = storyDate.getFullYear();
  const month = String(storyDate.getMonth() + 1).padStart(2, "0");
  const day = String(storyDate.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseIsoDate(dateText: string): Date {
  return new Date(`${dateText}T00:00:00`);
}

export function startOfWeek(date: Date): Date {
  const storyDate = toStoryCalendarDate(date);
  const result = new Date(storyDate.getFullYear(), storyDate.getMonth(), storyDate.getDate());
  const day = result.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  result.setDate(result.getDate() + diff);
  result.setHours(0, 0, 0, 0);
  return result;
}

export function getWeekStartIso(date: Date): string {
  return formatIsoDate(startOfWeek(date));
}

export function getWeekDates(weekStart: string): string[] {
  const base = parseIsoDate(weekStart);
  return Array.from({ length: 7 }, (_, idx) => {
    const current = new Date(base);
    current.setDate(base.getDate() + idx);
    return formatIsoDate(current);
  });
}

export function getWeekdayLabel(dateOrIso: Date | string): string {
  const date = typeof dateOrIso === "string" ? parseIsoDate(dateOrIso) : dateOrIso;
  return WEEKDAY_LABELS[date.getDay()];
}

export function formatMonthDay(dateOrIso: Date | string): string {
  const date = typeof dateOrIso === "string" ? parseIsoDate(dateOrIso) : dateOrIso;
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

export function getMonthMatrix(anchorDate: string): string[][] {
  const focus = parseIsoDate(anchorDate);
  const firstDay = new Date(focus.getFullYear(), focus.getMonth(), 1);
  const gridStart = startOfWeek(firstDay);
  return Array.from({ length: 6 }, (_, weekIdx) =>
    Array.from({ length: 7 }, (_, dayIdx) => {
      const current = new Date(gridStart);
      current.setDate(gridStart.getDate() + weekIdx * 7 + dayIdx);
      return formatIsoDate(current);
    }),
  );
}

export function isSameMonth(dateA: string, dateB: string): boolean {
  return dateA.slice(0, 7) === dateB.slice(0, 7);
}

export function isDateInWeek(date: string, weekStart: string): boolean {
  return getWeekDates(weekStart).includes(date);
}

export function timeToMinutes(value: string): number {
  const match = value.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return NaN;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return NaN;
  return hours * 60 + minutes;
}

export function normalizeTime(value: string): string | null {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

/**
 * 时间段是否有效。历史版本曾把日程限制在 08:00-23:00 并在读取时静默丢弃越界数据；
 * 现已放开为全天可安排，只校验格式合法且开始早于结束。
 */
export function isCalendarTimeRangeAllowed(startTime: string, endTime: string): boolean {
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  return !Number.isNaN(start) && !Number.isNaN(end) && start < end;
}

export function pickScheduleColorKey(startTime: string): CalendarColorKey {
  const minutes = timeToMinutes(startTime);
  if (Number.isNaN(minutes)) return "slate";
  if (minutes < 9 * 60) return "teal";
  if (minutes < 12 * 60) return "blue";
  if (minutes < 15 * 60) return "green";
  if (minutes < 18 * 60) return "amber";
  if (minutes < 21 * 60) return "violet";
  return "rose";
}

export function sortScheduleItems(items: CalendarScheduleItem[]): CalendarScheduleItem[] {
  return [...items].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    if (a.startTime !== b.startTime) return a.startTime.localeCompare(b.startTime);
    if (a.endTime !== b.endTime) return a.endTime.localeCompare(b.endTime);
    return a.title.localeCompare(b.title);
  });
}

export function formatWeekRangeLabel(weekStart: string): string {
  const dates = getWeekDates(weekStart);
  const start = parseIsoDate(dates[0]);
  const end = parseIsoDate(dates[6]);
  return `${start.getMonth() + 1}月${start.getDate()}日 - ${end.getMonth() + 1}月${end.getDate()}日`;
}

export function getOwnerStorageKey(ownerType: string, ownerId: string): string {
  return `${ownerType}:${ownerId}`;
}
