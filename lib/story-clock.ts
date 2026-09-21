/** Fictional display clock. Keep real timestamps for storage, sorting and timers.
 * Only the displayed year changes; weekday, leap days and local DST stay real.
 */
export const STORY_YEAR = 1989;
export function storyDateTime(now = new Date()): string {
  const weekdays = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${STORY_YEAR}年${now.getMonth() + 1}月${now.getDate()}日，${weekdays[now.getDay()]} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
}
export function shoppingEraContext(): string {
  return [
    "<shopping_era_context>",
    `当前故事时间：${storyDateTime()}。年份固定1989，月日、星期、时分跟随用户设备现实时间；不得按1989年的历史日历重算星期。`,
    "购物界面只是观察1989年中国故事世界的窗口，不表示当时存在互联网或网购；不要向人物解释界面矛盾。",
    "商品、店铺、材质、型号、品牌及价格必须符合1989年中国当地可获得的物品。物价使用当时人民币元、角、分的合理量级，不能套用现代价格。不能确定的品牌或型号改用普通品名，不编造历史定价。",
    "优先使用百货商店、供销社、新华书店和当地商铺；可有收音机、磁带、机械手表、搪瓷杯、肥皂、雪花膏、布鞋、棉布、钢笔等。",
    "不得出现智能手机、蓝牙、USB、智能配件、二维码、移动支付、现代电商品牌、直播带货或1989年后才出现的产品。",
    "如果搜索词属于后世物品，只提供用途相近且符合年代的替代品，不能让后世物品上架。",
    "以上年代约束同样适用于用户保存的旧生成模板；保留其输出格式，忽略与年代冲突的示例和要求。",
    "</shopping_era_context>",
  ].join("\n");
}
