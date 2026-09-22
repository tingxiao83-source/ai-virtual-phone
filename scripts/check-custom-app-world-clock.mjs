import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const runnerPath = path.join(root, "components/app-market/custom-app-runner.tsx");
const source = fs.readFileSync(runnerPath, "utf8");

const marker = "// CUSTOM_APP_WORLD_CLOCK_V1";
const start = source.indexOf(marker);
if (start < 0) throw new Error("World clock patch marker is missing");
const clockStart = source.indexOf("(function installAiPhoneWorldClock(){", start);
const clockEndMarker = "  })();";
const clockEnd = source.indexOf(clockEndMarker, clockStart);
if (clockStart < 0 || clockEnd < 0) throw new Error("Unable to extract world clock bootstrap");

let bootstrap = source.slice(clockStart, clockEnd + clockEndMarker.length);
bootstrap = bootstrap.replace("${STORY_CALENDAR_YEAR}", "1989");

const testWindow = {
  Date,
  Intl: { DateTimeFormat: Intl.DateTimeFormat },
};

new Function("window", bootstrap)(testWindow);

const RealDate = Date;
const WorldDate = testWindow.Date;
const realNow = new RealDate();
const worldNow = new WorldDate();

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(worldNow.getFullYear() === 1989, `Expected story year 1989, got ${worldNow.getFullYear()}`);
assert(worldNow.getMonth() === realNow.getMonth(), "World clock changed the current month");
assert(worldNow.getDate() === realNow.getDate(), "World clock changed the current day of month");
assert(worldNow.getDay() === realNow.getDay(), "World clock changed the weekday");
assert(Math.abs(worldNow.getTime() - realNow.getTime()) < 5000, "World clock changed the underlying current timestamp");

const roundTrip = new WorldDate("1989-09-22T12:34:56");
assert(roundTrip.getFullYear() === 1989, "Story-year ISO strings do not round-trip");
assert(roundTrip.getMonth() === 8 && roundTrip.getDate() === 22, "Story-year parsing changed month/day");
assert(roundTrip.toISOString().startsWith("1989-09-22T"), `Unexpected story ISO output: ${roundTrip.toISOString()}`);

const formatter = new testWindow.Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "numeric", day: "numeric" });
const formatted = formatter.format(worldNow);
assert(formatted.includes("1989"), `Intl.DateTimeFormat leaked the device year: ${formatted}`);

const twoDigit = new WorldDate(1989, 8, 22, 12, 0, 0);
assert(twoDigit.getFullYear() === 1989 && twoDigit.getDay() === new RealDate(realNow.getFullYear(), 8, 22, 12, 0, 0).getDay(), "Numeric story-date construction is inconsistent");

assert(typeof testWindow.AiPhoneWorldClock?.now === "function", "AiPhoneWorldClock helper was not exposed");
console.log(`[check-custom-app-world-clock] OK: ${formatted}; weekday=${worldNow.getDay()}; time remains real-time`);
