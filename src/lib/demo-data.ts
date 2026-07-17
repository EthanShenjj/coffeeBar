import type { ProductOptionGroupView, ProductView } from "@/lib/types";

type SizeOption = { name: string; delta: number };
type DrinkConfig = {
  slug: string;
  name: string;
  category: string;
  collection: "CLASSIC" | "SEASONAL";
  section: string;
  price: number;
  subtitle: string;
  imageUrl: string;
  sizes?: SizeOption[];
  temperatures?: string[];
  sweet?: boolean;
  extras?: boolean;
};

const images = {
  espresso: "https://images.unsplash.com/photo-1510707577719-ae7c14805e3a?auto=format&fit=crop&w=900&q=85",
  americano: "https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?auto=format&fit=crop&w=900&q=85",
  latte: "https://images.unsplash.com/photo-1572442388796-11668a67e53d?auto=format&fit=crop&w=900&q=85",
  dirty: "https://images.unsplash.com/photo-1461023058943-07fcbe16d735?auto=format&fit=crop&w=900&q=85",
  fruit: "https://images.unsplash.com/photo-1517701604599-bb29b565090c?auto=format&fit=crop&w=900&q=85",
  cold: "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=900&q=85",
  pour: "https://images.unsplash.com/photo-1442512595331-e89e73853f31?auto=format&fit=crop&w=900&q=85",
  matcha: "https://images.unsplash.com/photo-1515823064-d6e0c04616a7?auto=format&fit=crop&w=900&q=85",
  special: "https://images.unsplash.com/photo-1570968915860-54d5c301fa9f?auto=format&fit=crop&w=900&q=85",
};

const smallLarge: SizeOption[] = [{ name: "小杯 · 8oz 237ml", delta: 0 }, { name: "大杯 · 12oz 355ml", delta: 500 }];
const largeExtra: SizeOption[] = [{ name: "大杯 · 12oz 355ml", delta: 0 }, { name: "超大杯 · 16oz 473ml", delta: 500 }];
const allSizes: SizeOption[] = [{ name: "小杯 · 8oz 237ml", delta: 0 }, { name: "大杯 · 12oz 355ml", delta: 500 }, { name: "超大杯 · 16oz 473ml", delta: 1000 }];

function drinkOptions(config: DrinkConfig): ProductOptionGroupView[] {
  const groups: ProductOptionGroupView[] = [];
  const sizes = config.sizes ?? largeExtra;
  groups.push({ id: `${config.slug}-size`, name: "杯型", required: true, maxSelect: 1, options: sizes.map((size, index) => ({ id: `${config.slug}-size-${index}`, name: size.name, priceDelta: size.delta, isDefault: index === 0 })) });
  const temperatures = config.temperatures ?? ["热", "冰"];
  groups.push({ id: `${config.slug}-temp`, name: "温度", required: true, maxSelect: 1, options: temperatures.map((name, index) => ({ id: `${config.slug}-temp-${index}`, name, priceDelta: 0, isDefault: index === 0 })) });
  if (config.sweet !== false) groups.push({ id: `${config.slug}-sweet`, name: "甜度", required: true, maxSelect: 1, options: [{ id: `${config.slug}-sweet-0`, name: "不另外加糖", priceDelta: 0, isDefault: true }, { id: `${config.slug}-sweet-50`, name: "半糖", priceDelta: 0 }, { id: `${config.slug}-sweet-100`, name: "标准糖", priceDelta: 0 }] });
  if (config.extras !== false) groups.push({ id: `${config.slug}-extra`, name: "加料", required: false, maxSelect: 2, options: [{ id: `${config.slug}-shot`, name: "加浓缩", priceDelta: 500 }, { id: `${config.slug}-oat`, name: "换燕麦奶", priceDelta: 400 }] });
  return groups;
}

function drink(config: DrinkConfig): ProductView {
  return {
    id: config.slug,
    slug: config.slug,
    name: config.name,
    subtitle: config.subtitle,
    description: config.subtitle,
    channel: "MENU",
    category: config.category,
    menuCollection: config.collection,
    menuSection: config.section,
    price: config.price,
    imageUrl: config.imageUrl,
    stock: null,
    isAvailable: true,
    optionGroups: drinkOptions(config),
  };
}

const menuProducts: ProductView[] = [
  drink({ slug: "espresso", name: "浓缩", category: "美式", collection: "CLASSIC", section: "意式咖啡", price: 1000, subtitle: "单份意式浓缩，醇厚明亮", imageUrl: images.espresso, sizes: [{ name: "单份 · 30ml", delta: 0 }], temperatures: ["热"], sweet: false, extras: false }),
  drink({ slug: "classic-americano", name: "经典美式", category: "美式", collection: "CLASSIC", section: "意式咖啡", price: 1500, subtitle: "双份浓缩与纯净水，清爽平衡", imageUrl: images.americano, sizes: allSizes, sweet: false }),
  drink({ slug: "black-latte", name: "拿铁", category: "奶咖", collection: "CLASSIC", section: "意式咖啡", price: 1500, subtitle: "浓缩、鲜奶与丝滑奶泡", imageUrl: images.latte, sizes: allSizes }),
  drink({ slug: "flat-white", name: "澳白", category: "奶咖", collection: "CLASSIC", section: "意式咖啡", price: 1500, subtitle: "更浓郁的咖啡比例与细腻奶泡", imageUrl: images.latte, sizes: smallLarge }),
  drink({ slug: "oat-latte", name: "燕麦拿铁", category: "奶咖", collection: "CLASSIC", section: "意式咖啡", price: 2000, subtitle: "燕麦奶、坚果调浓缩与柔滑口感", imageUrl: images.latte, sizes: smallLarge }),
  drink({ slug: "soe-latte", name: "SOE 拿铁", category: "奶咖", collection: "CLASSIC", section: "单品豆 SOE", price: 2000, subtitle: "当期单一产地浓缩与鲜奶", imageUrl: images.dirty, sizes: smallLarge }),
  drink({ slug: "soe-americano", name: "SOE 美式", category: "美式", collection: "CLASSIC", section: "单品豆 SOE", price: 2000, subtitle: "突出当期豆单的干净果香", imageUrl: images.americano, sizes: [{ name: "大杯 · 12oz 355ml", delta: 0 }], sweet: false }),
  drink({ slug: "dirty", name: "SOE Dirty", category: "奶咖", collection: "CLASSIC", section: "单品豆 SOE", price: 2000, subtitle: "冰博克牛乳与当期 SOE 浓缩", imageUrl: images.dirty, sizes: [{ name: "小杯 · 8oz 237ml", delta: 0 }], temperatures: ["冰"], sweet: false }),
  drink({ slug: "ethiopia", name: "单品豆手冲", category: "手冲", collection: "CLASSIC", section: "手冲咖啡", price: 2500, subtitle: "每周更换产区与处理法", imageUrl: images.pour, sizes: [{ name: "小杯 · 8oz 237ml", delta: 0 }, { name: "大杯 · 12oz 355ml", delta: 0 }], sweet: false, extras: false }),
  drink({ slug: "seasonal-pour", name: "当季手冲", category: "手冲", collection: "CLASSIC", section: "手冲咖啡", price: 3000, subtitle: "当季限定豆单，请向咖啡师了解", imageUrl: images.pour, sizes: [{ name: "标准杯 · 237ml", delta: 0 }], sweet: false, extras: false }),
  drink({ slug: "iced-grape", name: "冰葡特饮", category: "果咖", collection: "CLASSIC", section: "零咖系列", price: 1500, subtitle: "葡萄果香、气泡与清爽酸甜", imageUrl: images.cold, sizes: [{ name: "超大杯 · 16oz 473ml", delta: 0 }], temperatures: ["冰"], extras: false }),
  drink({ slug: "coconut-matcha", name: "冰椰抹茶", category: "特调", collection: "CLASSIC", section: "零咖系列", price: 2000, subtitle: "椰乳与抹茶的清甜组合", imageUrl: images.matcha, sizes: [{ name: "超大杯 · 16oz 473ml", delta: 0 }], temperatures: ["冰"], extras: false }),
  drink({ slug: "chocolate", name: "巧克力", category: "特调", collection: "CLASSIC", section: "零咖系列", price: 2000, subtitle: "醇厚可可与鲜奶，不含咖啡因", imageUrl: images.special, sizes: smallLarge, extras: false }),
  drink({ slug: "hot-milk", name: "热牛奶", category: "特调", collection: "CLASSIC", section: "零咖系列", price: 1500, subtitle: "温热鲜奶，口感柔和", imageUrl: images.latte, sizes: [{ name: "大杯 · 12oz 355ml", delta: 0 }], temperatures: ["热"], sweet: false, extras: false }),
  drink({ slug: "white-mocha", name: "白摩卡", category: "奶咖", collection: "SEASONAL", section: "风味系列", price: 2500, subtitle: "白巧克力、浓缩与鲜奶", imageUrl: images.latte, sizes: largeExtra }),
  drink({ slug: "butter-cheese-latte", name: "白脱拿铁", category: "奶咖", collection: "SEASONAL", section: "风味系列", price: 2500, subtitle: "奶油芝士风味与醇厚浓缩", imageUrl: images.latte, sizes: [{ name: "大杯 · 12oz 355ml", delta: 0 }, { name: "超大杯 · 16oz 473ml", delta: 0 }] }),
  drink({ slug: "rich-cheese-latte", name: "厚芝芝拿铁", category: "奶咖", collection: "SEASONAL", section: "风味系列", price: 2000, subtitle: "浓厚芝士奶盖与醇香拿铁", imageUrl: images.latte, sizes: largeExtra }),
  drink({ slug: "roasted-nut-latte", name: "烤坚果拿铁", category: "奶咖", collection: "SEASONAL", section: "风味系列", price: 2000, subtitle: "烘烤坚果香与柔滑鲜奶", imageUrl: images.dirty, sizes: largeExtra }),
  drink({ slug: "salted-cheese-latte", name: "咸芝士拿铁", category: "奶咖", collection: "SEASONAL", section: "风味系列", price: 2000, subtitle: "咸香芝士与浓郁奶咖", imageUrl: images.latte, sizes: largeExtra }),
  drink({ slug: "salted-caramel-latte", name: "海盐焦糖拿铁", category: "奶咖", collection: "SEASONAL", section: "风味系列", price: 2000, subtitle: "海盐、焦糖与浓缩咖啡", imageUrl: images.special, sizes: largeExtra }),
  drink({ slug: "new-citrus-latte", name: "清橙风味拿铁", category: "果咖", collection: "SEASONAL", section: "风味系列", price: 2000, subtitle: "清新橙香与柔滑拿铁", imageUrl: images.fruit, sizes: largeExtra }),
  drink({ slug: "banana-latte", name: "香蕉风味拿铁", category: "奶咖", collection: "SEASONAL", section: "风味系列", price: 2000, subtitle: "熟香蕉甜香与浓缩鲜奶", imageUrl: images.latte, sizes: largeExtra }),
  drink({ slug: "sea-salt-cheese-latte", name: "海盐芝士风味拿铁", category: "奶咖", collection: "SEASONAL", section: "风味系列", price: 2500, subtitle: "海盐芝士与醇厚咖啡", imageUrl: images.special, sizes: [{ name: "大杯 · 12oz 355ml", delta: 0 }, { name: "超大杯 · 16oz 473ml", delta: 0 }] }),
  drink({ slug: "orange-americano", name: "热橙美式", category: "果咖", collection: "SEASONAL", section: "风味系列", price: 2000, subtitle: "橙香与热美式的明亮酸甜", imageUrl: images.fruit, sizes: [{ name: "大杯 · 12oz 355ml", delta: 0 }], temperatures: ["热"], sweet: false }),
  drink({ slug: "preserved-plum-americano", name: "话梅风味冰美式", category: "果咖", collection: "SEASONAL", section: "风味系列", price: 2000, subtitle: "话梅酸甜与清爽冰美式", imageUrl: images.cold, sizes: [{ name: "超大杯 · 16oz 473ml", delta: 0 }], temperatures: ["冰"], sweet: false }),
  drink({ slug: "ginger-americano", name: "干姜美式（含气泡）", category: "特调", collection: "SEASONAL", section: "风味系列", price: 1500, subtitle: "干姜辛香、气泡与浓缩", imageUrl: images.americano, sizes: [{ name: "超大杯 · 16oz 473ml", delta: 0 }], temperatures: ["冰"], sweet: false }),
  drink({ slug: "grape-coffee", name: "冰葡美式", category: "果咖", collection: "SEASONAL", section: "风味系列", price: 1500, subtitle: "葡萄果香、气泡与浓缩咖啡", imageUrl: images.cold, sizes: [{ name: "超大杯 · 16oz 473ml", delta: 0 }], temperatures: ["冰"], sweet: false }),
  drink({ slug: "iced-orange-americano", name: "冰橙美式（含气泡）", category: "果咖", collection: "SEASONAL", section: "风味系列", price: 1500, subtitle: "鲜橙、气泡与浓缩咖啡", imageUrl: images.fruit, sizes: [{ name: "超大杯 · 16oz 473ml", delta: 0 }], temperatures: ["冰"], sweet: false }),
  drink({ slug: "orange-jasmine", name: "冰橙茉莉美式", category: "果咖", collection: "SEASONAL", section: "风味系列", price: 2000, subtitle: "鲜橙、茉莉茶香与浓缩", imageUrl: images.fruit, sizes: [{ name: "超大杯 · 16oz 473ml", delta: 0 }], temperatures: ["冰"], sweet: false }),
  drink({ slug: "coconut-soe-americano", name: "冰椰 SOE 美式", category: "特调", collection: "SEASONAL", section: "风味系列", price: 2000, subtitle: "椰子水与单一产地浓缩", imageUrl: images.cold, sizes: [{ name: "超大杯 · 16oz 473ml", delta: 0 }], temperatures: ["冰"], sweet: false }),
  drink({ slug: "tiramisu-coffee", name: "提拉米苏拿铁", category: "特调", collection: "SEASONAL", section: "风味系列", price: 2000, subtitle: "马斯卡彭、可可与咖啡", imageUrl: images.special, sizes: largeExtra }),
  drink({ slug: "osmanthus-latte", name: "桂花风味拿铁", category: "奶咖", collection: "SEASONAL", section: "季节限定", price: 2000, subtitle: "桂花香、鲜奶与醇厚浓缩", imageUrl: images.latte, sizes: smallLarge }),
  drink({ slug: "matcha-latte", name: "抹茶拿铁", category: "特调", collection: "SEASONAL", section: "季节限定", price: 1500, subtitle: "抹茶与鲜奶，清苦回甘", imageUrl: images.matcha, sizes: smallLarge, extras: false }),
  drink({ slug: "osmanthus-longjing-latte", name: "桂花龙井风味拿铁", category: "特调", collection: "SEASONAL", section: "季节限定", price: 2500, subtitle: "桂花、龙井茶香与鲜奶", imageUrl: images.matcha, sizes: [{ name: "超大杯 · 16oz 473ml", delta: 0 }], temperatures: ["冰"], extras: false }),
  drink({ slug: "citrus-latte", name: "橘皮风味拿铁", category: "奶咖", collection: "SEASONAL", section: "季节限定", price: 2500, subtitle: "橘皮清香与浓郁奶咖", imageUrl: images.special, sizes: [{ name: "大杯 · 12oz 355ml", delta: 0 }] }),
  drink({ slug: "matcha-espresso", name: "绿野仙踪", category: "特调", collection: "SEASONAL", section: "季节限定", price: 2000, subtitle: "抹茶拿铁与一份浓缩", imageUrl: images.matcha, sizes: [{ name: "大杯 · 12oz 355ml", delta: 0 }] }),
  drink({ slug: "cold-brew", name: "冷萃咖啡", category: "美式", collection: "SEASONAL", section: "季节限定", price: 2500, subtitle: "长时间低温萃取，干净顺滑", imageUrl: images.cold, sizes: [{ name: "大杯 · 12oz 355ml", delta: 0 }], temperatures: ["冰"], sweet: false, extras: false }),
];

export const DEMO_PRODUCTS: ProductView[] = [
  ...menuProducts,
  { id: "basque", slug: "basque", name: "原味巴斯克", subtitle: "焦香表层，柔软芝士心", description: "每日门店新鲜烘焙", channel: "MENU", category: "甜品", menuCollection: "CLASSIC", menuSection: "甜品", price: 3200, imageUrl: "https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=900&q=85", stock: null, isAvailable: true, optionGroups: [] },
  { id: "blend-beans", slug: "blend-beans", name: "日常拼配咖啡豆", subtitle: "黑巧、坚果、焦糖｜200g", description: "适合意式与奶咖", channel: "MENU", category: "咖啡豆", menuCollection: "CLASSIC", menuSection: "咖啡豆", price: 8800, imageUrl: "https://images.unsplash.com/photo-1447933601403-0c6688de566e?auto=format&fit=crop&w=900&q=85", stock: 36, isAvailable: true, optionGroups: [] },
  { id: "minimal-mug", slug: "minimal-mug", name: "黑白陶瓷马克杯", subtitle: "手工釉面｜350ml", description: "适合日常拿铁与手冲", channel: "SHOP", category: "咖啡杯", price: 12800, imageUrl: "https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?auto=format&fit=crop&w=900&q=85", stock: 18, isAvailable: true, optionGroups: [] },
  { id: "glass-cup", slug: "glass-cup", name: "双层玻璃杯", subtitle: "耐热玻璃｜280ml", description: "轻盈通透，不烫手", channel: "SHOP", category: "咖啡杯", price: 9800, imageUrl: "https://images.unsplash.com/photo-1517256064527-09c73fc73e38?auto=format&fit=crop&w=900&q=85", stock: 24, isAvailable: true, optionGroups: [] },
  { id: "dripper", slug: "dripper", name: "锥形陶瓷滤杯", subtitle: "01号｜黑色", description: "稳定水流，适合一人份手冲", channel: "SHOP", category: "咖啡器具", price: 16800, imageUrl: "https://images.unsplash.com/photo-1545665225-b23b99e4d45e?auto=format&fit=crop&w=900&q=85", stock: 12, isAvailable: true, optionGroups: [] },
  { id: "hand-grinder", slug: "hand-grinder", name: "便携手摇磨豆机", subtitle: "不锈钢锥刀｜24档", description: "从意式到手冲的精准刻度", channel: "SHOP", category: "咖啡器具", price: 39800, imageUrl: "https://images.unsplash.com/photo-1520970014086-2208d157c9e2?auto=format&fit=crop&w=900&q=85", stock: 8, isAvailable: true, optionGroups: [] },
];

export const DEMO_ANNOUNCEMENTS = [
  { id: "a1", title: "夏日果咖季", summary: "三款限定果咖，本周会员优先尝鲜。", date: "2026-07-12", read: false },
  { id: "a2", title: "周末手冲分享会", summary: "认识产区、处理法与风味，限额 12 人。", date: "2026-07-08", read: false },
  { id: "a3", title: "自带杯计划", summary: "少一点浪费，多一点日常。", date: "2026-06-28", read: true },
];
