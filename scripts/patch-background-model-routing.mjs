import fs from "node:fs";
const source = fs.readFileSync("lib/chat-engine.ts", "utf8");
const dispatch = "config = resolveAppModelConfig(config, options?.appId);";
if (source.split(dispatch).length - 1 !== 4) {
  throw new Error("Expected app model routing in all four LLM request entrypoints");
}
console.log("[app-model-routing] story Pro / chat Flash / other text Flash-Lite");
