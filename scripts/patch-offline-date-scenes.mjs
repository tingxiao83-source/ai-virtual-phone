import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const file = path.join(root, "components/offline/offline-date-app.tsx");
let source = fs.readFileSync(file, "utf8");

if (source.includes("OFFLINE_DATE_SCENES_V2")) {
  console.log("[patch-offline-date-scenes] already applied");
  process.exit(0);
}

const pattern = /function offlineDateSceneArt\(activityId: string\): Record<string, string> \{[\s\S]*?\n\}\n\nfunction offlineDateCharacterSprite/;
if (!pattern.test(source)) {
  throw new Error("Missing offlineDateSceneArt function. Run patch-offline-date-art first.");
}

const replacement = `// OFFLINE_DATE_SCENES_V2: lightweight real backgrounds for all built-in 1989 dates.\nfunction offlineDateSceneArt(activityId: string): Record<string, string> {\n  const files: Record<string, string> = {\n    \"town-market-1989\": \"/offline-date/market.webp\",\n    \"open-air-cinema-1989\": \"/offline-date/cinema.webp\",\n    \"camping-1989\": \"/offline-date/camping.webp\",\n    \"xinhua-bookstore-1989\": \"/offline-date/bookstore.webp\",\n    \"state-restaurant-1989\": \"/offline-date/restaurant.webp\",\n  };\n  const image = files[activityId];\n  if (!image) return {};\n  return {\n    backgroundImage: \"url(\" + image + \")\",\n    backgroundSize: \"cover\",\n    backgroundPosition: \"center center\",\n    backgroundRepeat: \"no-repeat\",\n  };\n}\n\nfunction offlineDateCharacterSprite`;

source = source.replace(pattern, replacement);
fs.writeFileSync(file, source, "utf8");
console.log("[patch-offline-date-scenes] applied all 5 date backgrounds");
