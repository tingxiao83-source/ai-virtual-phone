import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const runnerPath = path.join(root, "components/app-market/custom-app-runner.tsx");
const storagePath = path.join(root, "lib/custom-app-storage.ts");

// 1) characters.* must wait for KV/IndexedDB hydration before reading character data.
let runner = fs.readFileSync(runnerPath, "utf8");
const runnerPatchedNeedle = 'function bridgeActionNeedsKvStorage(action: string): boolean {\n  return action.startsWith("characters.")';
if (!runner.includes(runnerPatchedNeedle)) {
  const runnerAnchor = 'function bridgeActionNeedsKvStorage(action: string): boolean {\n  return action.startsWith("db.")';
  if (!runner.includes(runnerAnchor)) {
    throw new Error("Missing bridgeActionNeedsKvStorage anchor");
  }
  runner = runner.replace(
    runnerAnchor,
    'function bridgeActionNeedsKvStorage(action: string): boolean {\n  return action.startsWith("characters.")\n    || action.startsWith("db.")'
  );
  fs.writeFileSync(runnerPath, runner);
  console.log("[patch-custom-app-character-hydration] patched characters.* to hydrate KV storage first");
} else {
  console.log("[patch-custom-app-character-hydration] character hydration already applied");
}

// 2) Legacy installed APPs can carry a stale/empty saved permission array even when
// their manifest declares characters.read. Merge saved + manifest permissions.
// For old packages that genuinely call AiPhone.characters.list/get but predate the
// permission field, backfill read-only characters.read from their own source usage.
let storage = fs.readFileSync(storagePath, "utf8");
const marker = "CUSTOM_APP_LEGACY_CHARACTER_READ_V1";
if (!storage.includes(marker)) {
  const helperAnchor = "function normalizeInstalledApp(raw: unknown): InstalledCustomApp | null {";
  if (!storage.includes(helperAnchor)) {
    throw new Error("Missing normalizeInstalledApp anchor");
  }

  const helper = `// CUSTOM_APP_LEGACY_CHARACTER_READ_V1\nfunction mergeInstalledPermissions(\n  saved: unknown,\n  declared: CustomAppPermission[] | undefined,\n  entryHtml: string,\n): CustomAppPermission[] {\n  const merged = new Set<CustomAppPermission>();\n  const add = (value: unknown) => {\n    const normalized = normalizePermission(value);\n    if (normalized) merged.add(normalized);\n  };\n  if (Array.isArray(saved)) saved.forEach(add);\n  if (Array.isArray(declared)) declared.forEach(add);\n\n  // Older locally-installed APP packages sometimes used the character API before\n  // characters.read became a persisted permission. Only infer the read-only grant\n  // when the package source actually references AiPhone.characters.list/get.\n  const source = String(entryHtml || \"\");\n  const usesCharacterReadApi = /(?:AiPhone|AiPhoneApp|window\\.AiPhone|window\\.AiPhoneApp)\\s*\\.\\s*characters\\s*\\.\\s*(?:list|get)\\b/.test(source);\n  if (usesCharacterReadApi) merged.add(\"characters.read\");\n\n  return Array.from(merged);\n}\n\n`;
  storage = storage.replace(helperAnchor, helper + helperAnchor);

  const permissionBlock = `      permissions: Array.isArray(record.permissions)\n        ? record.permissions.map(normalizePermission).filter(Boolean) as CustomAppPermission[]\n        : manifest.permissions ?? [],`;
  if (!storage.includes(permissionBlock)) {
    throw new Error("Missing installed permission normalization block");
  }
  storage = storage.replace(
    permissionBlock,
    `      permissions: mergeInstalledPermissions(record.permissions, manifest.permissions, entryHtml),`
  );

  fs.writeFileSync(storagePath, storage);
  console.log("[patch-custom-app-character-hydration] merged legacy APP permissions and backfilled character read access");
} else {
  console.log("[patch-custom-app-character-hydration] legacy character permission compatibility already applied");
}
