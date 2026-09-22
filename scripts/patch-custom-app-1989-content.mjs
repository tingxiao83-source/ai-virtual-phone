import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const runnerPath = path.join(root, "components/app-market/custom-app-runner.tsx");
let source = fs.readFileSync(runnerPath, "utf8");

if (source.includes("CUSTOM_APP_1989_CONTENT_V1")) {
  console.log("[patch-custom-app-1989-content] already applied");
  process.exit(0);
}

const srcDocAnchor = "function createCustomAppSrcDoc(app: InstalledCustomApp, frameId: string, launchContext?: Record<string, unknown> | null, embedded = false): string {\n  const body = rewriteAssetRefs(app.entryHtml.trim(), app);";
if (!source.includes(srcDocAnchor)) throw new Error("Missing custom-app srcDoc anchor");

const sourceCompat = String.raw`
// CUSTOM_APP_1989_CONTENT_V1
function round1989Price(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return value <= 0 ? 0 : value;
  const scaled = Math.max(0.05, Math.min(500, value * 0.08));
  if (scaled < 1) return Number(scaled.toFixed(2));
  if (scaled < 10) return Number(scaled.toFixed(1));
  return Math.round(scaled);
}

function rewrite1989ImportedAppSource(html: string, app: InstalledCustomApp): string {
  const name = String(app.name || "").replace(/\s+/g, "");
  const isJisu = name.includes("极速达") || name.includes("極速達");
  const isLoverHome = name.includes("恋人小屋") || name.includes("戀人小屋");
  if (!isJisu && !isLoverHome) return html;

  let next = html;
  const shared: Array<[string, string]> = [
    ["微信支付", "现金结算"], ["支付宝", "现金结算"], ["扫码支付", "现金结算"],
    ["二维码", "票据"], ["扫码", "验票"], ["网约车", "出租车"], ["高铁", "火车"],
    ["共享单车", "自行车"], ["短视频", "录像带"], ["直播间", "电视节目"],
    ["网红店", "热门店"], ["民宿", "招待所"], ["智能手机", "电话"],
  ];
  for (const [from, to] of shared) next = next.split(from).join(to);

  if (isJisu) {
    const replacements: Array<[string, string]> = [
      ["外卖骑手", "送货员"], ["骑手", "送货员"], ["配送员", "送货员"],
      ["即时配送", "便民送货"], ["秒送", "加急送货"], ["手机下单", "电话订货"],
      ["GPS定位", "地址"], ["实时定位", "地址"], ["无人机配送", "人工送货"],
      ["无人机", "送货车"], ["机器人配送", "人工送货"], ["充电宝", "电池"],
      ["蓝牙耳机", "便携收音机"], ["无线耳机", "便携收音机"], ["数据线", "电池"],
      ["平板电脑", "收音机"], ["智能手表", "电子表"], ["奶茶", "麦乳精"],
      ["气泡水", "汽水"], ["无糖可乐", "汽水"], ["网红零食", "热门零食"],
      ["预制菜", "熟食"], ["纸尿裤", "尿布"], ["湿巾", "手帕"],
      ["洗衣液", "洗衣粉"], ["抽纸", "卫生纸"], ["优惠券", "优惠票"],
    ];
    for (const [from, to] of replacements) next = next.split(from).join(to);

    // Periodise hard-coded catalogue values before the imported app executes.
    // This keeps product cards, cart arithmetic, totals and wallet payment on the same value.
    next = next.replace(/((?:["']?(?:price|unitPrice|salePrice|originalPrice|deliveryFee|shippingFee)["']?)\s*:\s*)(\d+(?:\.\d+)?)/gi, (_match, prefix, raw) => {
      return prefix + String(round1989Price(Number(raw)));
    });
    next = next.replace(/([¥￥]\s*)(\d+(?:\.\d+)?)/g, (_match, prefix, raw) => prefix + String(round1989Price(Number(raw))));
    next = next.replace(/(\d+(?:\.\d+)?)\s*元(?=\s*(?:\/|每|起|$|[，。；、<]))/g, (_match, raw) => String(round1989Price(Number(raw))) + "元");
  }

  if (isLoverHome) {
    const replacements: Array<[string, string]> = [
      ["朋友圈", "留言簿"], ["微信", "书信"], ["视频通话", "电话"],
      ["视频聊天", "电话聊天"], ["短信", "留言"], ["智能手机", "电话"],
      ["手机", "电话"], ["网购", "百货商店采购"], ["淘宝", "百货商店"],
      ["京东", "百货商店"], ["外卖", "送饭"], ["KTV", "录像厅"],
      ["自拍", "合影"], ["打卡", "留影"], ["社交媒体", "报刊与书信"],
    ];
    for (const [from, to] of replacements) next = next.split(from).join(to);
  }

  return next;
}
`;

source = source.replace(
  srcDocAnchor,
  sourceCompat + "\n" + srcDocAnchor.replace(
    "const body = rewriteAssetRefs(app.entryHtml.trim(), app);",
    "const body = rewrite1989ImportedAppSource(rewriteAssetRefs(app.entryHtml.trim(), app), app);",
  ),
);

const appIdAnchor = '  var appId = ${JSON.stringify(app.id)};\n';
if (!source.includes(appIdAnchor)) throw new Error("Missing appId bridge anchor");
source = source.replace(appIdAnchor, appIdAnchor + '  var appName = ${JSON.stringify(app.name)};\n');

const requestAnchor = "  function request(action, payload){\n";
if (!source.includes(requestAnchor)) throw new Error("Missing request bridge anchor");

const runtimeCompat = String.raw`
  // CUSTOM_APP_1989_RUNTIME_V1
  var compactAppName = String(appName || '').replace(/\s+/g, '');
  var isJisu1989 = compactAppName.indexOf('极速达') >= 0 || compactAppName.indexOf('極速達') >= 0;
  var isLoverHome1989 = compactAppName.indexOf('恋人小屋') >= 0 || compactAppName.indexOf('戀人小屋') >= 0;
  var lastNormalizedText = typeof WeakMap === 'function' ? new WeakMap() : null;

  var jisu1989Rule = '【1989世界一致性】故事世界是中国1989年。界面外壳可以保留应用形式，但世界内容必须符合1989年：商品应是当时真实存在或合理可得的食品、日用品、文具、服装、收音机、磁带、电子表、自行车等；禁止智能手机、互联网、二维码、移动支付、网约车、现代外卖平台、无人机配送、现代网红商品。人民币价格使用1989年量级：普通食品和日用品多为几分、几角到数元，常见耐用品几十到数百元；现金结算，送货由人工、自行车或普通车辆完成。';
  var lover1989Rule = '【1989世界一致性】故事世界是中国1989年。人物的生活、约会、通讯、消费和环境必须符合当时条件：电话、书信、留言、现金、百货商店/供销社、电影院/录像厅、公交/普通火车、自行车等；禁止微信、朋友圈、智能手机、视频通话、移动支付、网购平台、短视频、网约车、高铁等现代内容。保持既有人设和关系不变。';

  function replace1989Terms(text){
    var next = String(text == null ? '' : text);
    // World clock handles Date/Intl. This catches years literally printed in package text or AI output.
    next = next.replace(/(^|[^0-9])20(?:2[0-9]|3[0-9])(?=[^0-9]|$)/g, '$11989');
    var shared = [
      ['微信支付','现金结算'],['支付宝','现金结算'],['扫码支付','现金结算'],['二维码','票据'],
      ['网约车','出租车'],['高铁','火车'],['共享单车','自行车'],['短视频','录像带'],
      ['直播间','电视节目'],['网红店','热门店'],['民宿','招待所'],['智能手机','电话']
    ];
    for (var i=0;i<shared.length;i++) next = next.split(shared[i][0]).join(shared[i][1]);
    if (isJisu1989) {
      var jisu = [
        ['外卖骑手','送货员'],['骑手','送货员'],['配送员','送货员'],['即时配送','便民送货'],
        ['秒送','加急送货'],['手机下单','电话订货'],['GPS定位','地址'],['实时定位','地址'],
        ['无人机配送','人工送货'],['无人机','送货车'],['机器人配送','人工送货'],['充电宝','电池'],
        ['蓝牙耳机','便携收音机'],['无线耳机','便携收音机'],['数据线','电池'],['平板电脑','收音机'],
        ['智能手表','电子表'],['奶茶','麦乳精'],['气泡水','汽水'],['无糖可乐','汽水'],
        ['网红零食','热门零食'],['预制菜','熟食'],['纸尿裤','尿布'],['湿巾','手帕'],
        ['洗衣液','洗衣粉'],['抽纸','卫生纸'],['优惠券','优惠票']
      ];
      for (var j=0;j<jisu.length;j++) next = next.split(jisu[j][0]).join(jisu[j][1]);
    }
    if (isLoverHome1989) {
      var lover = [
        ['朋友圈','留言簿'],['微信','书信'],['视频通话','电话'],['视频聊天','电话聊天'],
        ['短信','留言'],['智能手机','电话'],['手机','电话'],['网购','百货商店采购'],
        ['淘宝','百货商店'],['京东','百货商店'],['外卖','送饭'],['KTV','录像厅'],
        ['自拍','合影'],['打卡','留影'],['社交媒体','报刊与书信']
      ];
      for (var k=0;k<lover.length;k++) next = next.split(lover[k][0]).join(lover[k][1]);
    }
    return next;
  }

  function periodize1989Data(value){
    if (!(isJisu1989 || isLoverHome1989)) return value;
    if (typeof value === 'string') return replace1989Terms(value);
    if (Array.isArray(value)) return value.map(function(item){ return periodize1989Data(item); });
    if (!value || typeof value !== 'object') return value;
    var out = {};
    Object.keys(value).forEach(function(key){ out[key] = periodize1989Data(value[key]); });
    return out;
  }

  function add1989Rule(payload, rule){
    if (!payload || typeof payload !== 'object') return payload;
    var next = {};
    Object.keys(payload).forEach(function(key){ next[key] = payload[key]; });
    if (Array.isArray(next.messages)) {
      next.messages = [{ role:'system', content:rule }].concat(next.messages);
      return next;
    }
    var keys = ['systemPrompt','system','instruction','instructions','prompt','context'];
    for (var i=0;i<keys.length;i++) {
      var key = keys[i];
      if (typeof next[key] === 'string') {
        next[key] = rule + '\n\n' + next[key];
        return next;
      }
    }
    next.prompt = rule;
    return next;
  }

  function prepare1989Request(action, payload){
    if (!(isJisu1989 || isLoverHome1989)) return payload;
    var next = periodize1989Data(payload);
    if (/^ai\.(generate|chat|generateImage|classify)$/.test(String(action || ''))) {
      next = add1989Rule(next, isJisu1989 ? jisu1989Rule : lover1989Rule);
    }
    return next;
  }

  function finish1989Result(action, result){
    if (!(isJisu1989 || isLoverHome1989)) return result;
    if (/^(db\.(get|list|create|update)|ai\.(generate|chat|classify))$/.test(String(action || ''))) {
      return periodize1989Data(result);
    }
    return result;
  }

  function normalize1989TextNode(node){
    if (!node || node.nodeType !== 3 || !node.parentElement) return;
    var tag = String(node.parentElement.tagName || '').toUpperCase();
    if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'TEXTAREA' || tag === 'INPUT' || tag === 'CODE' || tag === 'PRE') return;
    var current = String(node.nodeValue || '');
    if (lastNormalizedText && lastNormalizedText.get(node) === current) return;
    var next = replace1989Terms(current);
    if (lastNormalizedText) lastNormalizedText.set(node, next);
    if (next !== current) node.nodeValue = next;
  }

  function normalize1989Dom(root){
    if (!(isJisu1989 || isLoverHome1989) || !root) return;
    if (root.nodeType === 3) normalize1989TextNode(root);
    var walker;
    try { walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); } catch (_) { return; }
    var node;
    while ((node = walker.nextNode())) normalize1989TextNode(node);
  }

  if (isJisu1989 || isLoverHome1989) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function(){ normalize1989Dom(document.body); });
    else setTimeout(function(){ normalize1989Dom(document.body); }, 0);
    if (typeof MutationObserver === 'function') {
      var observer = new MutationObserver(function(records){
        records.forEach(function(record){
          if (record.type === 'characterData') normalize1989TextNode(record.target);
          for (var i=0;i<record.addedNodes.length;i++) normalize1989Dom(record.addedNodes[i]);
        });
      });
      var startObserver = function(){ if (document.body) observer.observe(document.body, { subtree:true, childList:true, characterData:true }); };
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startObserver); else startObserver();
    }
  }

`;

source = source.replace(
  requestAnchor,
  runtimeCompat + requestAnchor.replace("{\n", "{\n    payload = prepare1989Request(action, payload);\n"),
);

const pendingAnchor = "      pending[requestId] = { resolve: resolve, reject: reject };";
if (!source.includes(pendingAnchor)) throw new Error("Missing pending request anchor");
source = source.replace(pendingAnchor, "      pending[requestId] = { resolve: resolve, reject: reject, action: action };");

const resolveAnchor = "    if (data.ok) item.resolve(data.result);";
if (!source.includes(resolveAnchor)) throw new Error("Missing bridge result anchor");
source = source.replace(resolveAnchor, "    if (data.ok) item.resolve(finish1989Result(item.action, data.result));");

fs.writeFileSync(runnerPath, source, "utf8");
console.log("[patch-custom-app-1989-content] 极速达 / 恋人小屋 now inherit 1989 content and pricing rules");
