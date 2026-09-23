import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}
function write(rel, text) {
  fs.writeFileSync(path.join(root, rel), text, "utf8");
}
function mustReplace(source, needle, replacement, label) {
  if (!source.includes(needle)) throw new Error(`[patch-airphone1-era-only] missing anchor: ${label}`);
  return source.replace(needle, replacement);
}

function patchAllImportedApps1989() {
  const rel = "components/app-market/custom-app-runner.tsx";
  let source = read(rel);
  if (source.includes("AIRPHONE1_ERA_ONLY_V1")) return;
  if (!source.includes("CUSTOM_APP_1989_CONTENT_V1") || !source.includes("CUSTOM_APP_1989_RUNTIME_V1")) {
    throw new Error("base 1989 imported-app layer must run first");
  }

  // Apply the existing 1989 source rewrite to every imported app, not only named profiles.
  source = mustReplace(
    source,
    '  if (!isJisu && !isLoverHome) return html;\n\n  let next = html;',
    '  // AIRPHONE1_ERA_ONLY_V1: every imported app shares the 1989 world.\n  let next = html;',
    "global source rewrite",
  );

  const loverRule = "  var lover1989Rule = '【1989世界一致性】故事世界是中国1989年。人物的生活、约会、通讯、消费和环境必须符合当时条件：电话、书信、留言、现金、百货商店/供销社、电影院/录像厅、公交/普通火车、自行车等；禁止微信、朋友圈、智能手机、视频通话、移动支付、网购平台、短视频、网约车、高铁等现代内容。保持既有人设和关系不变。';";
  if (!source.includes(loverRule)) throw new Error("missing runtime 1989 rule anchor");
  source = source.replace(
    loverRule,
    `${loverRule}\n  var allApps1989Rule = '【Air Phone 1统一世界规则】当前世界年份固定为1989年；月、日、星期、小时和分钟跟随小手机当前世界时间。所有应用中的人物行为、地点、交通、通讯、娱乐、商品、菜品、服务和消费方式必须符合1989年中国现实条件。商品与菜品只能使用当时真实存在或合理可得的内容；禁止智能手机、互联网、二维码、移动支付、网购平台、现代外卖平台、网约车、高铁、短视频、直播和现代社交媒体等超时代内容。人民币价格使用1989年量级：普通食品和日用品多为几分、几角到数元，普通衣物与家用品多为数元到数十元，耐用品通常几十到数百元，不得直接沿用2020年代价格。若生成菜单或菜谱，优先使用1989年常见家常菜、地方菜和当时可获得的食材。界面形式可以现代，但世界内容不得现代化。';`,
  );

  source = source.replace(
    "  function periodize1989Data(value){\n    if (!(isJisu1989 || isLoverHome1989)) return value;",
    "  function periodize1989Data(value){",
  );
  source = source.replace(
    "  function prepare1989Request(action, payload){\n    if (!(isJisu1989 || isLoverHome1989)) return payload;\n    var next = periodize1989Data(payload);",
    "  function prepare1989Request(action, payload){\n    var next = periodize1989Data(payload);",
  );
  source = source.replace(
    "next = add1989Rule(next, isJisu1989 ? jisu1989Rule : lover1989Rule);",
    "next = add1989Rule(next, isJisu1989 ? jisu1989Rule : (isLoverHome1989 ? lover1989Rule : allApps1989Rule));",
  );
  source = source.replace(
    "  function finish1989Result(action, result){\n    if (!(isJisu1989 || isLoverHome1989)) return result;",
    "  function finish1989Result(action, result){",
  );
  source = source.replace(
    "  function normalize1989Dom(root){\n    if (!(isJisu1989 || isLoverHome1989) || !root) return;",
    "  function normalize1989Dom(root){\n    if (!root) return;",
  );
  source = source.replace(
    "  if (isJisu1989 || isLoverHome1989) {\n    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function(){ normalize1989Dom(document.body); });",
    "  {\n    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function(){ normalize1989Dom(document.body); });",
  );

  const sharedRuntimeAnchor = "    for (var i=0;i<shared.length;i++) next = next.split(shared[i][0]).join(shared[i][1]);";
  if (!source.includes(sharedRuntimeAnchor)) throw new Error("missing runtime replacement anchor");
  source = source.replace(
    sharedRuntimeAnchor,
    `${sharedRuntimeAnchor}\n    var globalEra = [\n      ['可乐鸡翅','红烧鸡翅'],['寿喜烧','土豆炖牛肉'],['香煎牛排','葱爆牛肉'],\n      ['奶茶','麦乳精'],['气泡水','汽水'],['无糖可乐','汽水'],\n      ['充电宝','电池'],['蓝牙耳机','便携收音机'],['无线耳机','便携收音机'],\n      ['平板电脑','收音机'],['智能手表','电子表'],['纸尿裤','尿布'],\n      ['湿巾','手帕'],['洗衣液','洗衣粉'],['抽纸','卫生纸'],\n      ['KTV','录像厅'],['网购','百货商店采购'],['外卖平台','送饭服务']\n    ];\n    for (var g=0;g<globalEra.length;g++) next = next.split(globalEra[g][0]).join(globalEra[g][1]);`,
  );

  write(rel, source);
}

function patchOfflineDate1989Display() {
  const rel = "components/offline/offline-date-app.tsx";
  let source = read(rel);
  if (source.includes("AIRPHONE1_OFFLINE_DATE_ERA_ONLY_V1")) return;

  const importAnchor = 'import { loadCharacters } from "@/lib/character-storage";';
  source = mustReplace(
    source,
    importAnchor,
    `${importAnchor}\nimport { STORY_CALENDAR_YEAR } from "@/lib/calendar-utils";`,
    "offline calendar import",
  );

  const oldHelper = `function toDatetimeLocal(date: Date): string {\n  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);\n  return local.toISOString().slice(0, 16);\n}`;
  const newHelper = `// AIRPHONE1_OFFLINE_DATE_ERA_ONLY_V1\nfunction toDatetimeLocal(date: Date): string {\n  const realYear = new Date().getFullYear();\n  const storyYear = STORY_CALENDAR_YEAR + date.getFullYear() - realYear;\n  const month = String(date.getMonth() + 1).padStart(2, "0");\n  const day = String(date.getDate()).padStart(2, "0");\n  const hour = String(date.getHours()).padStart(2, "0");\n  const minute = String(date.getMinutes()).padStart(2, "0");\n  return \`${'${storyYear}'}-${'${month}'}-${'${day}'}T${'${hour}'}:${'${minute}'}\`;\n}\n\nfunction fromStoryDatetimeLocal(value: string): Date {\n  const match = value.match(/^(\\d{4})-(\\d{2})-(\\d{2})T(\\d{2}):(\\d{2})$/);\n  if (!match) return new Date(value);\n  const storyYear = Number(match[1]);\n  const deviceYear = new Date().getFullYear() + storyYear - STORY_CALENDAR_YEAR;\n  return new Date(deviceYear, Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5]), 0, 0);\n}`;
  source = mustReplace(source, oldHelper, newHelper, "offline datetime helper");

  source = mustReplace(
    source,
    "        startTime: new Date(startTime).toISOString(),",
    "        startTime: fromStoryDatetimeLocal(startTime).toISOString(),",
    "offline invitation datetime parse",
  );

  write(rel, source);
}

patchAllImportedApps1989();
patchOfflineDate1989Display();
console.log("[patch-airphone1-era-only] 1989 content + offline date display applied without touching character bridge");
