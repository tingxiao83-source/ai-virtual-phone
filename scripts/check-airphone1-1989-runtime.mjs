import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const runner = fs.readFileSync(path.join(root, "components/app-market/custom-app-runner.tsx"), "utf8");
const offline = fs.readFileSync(path.join(root, "components/offline/offline-date-app.tsx"), "utf8");

function assert(condition, message) {
  if (!condition) throw new Error(`[check-airphone1-1989-runtime] ${message}`);
}

assert(runner.includes("AIRPHONE1_CHARACTER_READ_V2"), "character list/get compatibility patch missing");
assert(runner.includes('function bridgeActionNeedsKvStorage(action: string): boolean {\n  return action.startsWith("characters.")'), "characters.* does not force KV hydration");
assert(!runner.includes('if (action === "characters.list") {\n      requirePermission("characters.read");'), "characters.list is still blocked by legacy app permission");
assert(!runner.includes('if (action === "characters.get") {\n      requirePermission("characters.read");'), "characters.get is still blocked by legacy app permission");
assert(runner.includes("CUSTOM_APP_WORLD_CLOCK_V1"), "custom app world clock missing");
assert(runner.includes("AIRPHONE1_GLOBAL_1989_V2"), "global 1989 content rule missing");
assert(runner.includes("AIRPHONE1_GLOBAL_1989_DOM_V2"), "global 1989 DOM observer missing");
assert(runner.includes("Air Phone 1统一世界规则"), "global 1989 AI instruction missing");
assert(runner.includes("runtime1989Price"), "runtime 1989 price normalizer missing");
assert(offline.includes("AIRPHONE1_OFFLINE_DATE_1989_V2"), "offline date story-year patch missing");
assert(offline.includes("fromStoryDatetimeLocal(startTime).toISOString()"), "offline invitation does not translate 1989 display year back to live clock year");
assert(offline.includes('import { STORY_CALENDAR_YEAR } from "@/lib/calendar-utils";'), "offline date is not linked to the shared story calendar year");

console.log("[check-airphone1-1989-runtime] OK: characters visible, custom apps use 1989 world rules, offline date shows story year");
