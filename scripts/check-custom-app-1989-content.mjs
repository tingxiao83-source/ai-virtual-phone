import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const runnerPath = path.join(root, "components/app-market/custom-app-runner.tsx");
const source = fs.readFileSync(runnerPath, "utf8");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(source.includes("// CUSTOM_APP_1989_CONTENT_V1"), "Missing imported-app source compatibility patch");
assert(source.includes("// CUSTOM_APP_1989_RUNTIME_V1"), "Missing imported-app runtime compatibility patch");
assert(source.includes('var appName = ${JSON.stringify(app.name)};'), "Custom app name is not exposed to the sandbox bridge");
assert(source.includes('name.includes("极速达")'), "极速达 source profile is missing");
assert(source.includes('name.includes("恋人小屋")'), "恋人小屋 source profile is missing");
assert(source.includes("round1989Price"), "1989 price conversion is missing");
assert(source.includes("人民币价格使用1989年量级"), "极速达 AI-era pricing rule is missing");
assert(source.includes("人物的生活、约会、通讯、消费和环境必须符合当时条件"), "恋人小屋 AI-era rule is missing");
assert(source.includes("MutationObserver"), "Hard-coded imported-app text observer is missing");
assert(source.includes("payload = prepare1989Request(action, payload);"), "1989 request adapter is not wired into the bridge");
assert(source.includes("finish1989Result(item.action, data.result)"), "1989 result adapter is not wired into the bridge");

console.log("[check-custom-app-1989-content] OK: 极速达 prices/catalogue and 恋人小屋 world content are guarded for 1989");
