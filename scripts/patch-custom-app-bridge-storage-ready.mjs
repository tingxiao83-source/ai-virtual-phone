import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const runnerPath = path.join(root, "components/app-market/custom-app-runner.tsx");
let source = fs.readFileSync(runnerPath, "utf8");

if (source.includes("CUSTOM_APP_BRIDGE_STORAGE_READY_V1")) {
  console.log("[patch-custom-app-bridge-storage-ready] already applied");
  process.exit(0);
}

const importNeedle = 'import { hydrateKvDb } from "@/lib/kv-db";';
if (!source.includes(importNeedle)) {
  throw new Error("Missing kv-db import anchor");
}
source = source.replace(
  importNeedle,
  'import { hydrateKvDb, isKvHydrated } from "@/lib/kv-db";'
);

const readyNeedle = `    window.addEventListener("message", handleMessage);\n    setBridgeReady(true);\n    return () => {\n      window.removeEventListener("message", handleMessage);\n    };`;
if (!source.includes(readyNeedle)) {
  throw new Error("Missing bridge-ready anchor");
}

const replacement = `    window.addEventListener("message", handleMessage);\n\n    // CUSTOM_APP_BRIDGE_STORAGE_READY_V1\n    // 自定义 APP 会在首屏立即读取 characters/db/world 等宿主数据。\n    // 先让 IndexedDB -> KV 内存缓存完成水合，再挂载 iframe，避免首屏拿到空人物列表\n    // 或把“数据还没准备好”误判成“没有连接小手机运行环境”。\n    let cancelled = false;\n    const prepareBridgeStorage = async () => {\n      for (let attempt = 0; attempt < 4; attempt += 1) {\n        await hydrateKvDb();\n        if (isKvHydrated()) {\n          if (!cancelled) setBridgeReady(true);\n          return;\n        }\n        await new Promise<void>(resolve => window.setTimeout(resolve, 250 * (attempt + 1)));\n      }\n      // 不永久白屏：极端情况下仍挂载 APP，让现有错误面板/重试逻辑可以工作。\n      console.warn("[CustomAppRunner] KV storage hydration did not become ready before iframe mount");\n      if (!cancelled) setBridgeReady(true);\n    };\n    void prepareBridgeStorage();\n\n    return () => {\n      cancelled = true;\n      window.removeEventListener("message", handleMessage);\n    };`;

source = source.replace(readyNeedle, replacement);
fs.writeFileSync(runnerPath, source, "utf8");
console.log("[patch-custom-app-bridge-storage-ready] custom APP iframe now waits for KV hydration");
