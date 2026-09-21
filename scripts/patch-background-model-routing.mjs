import fs from "node:fs";
import path from "node:path";

const filePath = path.join(process.cwd(), "lib", "chat-engine.ts");
let source = fs.readFileSync(filePath, "utf8");

const marker = "// __XHS_BACKGROUND_MODEL_FORCE__";
if (source.includes(marker)) {
  console.log("[patch-background-model-routing] already applied");
  process.exit(0);
}

const functionStart = source.indexOf("export async function sendLLMRequest(");
if (functionStart < 0) {
  throw new Error("[patch-background-model-routing] sendLLMRequest not found");
}

const bodyMarker = "): Promise<string> {";
const bodyStart = source.indexOf(bodyMarker, functionStart);
if (bodyStart < 0) {
  throw new Error("[patch-background-model-routing] sendLLMRequest body not found");
}

const insertAt = bodyStart + bodyMarker.length;
const forceBlock = `\n    ${marker}\n    // Background feed generation should stay on the cheap, stable Google model even\n    // when the user's global/default API config points at another Gemini model.\n    if (options?.appId === "xiaohongshu" && /google|gemini/i.test(config.provider || "")) {\n        config = {\n            ...config,\n            defaultModel: "gemini-2.5-flash-lite",\n            enableNativeTools: false,\n        };\n    }\n`;

source = source.slice(0, insertAt) + forceBlock + source.slice(insertAt);
fs.writeFileSync(filePath, source, "utf8");
console.log("[patch-background-model-routing] Xiaohongshu forced to gemini-2.5-flash-lite");
