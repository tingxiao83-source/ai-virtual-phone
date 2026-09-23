import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const runnerPath = path.join(root, "components/app-market/custom-app-runner.tsx");
let source = fs.readFileSync(runnerPath, "utf8");

if (source.includes("AIRPHONE1_GLOBAL_1989_DOM_V2")) {
  console.log("[patch-airphone1-global-1989-dom] already applied");
  process.exit(0);
}

const anchor = "  if (isJisu1989 || isLoverHome1989) {\n    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function(){ normalize1989Dom(document.body); });";
if (!source.includes(anchor)) {
  throw new Error("[patch-airphone1-global-1989-dom] missing imported-app DOM observer anchor");
}

source = source.replace(
  anchor,
  "  // AIRPHONE1_GLOBAL_1989_DOM_V2: every installed app gets the same 1989 DOM guard.\n  {\n    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function(){ normalize1989Dom(document.body); });",
);

fs.writeFileSync(runnerPath, source, "utf8");
console.log("[patch-airphone1-global-1989-dom] all installed apps now receive 1989 DOM normalization");
