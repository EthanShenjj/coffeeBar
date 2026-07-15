"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/i18n-provider";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useCartStore } from "@/lib/cart-store";
import { cn, formatMoney } from "@/lib/utils";
import type { ProductView } from "@/lib/types";

const menuSections = [
  { name: "意式咖啡", english: "Espresso" },
  { name: "单品豆 SOE", english: "Single origin espresso" },
  { name: "手冲咖啡", english: "Pour over" },
  { name: "零咖系列", english: "No caffeine" },
  { name: "风味系列", english: "Flavored series" },
  { name: "季节限定", english: "Seasonal limited" },
] as const;

const coffeeArtworkBySlug: Record<string, string> = {
  "classic-americano": "0% 0%",
  "black-latte": "33.333% 0%",
  dirty: "66.667% 0%",
  "coconut-latte": "100% 0%",
  "orange-americano": "0% 50%",
  "grape-coffee": "33.333% 50%",
  ethiopia: "66.667% 50%",
  "seasonal-pour": "100% 50%",
  "tiramisu-coffee": "0% 100%",
  "espresso-tonic": "33.333% 100%",
};

function getCoffeeArtworkPosition(product: ProductView) {
  const isMenuDrink = product.channel === "MENU" && menuSections.some((item) => item.name === product.menuSection);
  if (!isMenuDrink) return null;
  if (coffeeArtworkBySlug[product.slug]) return coffeeArtworkBySlug[product.slug];

  const name = product.name;
  if (/橙|橘/.test(name)) return "0% 50%";
  if (/葡|抹茶|绿野/.test(name)) return "33.333% 50%";
  if (/手冲/.test(name)) return "100% 50%";
  if (/椰/.test(name)) return "100% 0%";
  if (/提拉米苏|摩卡|巧克力|芝士|焦糖/.test(name)) return "0% 100%";
  if (/Dirty|白脱|坚果/.test(name)) return "66.667% 0%";
  if (/气泡/.test(name)) return "33.333% 100%";
  if (/拿铁|澳白|牛奶/.test(name)) return "33.333% 0%";
  return "0% 0%";
}

export function ProductArtwork({ product, variant }: { product: ProductView; variant: "row" | "dialog" }) {
  const { t } = useI18n();
  const position = getCoffeeArtworkPosition(product);
  if (!position) return <Image src={product.imageUrl} alt={t(product.name)} fill sizes={variant === "row" ? "92px" : "520px"} className={cn("object-cover", variant === "row" && "grayscale-[12%] transition duration-500 group-hover:scale-105 group-hover:grayscale-0")} />;

  return <span role="img" aria-label={`${t(product.name)}${t("手绘插画")}`} className="absolute inset-0 bg-[#f5efe4]">
    <span
      className={cn("absolute block bg-no-repeat", variant === "row" ? "inset-x-0 top-[44%] aspect-square -translate-y-1/2 transition duration-500 group-hover:scale-105" : "inset-y-0 left-1/2 aspect-square -translate-x-1/2")}
      style={{ backgroundImage: "url('/illustrations/coffee-menu-handdrawn.png')", backgroundPosition: position, backgroundSize: "400% 300%" }}
    />
  </span>;
}

export function ProductBrowser({ products, channel }: { products: ProductView[]; channel: "MENU" | "SHOP" }) {
  const [selected, setSelected] = useState<ProductView | null>(null);
  return <>
    {channel === "MENU" ? <MenuProductList products={products} onSelect={setSelected} /> : <ShopProductList products={products} onSelect={setSelected} />}
    <ProductDialog product={selected} onClose={() => setSelected(null)} />
  </>;
}

function MenuProductList({ products, onSelect }: { products: ProductView[]; onSelect: (product: ProductView) => void }) {
  const { t } = useI18n();
  const [section, setSection] = useState<string>(menuSections[0].name);
  const active = menuSections.find((item) => item.name === section) ?? menuSections[0];
  const filtered = products.filter((product) => product.menuSection === section);
  return <div>
    <div className="rounded-[1.5rem] border bg-white p-4 md:flex md:items-center md:justify-between md:px-5">
      <div><p className="text-xs font-medium uppercase tracking-[.18em] text-zinc-400">Cup guide</p><p className="mt-1 text-sm font-medium">{t("选择杯型，价格随规格更新")}</p></div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-zinc-500 md:mt-0"><span>{t("小杯 8oz · 237ml")}</span><span>{t("大杯 12oz · 355ml")}</span><span>{t("超大杯 16oz · 473ml")}</span></div>
    </div>

    <div className="sticky top-16 z-20 -mx-5 mt-5 border-y bg-background/95 px-5 py-3 backdrop-blur-xl md:static md:mx-0 md:border-0 md:bg-transparent md:px-0 md:py-0">
      <div className="no-scrollbar flex gap-2 overflow-x-auto">{menuSections.map((item) => <button key={item.name} onClick={() => setSection(item.name)} className={cn("shrink-0 rounded-full border px-4 py-2.5 text-sm transition md:px-5", section === item.name ? "border-black bg-black text-white" : "bg-white text-zinc-500 hover:border-zinc-400")}>{t(item.name)}</button>)}</div>
    </div>

    <div className="mb-5 mt-7 flex items-end justify-between border-b pb-4">
      <div><p className="text-xs font-medium uppercase tracking-[.2em] text-zinc-400">{active.english}</p><h2 className="mt-1 text-2xl font-semibold tracking-[-.04em]">{t(active.name)}</h2></div>
      <span className="font-mono text-xs text-zinc-400">{String(filtered.length).padStart(2, "0")} ITEMS</span>
    </div>

    <div className="grid gap-3 lg:grid-cols-2">{filtered.map((product) => <MenuProductRow key={product.id} product={product} onSelect={onSelect} />)}</div>
    {!filtered.length && <div className="rounded-[1.5rem] border bg-white py-24 text-center text-sm text-zinc-400">{t("这个模块正在准备新品")}</div>}
  </div>;
}

function MenuProductRow({ product, onSelect }: { product: ProductView; onSelect: (product: ProductView) => void }) {
  const { t } = useI18n();
  const sizeGroup = product.optionGroups.find((group) => group.name === "杯型");
  const prices = sizeGroup?.options.map((option) => ({ label: t(option.name).split("·")[0].trim(), amount: product.price + option.priceDelta })) ?? [{ label: t("单价"), amount: product.price }];
  return <button onClick={() => onSelect(product)} className="group grid min-h-32 grid-cols-[92px_1fr_auto] gap-4 rounded-[1.4rem] border bg-white p-3 text-left transition hover:-translate-y-0.5 hover:border-zinc-400 hover:shadow-lg hover:shadow-black/5">
    <span className="relative h-full min-h-28 overflow-hidden rounded-[1rem] bg-zinc-100"><ProductArtwork product={product} variant="row" /></span>
    <span className="flex min-w-0 flex-col py-1"><span className="font-medium tracking-[-.02em]">{t(product.name)}</span><span className="mt-1 line-clamp-2 text-xs leading-5 text-zinc-500">{t(product.subtitle)}</span><span className="mt-auto flex flex-wrap gap-x-3 gap-y-1 pt-3">{prices.map((price) => <span key={`${price.label}-${price.amount}`} className="font-mono text-[11px]"><span className="mr-1 text-zinc-400">{price.label}</span>{formatMoney(price.amount)}</span>)}</span></span>
    <span className="flex size-9 items-center justify-center self-center rounded-full bg-black text-white transition group-hover:scale-105"><Plus className="size-4" /></span>
  </button>;
}

function ShopProductList({ products, onSelect }: { products: ProductView[]; onSelect: (product: ProductView) => void }) {
  const { t } = useI18n();
  const categories = ["咖啡杯", "咖啡器具"];
  const [category, setCategory] = useState(categories[0]);
  const filtered = products.filter((product) => product.category === category);
  return <><div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 pb-1 md:mx-0 md:px-0">{categories.map((item) => <button key={item} onClick={() => setCategory(item)} className={cn("shrink-0 rounded-full border px-5 py-2.5 text-sm transition", category === item ? "border-black bg-black text-white" : "bg-white text-zinc-500")}>{t(item)}</button>)}</div><div className="mt-7 grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-5 lg:grid-cols-4">{filtered.map((product, index) => <button key={product.id} onClick={() => onSelect(product)} className="group overflow-hidden rounded-[1.5rem] border bg-white text-left transition hover:-translate-y-1 hover:shadow-xl hover:shadow-black/5"><div className="relative aspect-[4/4.5] overflow-hidden bg-zinc-100"><Image src={product.imageUrl} alt={t(product.name)} fill sizes="(max-width: 768px) 50vw, 25vw" preload={index === 0} className="object-cover grayscale-[20%] transition duration-500 group-hover:scale-105 group-hover:grayscale-0" />{product.stock !== null && product.stock < 10 && <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-medium">{t("仅余 {count}", { count: product.stock })}</span>}</div><div className="p-4"><h3 className="font-medium tracking-tight">{t(product.name)}</h3><p className="mt-1 line-clamp-1 text-xs text-zinc-500">{t(product.subtitle)}</p><p className="mt-3 font-mono text-sm font-medium">{formatMoney(product.price)}<span className="font-sans text-[10px] font-normal text-zinc-400"> {t("起")}</span></p></div></button>)}</div></>;
}

function ProductDialog({ product, onClose }: { product: ProductView | null; onClose: () => void }) {
  const { t } = useI18n();
  const router = useRouter();
  const add = useCartStore((state) => state.add);
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [quantity, setQuantity] = useState(1);
  const defaults = useMemo(() => product?.optionGroups.flatMap((group) => group.options.filter((option) => option.isDefault).map((option) => option.id)) ?? [], [product]);
  const effective = selectedOptions.length ? selectedOptions : defaults;
  const delta = product?.optionGroups.flatMap((group) => group.options).filter((option) => effective.includes(option.id)).reduce((sum, option) => sum + option.priceDelta, 0) ?? 0;

  function toggle(groupId: string, optionId: string, maxSelect: number) {
    if (!product) return;
    const group = product.optionGroups.find((entry) => entry.id === groupId)!;
    const ids = new Set(group.options.map((entry) => entry.id));
    const base = effective.filter((id) => !ids.has(id));
    const current = effective.filter((id) => ids.has(id));
    setSelectedOptions(maxSelect === 1 ? [...base, optionId] : current.includes(optionId) ? [...base, ...current.filter((id) => id !== optionId)] : [...base, ...current.slice(-(maxSelect - 1)), optionId]);
  }
  function valid() {
    if (!product) return false;
    const missing = product.optionGroups.find((group) => group.required && !group.options.some((option) => effective.includes(option.id)));
    if (missing) toast.error(t("请选择{name}", { name: t(missing.name) }));
    return !missing;
  }
  function addToCart() { if (!product || !valid()) return; add(product, effective, quantity); toast.success(t("已加入购物车")); onClose(); }
  function buyNow() { if (!product || !valid()) return; sessionStorage.setItem("coffeebar-direct", JSON.stringify({ lineId: `direct:${product.id}`, product, optionIds: effective, quantity })); onClose(); router.push(`/checkout?kind=${product.channel}&direct=1`); }

  return <Dialog open={Boolean(product)} onOpenChange={(open) => { if (!open) { setSelectedOptions([]); setQuantity(1); onClose(); } }}><DialogContent className="p-0">{product && <><div className="relative aspect-[16/9] overflow-hidden rounded-t-[2rem] bg-zinc-100"><ProductArtwork product={product} variant="dialog" /></div><div className="p-6 pt-5"><DialogTitle className="text-2xl font-semibold tracking-[-0.04em]">{t(product.name)}</DialogTitle><DialogDescription className="mt-2 text-sm leading-6 text-zinc-500">{t(product.description)}</DialogDescription><div className="mt-5 max-h-[36vh] space-y-5 overflow-y-auto pr-1">{product.optionGroups.map((group) => <div key={group.id}><div className="mb-2 flex justify-between"><p className="text-sm font-medium">{t(group.name)}</p>{group.required && <span className="text-[10px] text-zinc-400">{t("必选")}</span>}</div><div className="flex flex-wrap gap-2">{group.options.map((option) => { const optionActive = effective.includes(option.id); return <button key={option.id} onClick={() => toggle(group.id, option.id, group.maxSelect)} className={cn("rounded-full border px-4 py-2 text-xs", optionActive ? "border-black bg-black text-white" : "bg-white")}>{t(option.name)}{option.priceDelta > 0 ? ` +${formatMoney(option.priceDelta)}` : ""}</button>; })}</div></div>)}</div><div className="mt-6 flex items-center justify-between border-t pt-5"><span className="text-sm text-zinc-500">{t("数量")}</span><div className="flex items-center gap-4"><button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="flex size-9 items-center justify-center rounded-full bg-zinc-100"><Minus className="size-4" /></button><span className="w-4 text-center font-mono">{quantity}</span><button onClick={() => setQuantity(Math.min(20, quantity + 1))} className="flex size-9 items-center justify-center rounded-full bg-zinc-100"><Plus className="size-4" /></button></div></div><div className="mt-5 grid grid-cols-[1fr_1.25fr] gap-2"><Button variant="outline" onClick={addToCart}><ShoppingBag className="size-4" />{t("加入购物车")}</Button><Button onClick={buyNow}>{t("直接点单")} · {formatMoney((product.price + delta) * quantity)}</Button></div></div></>}</DialogContent></Dialog>;
}
