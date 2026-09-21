"use client";

import { useEffect } from "react";

const STORY_YEAR = 1989;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const WEEKDAY_HEADS = ["日", "一", "二", "三", "四", "五", "六"] as const;

function syncCalendarWidget(root: HTMLElement): void {
  const storyToday = new Date();
  const year = STORY_YEAR;
  const month = storyToday.getMonth();
  const monthNum = month + 1;
  const day = storyToday.getDate();
  const firstDay = new Date(storyToday.getFullYear(), month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const weekday = WEEKDAYS[storyToday.getDay()];

  const ym = root.querySelector<HTMLElement>(".wg-calendar-ym");
  if (ym && ym.textContent !== `${year}年${monthNum}月`) {
    ym.textContent = `${year}年${monthNum}月`;
  }

  const eng = root.querySelector<HTMLElement>(".wg-calendar-eng");
  if (eng && eng.textContent !== `today is ${weekday}`) {
    eng.textContent = `today is ${weekday}`;
  }

  const grid = root.querySelector<HTMLElement>(".wg-calendar-grid");
  if (!grid) return;

  const signature = `${year}-${monthNum}-${day}-${firstDay}-${daysInMonth}`;
  if (grid.dataset.storyCalendarSignature === signature) return;

  const fragment = document.createDocumentFragment();
  WEEKDAY_HEADS.forEach((label) => {
    const span = document.createElement("span");
    span.className = "wg-cal-head";
    span.textContent = label;
    fragment.appendChild(span);
  });

  for (let index = 0; index < firstDay; index += 1) {
    fragment.appendChild(document.createElement("span"));
  }

  for (let value = 1; value <= daysInMonth; value += 1) {
    const span = document.createElement("span");
    span.className = value === day ? "wg-cal-day wg-cal-today" : "wg-cal-day";
    span.textContent = String(value);
    fragment.appendChild(span);
  }

  grid.replaceChildren(fragment);
  grid.dataset.storyCalendarSignature = signature;
}

function syncAllCalendarWidgets(): void {
  document.querySelectorAll<HTMLElement>(".wg-calendar").forEach(syncCalendarWidget);
}

export function StoryCalendarWidgetSync() {
  useEffect(() => {
    syncAllCalendarWidgets();

    let queued = false;
    const observer = new MutationObserver(() => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        syncAllCalendarWidgets();
      });
    });

    observer.observe(document.body, { childList: true, subtree: true });
    const timer = window.setInterval(syncAllCalendarWidgets, 60_000);

    return () => {
      observer.disconnect();
      window.clearInterval(timer);
    };
  }, []);

  return null;
}
