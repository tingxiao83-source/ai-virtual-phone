import fs from "node:fs";
import path from "node:path";

const widgetPath = path.join(process.cwd(), "components", "widgets", "widget-renderer.tsx");
let source = fs.readFileSync(widgetPath, "utf8");
const original = source;

const importMarker = 'import { DIYWidgetRenderer } from "@/components/widgets/diy-widget-renderer";\n';
const storyDateImport = 'import { STORY_CALENDAR_YEAR } from "@/lib/calendar-utils";\n';

if (!source.includes(storyDateImport)) {
  if (!source.includes(importMarker)) {
    throw new Error("[patch-story-calendar-widget-1989] import marker not found");
  }
  source = source.replace(importMarker, importMarker + storyDateImport);
}

const oldCalendarStart = `function CalendarWidget() {
  const now = new Date();
`;
const newCalendarStart = `function CalendarWidget() {
  const now = new Date();
  // story-calendar: real weekdays, fixed story year
`;

if (source.includes(newCalendarStart)) {
  // Already patched.
} else if (source.includes(oldCalendarStart)) {
  source = source.replace(oldCalendarStart, newCalendarStart);
} else if (!source.includes(newCalendarStart)) {
  throw new Error("[patch-story-calendar-widget-1989] CalendarWidget marker not found");
}

source = source.replace("const year = now.getFullYear();", "const year = STORY_CALENDAR_YEAR;");

source = source.replace("{new Date().getFullYear()}", "{STORY_CALENDAR_YEAR}");

if (source !== original) {
  fs.writeFileSync(widgetPath, source, "utf8");
  console.log("[patch-story-calendar-widget-1989] desktop calendar widget now follows the 1989 story calendar");
} else {
  console.log("[patch-story-calendar-widget-1989] desktop calendar widget already patched");
}
