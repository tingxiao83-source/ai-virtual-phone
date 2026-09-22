import type { WorldBookConfig, WorldBookEntry } from "./settings-types";

export const DEFAULT_1989_WORLDBOOK_ID = "wb_1989_world_rules_template_v1";
export const DEFAULT_1989_WORLDBOOK_NAME = "1989｜世界规则";

function entry(uid: string, comment: string, content: string, order: number): WorldBookEntry {
  return {
    uid,
    key: "",
    content,
    comment,
    use_regex: false,
    disable: false,
    constant: true,
    position: "before_char",
    depth: 0,
    probability: 100,
    useProbability: false,
    role: 0,
    insertion_order: order,
  };
}

export function createDefault1989WorldBook(now = Date.now()): WorldBookConfig {
  return {
    id: DEFAULT_1989_WORLDBOOK_ID,
    name: DEFAULT_1989_WORLDBOOK_NAME,
    description: "1989年中国大陆时代基准、物价、通讯、线下状态与剧情连续性规则。默认仅创建模板，不会自动绑定到所有角色。",
    createdAt: now,
    updatedAt: now,
    entries: [
      entry(
        "wb1989-era",
        "时代基准",
        "故事主要时间固定在1989年中国大陆。人物只能使用其时代、身份和经历允许掌握的信息。除非剧情明确说明，不得出现1990年代以后才出现或普及的科技、品牌、网络文化、消费方式和社会习惯。无法确认年代时，优先选择1989年明确存在的替代物。",
        10,
      ),
      entry(
        "wb1989-tech",
        "通讯与科技",
        "现实世界中的常见通讯方式包括固定电话、公用电话、书信、电报和口信；传呼机等设备只按人物身份与地区条件有限出现。1989现实世界不存在智能手机、移动互联网、微信、QQ、二维码、移动支付、蓝牙、USB设备、社交媒体和现代电商平台。小手机的聊天、视频通话等功能属于玩家操作界面，不代表1989世界中的人物真实持有现代智能手机。",
        20,
      ),
      entry(
        "wb1989-economy",
        "货币、物价与商业",
        "以人民币为主要货币。商品、饮食、交通、娱乐、工资与服务价格必须参考1989年中国大陆相应地区的收入水平、供应状况和购买力，不得直接套用现代价格，也不得简单按固定比例折算。可出现供销社、国营百货商店、新华书店、粮站、副食品商店、农贸集市、国营饭店、招待所、照相馆、邮电局、汽车站、文化宫和露天电影院等。",
        30,
      ),
      entry(
        "wb1989-online-offline-story",
        "线上、线下与剧情",
        "线上是玩家界面的消息、语音和视频互动，不自动改变人物现实所在地；人物是否及时回应应受工作、训练、任务、睡眠、线下安排和性格影响。线下代表人物真实在某个时间前往某个地点见面或活动，会占用现实时间与地点。剧情代表世界中真实发生的事件及其因果后果，可以改变人物关系、情绪、所在地、工作安排、健康状态和未来安排。三者不得互相冒充或自动覆盖。",
        40,
      ),
      entry(
        "wb1989-state-continuity",
        "人物状态与连续性",
        "人物在同一时间只能处于一个主要地点并进行一项不可兼容的主要活动。已经确认的线下约会、工作、训练、任务、睡眠、住院等状态发生冲突时，应依据职责、紧急程度、性格和关系决定拒绝、迟到、取消或改期，不得让同一人物同时出现在两个地点。已经发生的重要事件必须形成连续记忆，后续剧情承认其结果，不为方便当前回复而自动重置。",
        50,
      ),
    ],
  };
}
