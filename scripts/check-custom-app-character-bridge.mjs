import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const runnerPath = path.join(root, "components/app-market/custom-app-runner.tsx");
const storagePath = path.join(root, "lib/custom-app-storage.ts");
const source = fs.readFileSync(runnerPath, "utf8");
const storage = fs.readFileSync(storagePath, "utf8");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(
  source.includes('function bridgeActionNeedsKvStorage(action: string): boolean {\n  return action.startsWith("characters.")'),
  "characters.* does not hydrate KV storage before reading character data",
);
assert(
  source.includes("CUSTOM_APP_BRIDGE_STORAGE_READY_V1"),
  "custom APP iframe is not gated on KV storage readiness",
);
assert(
  source.includes('if (action === "characters.list")'),
  "characters.list bridge handler is missing",
);
assert(
  source.includes('if (action === "characters.get")'),
  "characters.get bridge handler is missing",
);
assert(
  source.includes('import { hydrateKvDb, isKvHydrated } from "@/lib/kv-db";'),
  "custom app runner does not import KV hydration readiness state",
);
assert(
  storage.includes("CUSTOM_APP_LEGACY_CHARACTER_READ_V1"),
  "legacy custom APP character permission compatibility is missing",
);
assert(
  storage.includes("mergeInstalledPermissions(record.permissions, manifest.permissions, entryHtml)"),
  "saved and manifest custom APP permissions are not merged",
);
assert(
  storage.includes('merged.add("characters.read")'),
  "legacy read-only character API permission backfill is missing",
);

console.log("[check-custom-app-character-bridge] OK: custom APP character bridge, hydration, and legacy read permission compatibility are present");
