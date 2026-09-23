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
  if (!source.includes(needle)) throw new Error(`[patch-airphone1-1989-runtime] missing anchor: ${label}`);
  return source.replace(needle, replacement);
}

function patchCharacterBridge() {
  const rel = "components/app-market/custom-app-runner.tsx";
  let source = read(rel);

  if (!source.includes('function bridgeActionNeedsKvStorage(action: string): boolean {\n  return action.startsWith("characters.")')) {
    source = mustReplace(
      source,
      'function bridgeActionNeedsKvStorage(action: string): boolean {\n  return action.startsWith("db.")',
      'function bridgeActionNeedsKvStorage(action: string): boolean {\n  return action.startsWith("characters.")\n    || action.startsWith("db.")',
      "characters KV hydration",
    );
  }

  source = source.replace(
    '    if (action === "characters.list") {\n      requirePermission("characters.read");\n      return loadCharacters().map(character => ({',
    '    if (action === "characters.list") {\n      // AIRPHONE1_CHARACTER_READ_V2: installed desktop apps may always read the public character roster.\n      return loadCharacters().map(character => ({',
  );
  source = source.replace(
    '    if (action === "characters.get") {\n      requirePermission("characters.read");\n      return loadCharacters().find(character => character.id === String(record.id ?? "")) ?? null;',
    '    if (action === "characters.get") {\n      // AIRPHONE1_CHARACTER_READ_V2: read-only lookup is a host capability, not a legacy app permission trap.\n      return loadCharacters().find(character => character.id === String(record.id ?? "")) ?? null;',
  );

  if (!source.includes("AIRPHONE1_CHARACTER_READ_V2")) {
    throw new Error("character read bridge patch did not apply");
  }
  write(rel, source);
}

function patchGlobal1989Apps() {
  const rel = "components/app-market/custom-app-runner.tsx";
  let source = read(rel);
  if (source.includes("AIRPHONE1_GLOBAL_1989_V2")) return;
  if (!source.includes("CUSTOM_APP_1989_CONTENT_V1") || !source.includes("CUSTOM_APP_1989_RUNTIME_V1")) {
    throw new Error("base custom-app 1989 compatibility layer was not applied first");
  }

  // Apply source-level shared replacements to every installed app, not only two named apps.
  source = source.replace(
    '  if (!isJisu && !isLoverHome) return html;\n\n  let next = html;',
    '  // AIRPHONE1_GLOBAL_1989_V2: every installed app lives in the same 1989 world.\n  let next = html;',
  );

  const sharedLoop = '  for (const [from, to] of shared) next = next.split(from).join(to);';
  if (!source.includes(sharedLoop)) throw new Error("missing shared 1989 source rewrite loop");
  source = source.replace(sharedLoop, `${sharedLoop}\n\n  const globalEraReplacements: Array<[string, string]> = [\n    ["可乐鸡翅", "红烧鸡翅"], ["寿喜烧", "土豆炖牛肉"], ["香煎牛排", "葱爆牛肉"],\n    ["奶茶", "麦乳精"], ["气泡水", "汽水"], ["无糖可乐", "汽水"],\n    ["充电宝", "电池"], ["蓝牙耳机", "便携收音机"], ["无线耳机", "便携收音机"],\n    ["平板电脑", "收音机"], ["智能手表", "电子表"], ["纸尿裤", "尿布"],\n    ["湿巾", "手帕"], ["洗衣液", "洗衣粉"], ["抽纸", "卫生纸"],\n    ["KTV", "录像厅"], ["网购", "百货商店采购"], ["外卖平台", "送饭服务"]\n  ];\n  for (const [from, to] of globalEraReplacements) next = next.split(from).join(to);\n\n  // Normalise hard-coded catalogue/menu prices for all imported apps.\n  next = next.replace(/((["']?(?:price|unitPrice|salePrice|originalPrice|deliveryFee|shippingFee|amount|cost)["']?)\\s*:\\s*)(\\d+(?:\\.\\d+)?)/gi, (_match, prefix, _key, raw) => {\n    return prefix + String(round1989Price(Number(raw)));\n  });\n  next = next.replace(/([¥￥]\\s*)(\\d+(?:\\.\\d+)?)/g, (_match, prefix, raw) => prefix + String(round1989Price(Number(raw))));`);

  const loverRule = "  var lover1989Rule = '【1989世界一致性】故事世界是中国1989年。人物的生活、约会、通讯、消费和环境必须符合当时条件：电话、书信、留言、现金、百货商店/供销社、电影院/录像厅、公交/普通火车、自行车等；禁止微信、朋友圈、智能手机、视频通话、移动支付、网购平台、短视频、网约车、高铁等现代内容。保持既有人设和关系不变。';";
  if (!source.includes(loverRule)) throw new Error("missing lover 1989 rule anchor");
  source = source.replace(loverRule, `${loverRule}\n  var global1989Rule = '【Air Phone 1统一世界规则】当前世界年份固定为1989年；月、日、星期、小时和分钟与小手机世界当前时间一致。所有应用中的人物行为、地点、交通、通讯、娱乐、商品、菜品、服务和消费方式必须符合1989年中国现实条件。商品与菜品只能使用当时已存在且在对应地区合理可得的内容；禁止智能手机、互联网、二维码、移动支付、网购平台、现代外卖平台、网约车、高铁、短视频、直播、现代社交媒体等超时代内容。人民币价格必须使用1989年量级：普通食品和日用品多为几分、几角到数元，普通衣物和家用品多为数元到数十元，耐用品通常几十到数百元；不得直接沿用2020年代价格。若应用生成菜谱，优先使用1989年常见家常菜、地方菜和当时可获得的食材。界面形式可以现代，但世界内容绝不能现代化。';`);

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
    "next = add1989Rule(next, isJisu1989 ? jisu1989Rule : (isLoverHome1989 ? lover1989Rule : global1989Rule));",
  );
  source = source.replace(
    "  function finish1989Result(action, result){\n    if (!(isJisu1989 || isLoverHome1989)) return result;",
    "  function finish1989Result(action, result){",
  );
  source = source.replace(
    "  function normalize1989Dom(root){\n    if (!(isJisu1989 || isLoverHome1989) || !root) return;",
    "  function normalize1989Dom(root){\n    if (!root) return;",
  );

  const replaceAnchor = "    for (var i=0;i<shared.length;i++) next = next.split(shared[i][0]).join(shared[i][1]);";
  if (!source.includes(replaceAnchor)) throw new Error("missing runtime shared replacements anchor");
  source = source.replace(replaceAnchor, `${replaceAnchor}\n    var globalEra = [\n      ['可乐鸡翅','红烧鸡翅'],['寿喜烧','土豆炖牛肉'],['香煎牛排','葱爆牛肉'],\n      ['奶茶','麦乳精'],['气泡水','汽水'],['无糖可乐','汽水'],['充电宝','电池'],\n      ['蓝牙耳机','便携收音机'],['无线耳机','便携收音机'],['平板电脑','收音机'],\n      ['智能手表','电子表'],['纸尿裤','尿布'],['湿巾','手帕'],['洗衣液','洗衣粉'],\n      ['抽纸','卫生纸'],['KTV','录像厅'],['网购','百货商店采购'],['外卖平台','送饭服务']\n    ];\n    for (var g=0;g<globalEra.length;g++) next = next.split(globalEra[g][0]).join(globalEra[g][1]);\n    next = next.replace(/([¥￥]\\s*)(\\d+(?:\\.\\d+)?)/g, function(_m, prefix, raw){ return prefix + String(round1989Price(Number(raw))); });\n    next = next.replace(/(\\d+(?:\\.\\d+)?)\\s*元(?=\\s*(?:\\/|每|起|$|[，。；、<]))/g, function(_m, raw){ return String(round1989Price(Number(raw))) + '元'; });`);

  if (!source.includes("AIRPHONE1_GLOBAL_1989_V2")) throw new Error("global 1989 patch marker missing");
  write(rel, source);
}

function patchOfflineDateYear() {
  const rel = "components/offline/offline-date-app.tsx";
  let source = read(rel);
  if (source.includes("AIRPHONE1_OFFLINE_DATE_1989_V2")) return;

  const importAnchor = 'import { loadCharacters } from "@/lib/character-storage";';
  source = mustReplace(
    source,
    importAnchor,
    `${importAnchor}\nimport { STORY_CALENDAR_YEAR } from "@/lib/calendar-utils";`,
    "offline date calendar import",
  );

  const helper = `function toDatetimeLocal(date: Date): string {\n  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);\n  return local.toISOString().slice(0, 16);\n}`;
  const replacement = `// AIRPHONE1_OFFLINE_DATE_1989_V2\nfunction toDatetimeLocal(date: Date): string {\n  const deviceYear = new Date().getFullYear();\n  const storyYear = STORY_CALENDAR_YEAR + date.getFullYear() - deviceYear;\n  const month = String(date.getMonth() + 1).padStart(2, "0");\n  const day = String(date.getDate()).padStart(2, "0");\n  const hour = String(date.getHours()).padStart(2, "0");\n  const minute = String(date.getMinutes()).padStart(2, "0");\n  return \`${'${storyYear}'}-${'${month}'}-${'${day}'}T${'${hour}'}:${'${minute}'}\`;\n}\n\nfunction fromStoryDatetimeLocal(value: string): Date {\n  const match = value.match(/^(\\d{4})-(\\d{2})-(\\d{2})T(\\d{2}):(\\d{2})$/);\n  if (!match) return new Date(value);\n  const storyYear = Number(match[1]);\n  const realYear = new Date().getFullYear() + storyYear - STORY_CALENDAR_YEAR;\n  return new Date(realYear, Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5]), 0, 0);\n}`;
  source = mustReplace(source, helper, replacement, "offline date story-year helpers");

  source = mustReplace(
    source,
    "        startTime: new Date(startTime).toISOString(),",
    "        startTime: fromStoryDatetimeLocal(startTime).toISOString(),",
    "offline invitation story-year parse",
  );

  write(rel, source);
}

patchCharacterBridge();
patchGlobal1989Apps();
patchOfflineDateYear();
console.log("[patch-airphone1-1989-runtime] Air Phone 1 character bridge, 1989 world content and offline-date year patched");
