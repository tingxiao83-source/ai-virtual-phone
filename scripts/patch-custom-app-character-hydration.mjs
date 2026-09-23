import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const runnerPath = path.join(root, "components/app-market/custom-app-runner.tsx");
let source = fs.readFileSync(runnerPath, "utf8");

const patchedNeedle = 'function bridgeActionNeedsKvStorage(action: string): boolean {\n  return action.startsWith("characters.")';
if (source.includes(patchedNeedle)) {
  console.log("[patch-custom-app-character-hydration] already applied");
  process.exit(0);
}

const anchor = 'function bridgeActionNeedsKvStorage(action: string): boolean {\n  return action.startsWith("db.")';
if (!source.includes(anchor)) {
  throw new Error("Missing bridgeActionNeedsKvStorage anchor");
}

source = source.replace(
  anchor,
  'function bridgeActionNeedsKvStorage(action: string): boolean {\n  return action.startsWith("characters.")\n    || action.startsWith("db.")'
);

fs.writeFileSync(runnerPath, source);
console.log("[patch-custom-app-character-hydration] patched characters.* to hydrate KV storage first");
