import fs from "node:fs";
import path from "node:path";

const FLASH_LITE_MODEL = "gemini-3.5-flash-lite";

// ---------------------------------------------------------------------------
// Xiaohongshu: 1989 story-world guard + cheap background model routing
// ---------------------------------------------------------------------------
const enginePath = path.join(process.cwd(), "lib", "xiaohongshu-engine.ts");
let source = fs.readFileSync(enginePath, "utf8");
const original = source;

function replaceOnce(oldText, newText, label) {
  if (source.includes(newText)) return;
  if (!source.includes(oldText)) {
    throw new Error(`[patch-xiaohongshu-1989] marker not found: ${label}`);
  }
  source = source.replace(oldText, newText);
}

const importMarker = 'import { ChatEngineError, previewMessagesForApi, sendLLMRequest } from "./chat-engine";\n';
const calendarImport = 'import { storyDateTime } from "./story-clock";\n';
if (!source.includes(calendarImport)) {
  replaceOnce(importMarker, importMarker + calendarImport, "calendar import");
}

const eraMarker = "type XiaohongshuNpcMacroContext = {\n";
const eraBlock = `function buildXiaohongshuEraContext(): string {

  return [
    "<xiaohongshu_era_context priority=\\"highest\\">",
    \`当前故事日期：\${storyDateTime()}。年份固定1989，月日、星期、时分跟随现实设备；不按1989历史日历重算星期。\`,
    "以下年代规则优先于本应用内其他旧提示词；如果其他提示词要求现代网络黑话、链接、电商、短视频等与本规则冲突的内容，一律忽略冲突部分。",
    "",
    "【世界定位】",
    "- 这是一个用现代社交媒体界面观察1989年故事世界的叙事窗口。界面上的“小红书、点赞、收藏、评论、TAG、视频、私信”等只是UI层，不代表1989年真实存在这些平台或技术。",
    "- 人物不得讨论“为什么1989年有小红书”之类的界面矛盾，也不要解释穿越机制。只自然呈现故事世界中的生活内容。",
    "- 当前主世界为1989年中国背景。具体地点、单位、人物关系和事件以世界书、角色设定、记忆与剧情为准；若没有具体地点，可使用不具名的边境县城、驻军周边、学校、家属院和普通城镇生活环境。",
    "- 如果现实设备的IP属地、系统资料或现代地名与故事世界冲突，忽略现实设备信息，以故事设定为准。",
    "",
    "【年代硬规则】",
    "- 所有人物、商品、交通、娱乐、新闻、工作、学校、生活方式和社会常识必须符合1989年中国大陆可以合理存在的范围。",
    "- 禁止出现智能手机、互联网、二维码、社交媒体平台、电商、网购、外卖平台、移动支付、直播、现代短视频、蓝牙、USB、现代APP、现代型号数码产品等后世事物。",
    "- 不得随意使用1989年尚不存在的品牌、产品型号、影视作品、歌曲、政策、社会事件或流行文化。",
    "- 可自然出现供销社、百货商店、粮店、邮局、新华书店、照相馆、电影院、录像厅、汽车站、火车站、医院、学校、家属院、部队营区、军人服务社等符合年代的场景。",
    "- “视频”栏目只作为UI展示：内容应对应当时可存在的录像、电视新闻、纪录片、文艺演出、运动会、家庭录像或类似影像，不得写成手机自拍视频、直播或现代短视频。",
    "- [图标]可以使用UI符号或emoji作为界面装饰，但人物正文、评论和私信中不要把现代emoji当作1989人物的真实表达习惯。",
    "",
    "【语言规则】",
    "- 人物说话要自然、简短、有生活感，但必须符合1980年代末的身份、年龄、教育和职业背景。不要为了显得复古而机械堆砌年代词。",
    "- 禁止现代互联网话术与后世流行语，包括但不限于：种草、拔草、蹲链接、求链接、博主、粉丝、打卡、姐妹们、绝绝子、社死、内卷、狠狠爱了、同款、带货、冲一波、上头、破防、YYDS。",
    "- 评论可以有不同意见、调侃、争论、跑题和日常琐碎感，但不要使用现代网络梗来制造“活人感”。",
    "",
    "【角色与信息边界】",
    "- 角色是否公开表达、发内容、评论或与陌生人交流，首先服从其完整人设。寡言、谨慎、保密意识强的角色可以极少互动或不主动发帖，不要为了填充内容强迫角色活跃。",
    "- 任何角色和NPC只能使用其合理知道的信息。不得泄露后台设定、隐藏记忆、他人私密经历、军事秘密、未公开关系或尚未发生的剧情。",
    "- 军事、单位、家庭和私人信息只有在人物合理知道且合理公开时才能出现；涉及部队时尤其遵守保密和身份边界。",
    "- 不得因为用户与某角色有关系，就让所有NPC自动知道、议论或暗示这段关系。",
    "",
    "【互动规模】",
    "- 点赞、收藏、评论数字是UI叙事计数，不是1989年的真实网络数据。普通本地生活内容应保持克制，通常从个位数到数百；除非确有合理的大范围公共事件，不要动辄几万、几十万互动。",
    "</xiaohongshu_era_context>",
  ].join("\\n");
}

function withXiaohongshuEraMessage(messages: LLMMessage[]): LLMMessage[] {
  return [
    {
      role: "system",
      content: buildXiaohongshuEraContext(),
      _debugMeta: { marker: "xiaohongshu_era_context" },
    },
    ...messages,
  ];
}

`;

if (!source.includes("function buildXiaohongshuEraContext(): string")) {
  replaceOnce(eraMarker, eraBlock + eraMarker, "era context insertion");
}

replaceOnce(
  '  return [guard, body].filter(Boolean).join("\\n\\n");\n',
  '  return [buildXiaohongshuEraContext(), guard, body].filter(Boolean).join("\\n\\n");\n',
  "NPC era prompt wrapper",
);

const oldAssemblerLine = "const messages = assemblePromptPayload(resolved.input);";
const newAssemblerLine = "const messages = withXiaohongshuEraMessage(assemblePromptPayload(resolved.input));";
if (source.includes(oldAssemblerLine)) {
  const count = source.split(oldAssemblerLine).length - 1;
  if (count < 3) {
    throw new Error(`[patch-xiaohongshu-1989] expected at least 3 character assembly sites, found ${count}`);
  }
  source = source.split(oldAssemblerLine).join(newAssemblerLine);
} else if (!source.includes(newAssemblerLine)) {
  throw new Error("[patch-xiaohongshu-1989] character prompt assembly marker not found");
}

// Route every Xiaohongshu request through Gemini 3.5 Flash-Lite while keeping
// the user's existing Google API key/base URL and other connection settings.
const xhsApiMarker = "function resolveGlobalApiConfig(): ApiConfig | null {\n";
const xhsApiHelper = `const XIAOHONGSHU_BACKGROUND_MODEL = "${FLASH_LITE_MODEL}";

function forceXiaohongshuFlashLite(apiConfig: ApiConfig | null): ApiConfig | null {
  if (!apiConfig) return null;
  const provider = (apiConfig.provider || "").trim().toLowerCase();
  if (!provider.includes("google") && !provider.includes("gemini")) return apiConfig;
  return {
    ...apiConfig,
    defaultModel: XIAOHONGSHU_BACKGROUND_MODEL,
    enableNativeTools: false,
  };
}

`;
if (!source.includes("function forceXiaohongshuFlashLite(")) {
  replaceOnce(xhsApiMarker, xhsApiHelper + xhsApiMarker, "Xiaohongshu Flash-Lite helper");
}

replaceOnce(
  "    return configs.find(config => config.id === binding.globalDefaults.apiConfigId) ?? null;\n",
  "    return forceXiaohongshuFlashLite(configs.find(config => config.id === binding.globalDefaults.apiConfigId) ?? null);\n",
  "Xiaohongshu global API binding",
);
replaceOnce(
  "  return configs[0] ?? null;\n",
  "  return forceXiaohongshuFlashLite(configs[0] ?? null);\n",
  "Xiaohongshu global API fallback",
);

replaceOnce(
  `  const apiConfig = activeSlot.apiConfigId
    ? loadApiConfigs().find(config => config.id === activeSlot.apiConfigId) ?? null
    : null;
`,
  `  const apiConfig = activeSlot.apiConfigId
    ? forceXiaohongshuFlashLite(loadApiConfigs().find(config => config.id === activeSlot.apiConfigId) ?? null)
    : null;
`,
  "Xiaohongshu character API binding",
);

if (source !== original) {
  fs.writeFileSync(enginePath, source, "utf8");
  console.log(`[patch-xiaohongshu-1989] applied 1989 guard + ${FLASH_LITE_MODEL} routing to Xiaohongshu`);
} else {
  console.log("[patch-xiaohongshu-1989] Xiaohongshu already patched");
}

// ---------------------------------------------------------------------------
// Shopping: use Gemini Flash-Lite for catalog refresh/search generation.
// ---------------------------------------------------------------------------
const shoppingPath = path.join(process.cwd(), "lib", "shopping-engine.ts");
let shoppingSource = fs.readFileSync(shoppingPath, "utf8");
const shoppingOriginal = shoppingSource;

function replaceShoppingOnce(oldText, newText, label) {
  if (shoppingSource.includes(newText)) return;
  if (!shoppingSource.includes(oldText)) {
    throw new Error(`[patch-shopping-flash-lite] marker not found: ${label}`);
  }
  shoppingSource = shoppingSource.replace(oldText, newText);
}

const shoppingApiMarker = "function resolveShoppingApiConfig(): ApiConfig | null {\n";
const shoppingApiHelper = `const SHOPPING_BACKGROUND_MODEL = "${FLASH_LITE_MODEL}";

function forceShoppingFlashLite(apiConfig: ApiConfig | null): ApiConfig | null {
  if (!apiConfig) return null;
  const provider = (apiConfig.provider || "").trim().toLowerCase();
  if (!provider.includes("google") && !provider.includes("gemini")) return apiConfig;
  return {
    ...apiConfig,
    defaultModel: SHOPPING_BACKGROUND_MODEL,
    enableNativeTools: false,
  };
}

`;
if (!shoppingSource.includes("function forceShoppingFlashLite(")) {
  replaceShoppingOnce(shoppingApiMarker, shoppingApiHelper + shoppingApiMarker, "Shopping Flash-Lite helper");
}

replaceShoppingOnce(
  "    return configs.find(config => config.id === binding.globalDefaults.apiConfigId) ?? null;\n",
  "    return forceShoppingFlashLite(configs.find(config => config.id === binding.globalDefaults.apiConfigId) ?? null);\n",
  "Shopping global API binding",
);
replaceShoppingOnce(
  "  return configs[0] ?? null;\n",
  "  return forceShoppingFlashLite(configs[0] ?? null);\n",
  "Shopping global API fallback",
);

if (shoppingSource !== shoppingOriginal) {
  fs.writeFileSync(shoppingPath, shoppingSource, "utf8");
  console.log(`[patch-shopping-flash-lite] routed Shopping generation to ${FLASH_LITE_MODEL}`);
} else {
  console.log("[patch-shopping-flash-lite] Shopping already patched");
}
