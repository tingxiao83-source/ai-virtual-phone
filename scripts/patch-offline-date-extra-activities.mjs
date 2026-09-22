import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const file = path.join(root, "lib/offline-date-storage.ts");
let source = fs.readFileSync(file, "utf8");

if (source.includes("OFFLINE_DATE_EXTRA_ACTIVITIES_V1")) {
  console.log("[patch-offline-date-extra-activities] already applied");
  process.exit(0);
}

const anchor = "export const DEFAULT_OFFLINE_ACTIVITIES: OfflineActivity[] = [";
if (!source.includes(anchor)) throw new Error("Missing DEFAULT_OFFLINE_ACTIVITIES anchor");

const extra = `${anchor}\n  // OFFLINE_DATE_EXTRA_ACTIVITIES_V1: additional 1989 military-world date scenes.\n  {\n    id: \"officer-dormitory-1989\",\n    title: \"军官宿舍坐坐\",\n    description: \"在简单整洁的军官宿舍里坐一会儿。木桌、搪瓷缸、折好的被褥和旧式台灯都保持1989年的生活质感。\",\n    location: \"军官宿舍\",\n    durationMinutes: 90,\n    timeTag: \"all-day\",\n    era: \"1989\",\n    sceneEmoji: \"🪖\",\n    sceneLabel: \"木桌 · 搪瓷缸 · 营房\",\n  },\n  {\n    id: \"regiment-office-1989\",\n    title: \"团部办公室\",\n    description: \"在团部办公室等他忙完手头的事，看看地图、文件柜和旧式电话，在工作间隙说几句话。\",\n    location: \"团部办公室\",\n    durationMinutes: 75,\n    timeTag: \"day\",\n    era: \"1989\",\n    sceneEmoji: \"🗺️\",\n    sceneLabel: \"地图 · 文件柜 · 旧式电话\",\n  },\n  {\n    id: \"night-patrol-1989\",\n    title: \"陪他夜巡\",\n    description: \"夜里沿营区道路慢慢走一段。哨位、昏黄路灯、树影和远处营房安静得只剩脚步声。\",\n    location: \"营区夜巡路线\",\n    durationMinutes: 90,\n    timeTag: \"night\",\n    era: \"1989\",\n    sceneEmoji: \"🌙\",\n    sceneLabel: \"哨位 · 路灯 · 夜色\",\n  },\n  {\n    id: \"paratrooper-training-ground-1989\",\n    title: \"训练场边走走\",\n    description: \"训练结束后沿空降兵训练场边走走。跑道、单双杠、器材和远处口令声都属于那个年代的军营。\",\n    location: \"空降兵训练场\",\n    durationMinutes: 120,\n    timeTag: \"day\",\n    era: \"1989\",\n    sceneEmoji: \"🪂\",\n    sceneLabel: \"跑道 · 器材 · 营区\",\n  },`;

source = source.replace(anchor, extra);
fs.writeFileSync(file, source, "utf8");
console.log("[patch-offline-date-extra-activities] added 4 military date activities");
