import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CartKind, CartLine, ProductView } from "@coffeebar/contracts";
import { Link, Navigate, NavLink, Outlet, Route, Routes, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useStore } from "zustand";
import type { AuthController, AuthSnapshot } from "../auth/auth-controller";
import { consumeIntendedRoute, saveIntendedRoute } from "../auth/intended-route";
import { ApiClientError } from "../lib/api-client";
import { catalogQueryOptions } from "../query/catalog-query";
import { createTranslator } from "../i18n";
import { useAppServices } from "./services";

const copy = {
  zh: { home: "首页", menu: "菜单", shop: "商店", messages: "消息", mine: "我的", cart: "购物车", checkout: "结算", login: "登录", register: "注册", orders: "订单", gift: "购物卡", privacy: "隐私与账户" },
  en: { home: "Home", menu: "Menu", shop: "Shop", messages: "Messages", mine: "Profile", cart: "Cart", checkout: "Checkout", login: "Sign in", register: "Register", orders: "Orders", gift: "Gift card", privacy: "Privacy & account" },
} as const;

function useLocale() {
  const { locale } = useAppServices();
  const value = useStore(locale);
  const t = useMemo(() => createTranslator(value.locale), [value.locale]);
  return { ...value, t, c: copy[value.locale] };
}

function money(cents: number, locale: "zh" | "en") {
  return new Intl.NumberFormat(locale === "zh" ? "zh-CN" : "en-US", { style: "currency", currency: "CNY" }).format(cents / 100);
}

function dateTime(value: string, locale: "zh" | "en") {
  return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function dateOnly(value: string, locale: "zh" | "en") {
  return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", { dateStyle: "medium" }).format(new Date(value));
}

function lineAmount(line: CartLine) {
  const selected = new Set(line.optionIds);
  const delta = line.product.optionGroups.flatMap((group) => group.options).filter((option) => selected.has(option.id)).reduce((sum, option) => sum + option.priceDelta, 0);
  return (line.product.price + delta) * line.quantity;
}

function pageName(pathname: string) {
  if (pathname === "/") return "home";
  if (pathname.startsWith("/cart/")) return "cart";
  if (/^\/messages\/[^/]+$/.test(pathname)) return "message_detail";
  if (/^\/orders\/[^/]+$/.test(pathname)) return "order_detail";
  return ({ "/menu": "menu", "/shop": "shop", "/checkout": "checkout", "/login": "login", "/register": "register", "/messages": "messages", "/member": "profile", "/orders": "profile_orders", "/gift-card": "gift_card", "/privacy-account": "privacy_account" } as Record<string, string>)[pathname] ?? "unknown";
}

function QueryState({ pending, error, empty, children }: { pending: boolean; error: unknown; empty?: boolean; children: ReactNode }) {
  const { t } = useLocale();
  if (pending) return <div className="state" role="status"><span className="skeleton" />{t("正在加载…")}</div>;
  if (error) return <div className="state error" role="alert">{t("加载失败，请检查网络后重试。")}</div>;
  if (empty) return <div className="state">{t("暂无内容。")}</div>;
  return children;
}

export function AppShell() {
  const services = useAppServices();
  const network = useStore(services.network);
  const { c, locale, setLocale, t } = useLocale();
  const location = useLocation();
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    void services.analytics.track("page_viewed", { page_name: pageName(location.pathname), path: location.pathname, query_kind: params.get("kind") ?? undefined, query_direct: params.get("direct") === "1" || undefined, has_query: params.size > 0 });
  }, [location.pathname, location.search, services.analytics]);
  return <div className="app-shell">
    <a className="skip-link" href="#main-content">{t("跳到主内容")}</a>
    {!network.online && <div className="network-banner" role="status">{t("已离线：可浏览已缓存商品并编辑购物车，结算和充值已暂停。")}</div>}
    {network.recoveryNotice && <button className="network-banner recovered" onClick={network.dismissRecoveryNotice}>{t(network.recoveryNotice)} · {t("点击关闭")}</button>}
    <header><Link to="/" aria-label={`CoffeeBar ${c.home}`} className="brand">CB/</Link><button className="locale" onClick={() => setLocale(locale === "zh" ? "en" : "zh")} aria-label={t("语言切换")}>{locale === "zh" ? "EN" : "中"}</button></header>
    <Outlet />
    <nav aria-label={t("主导航")}>
      <NavLink to="/" end>{c.home}</NavLink><NavLink to="/menu">{c.menu}</NavLink><NavLink to="/shop">{c.shop}</NavLink>
      <NavLink to="/messages">{c.messages}</NavLink><NavLink to="/member">{c.mine}</NavLink>
    </nav>
  </div>;
}

function HomePage() {
  const { c, t } = useLocale();
  return <main id="main-content" className="page hero"><p className="eyebrow">COFFEE · COMMUNITY · SHANGHAI</p><h1>CoffeeBar<br />Everyday.</h1><p>{t("你的每日咖啡与生活好物。")}</p><div className="actions"><Link className="button" to="/menu">{c.menu}</Link><Link className="button secondary" to="/shop">{c.shop}</Link></div></main>;
}

function ProductConfigurator({ product, kind, onClose }: { product: ProductView; kind: CartKind; onClose(): void }) {
  const { carts, analytics } = useAppServices();
  const { locale, t } = useLocale();
  const navigate = useNavigate();
  const defaults = useMemo(() => product.optionGroups.flatMap((g) => g.options.filter((o) => o.isDefault).map((o) => o.id)), [product]);
  const [selected, setSelected] = useState(defaults);
  const [error, setError] = useState<string | null>(null);
  function toggle(group: ProductView["optionGroups"][number], optionId: string) {
    setError(null);
    setSelected((current) => {
      const groupIds = new Set(group.options.map((option) => option.id));
      if (current.includes(optionId)) return current.filter((id) => id !== optionId);
      const outside = current.filter((id) => !groupIds.has(id));
      const inside = current.filter((id) => groupIds.has(id));
      return [...outside, ...(group.maxSelect === 1 ? [optionId] : [...inside, optionId].slice(-group.maxSelect))];
    });
    const option = group.options.find((entry) => entry.id === optionId);
    void analytics.track("product_option_selected", { product_id: product.id, product_channel: kind, option_group_id: group.id, option_id: optionId, option_price_delta_cents: option?.priceDelta ?? 0 });
  }
  function add(direct: boolean) {
    try {
      if (direct) {
        const line = carts[kind].getState().buyNow(product, selected);
        window.sessionStorage.setItem("coffeebar.direct", JSON.stringify(line));
        void analytics.track("buy_now_clicked", { product_id: product.id, product_channel: kind });
        navigate(`/checkout?kind=${kind}&direct=1`);
      } else {
        carts[kind].getState().addItem(product, selected);
        void analytics.track("add_to_cart", { product_id: product.id, product_channel: kind });
        onClose();
      }
    } catch (cause) { setError(t(cause instanceof Error ? cause.message : "请选择商品规格")); }
  }
  return <section className="configurator" aria-label={`${t(product.name)} ${t("规格")}`}><button className="close" onClick={onClose} aria-label={t("关闭")}>×</button><h2>{t(product.name)}</h2><p>{t(product.description)}</p>
    {product.optionGroups.map((group) => <fieldset key={group.id}><legend>{t(group.name)}{group.required ? " *" : ""} <small>{t("最多 {count} 项", { count: group.maxSelect })}</small></legend>{group.options.map((option) => <label className="option" key={option.id}><input type={group.maxSelect === 1 ? "radio" : "checkbox"} name={group.id} checked={selected.includes(option.id)} onChange={() => toggle(group, option.id)} />{t(option.name)}<span>{option.priceDelta ? `+${money(option.priceDelta, locale)}` : ""}</span></label>)}</fieldset>)}
    {error && <p role="alert" className="form-error">{error}</p>}<div className="actions"><button onClick={() => add(false)}>{t("加入购物车")}</button><button className="secondary" onClick={() => add(true)}>{t("直接购买")}</button></div>
  </section>;
}

function CatalogPage({ kind }: { kind: CartKind }) {
  const services = useAppServices();
  const { locale, t } = useLocale();
  const query = useQuery(catalogQueryOptions({ channel: kind, api: services.api, cache: services.catalogCache }));
  const [selected, setSelected] = useState<ProductView | null>(null);
  const { c } = useLocale();
  return <main id="main-content" className="page"><div className="title-row"><div><p className="eyebrow">{kind}</p><h1>{kind === "MENU" ? c.menu : c.shop}</h1></div><Link className="cart-link" to={`/cart/${kind.toLowerCase()}`}>{c.cart}</Link></div>
    <QueryState pending={query.isPending} error={query.data ? null : query.error} empty={query.data?.length === 0}><div className="product-grid">{query.data?.map((product) => <button className="product-card" key={product.id} disabled={!product.isAvailable} onClick={() => { setSelected(product); void services.analytics.track("product_viewed", { product_id: product.id, product_channel: kind }); }}><div className="product-image">{product.imageUrl ? <img /* eslint-disable-line @next/next/no-img-element */ src={product.imageUrl} alt="" /> : <span>CB/</span>}</div><h2>{t(product.name)}</h2><p>{t(product.subtitle)}</p><strong>{money(product.price, locale)} {t("起")}</strong>{product.stock !== null && <small>{t("库存 {count}", { count: product.stock })}</small>}</button>)}</div></QueryState>
    {selected && <ProductConfigurator product={selected} kind={kind} onClose={() => setSelected(null)} />}
  </main>;
}

function CartPage() {
  const param = useParams().kind?.toUpperCase();
  const kind: CartKind = param === "SHOP" ? "SHOP" : "MENU";
  const { carts, analytics } = useAppServices();
  const { locale, c, t } = useLocale();
  const state = useStore(carts[kind]);
  useEffect(() => {
    void analytics.track("cart_viewed", { product_channel: kind, item_count: state.items.length, quantity_total: state.items.reduce((sum, line) => sum + line.quantity, 0), cart_amount_cents: state.totalCents() });
  }, [analytics, kind, state]);
  return <main id="main-content" className="page"><p className="eyebrow">{kind}</p><h1>{c.cart}</h1><div className="tabs"><Link className={kind === "MENU" ? "active" : ""} to="/cart/menu">{c.menu}</Link><Link className={kind === "SHOP" ? "active" : ""} to="/cart/shop">{c.shop}</Link></div>
    {state.items.length === 0 ? <div className="state">{t("购物车还是空的。")}<Link to={kind === "MENU" ? "/menu" : "/shop"}>{t("去挑选")}</Link></div> : <><div className="list">{state.items.map((line) => <article className="line" key={line.lineId}><div><h2>{t(line.product.name)}</h2><p>{line.product.optionGroups.flatMap((g) => g.options).filter((o) => line.optionIds.includes(o.id)).map((o) => t(o.name)).join(" · ")}</p></div><div className="quantity"><button aria-label={t("减少数量")} onClick={() => { void analytics.track("cart_item_quantity_changed", { product_channel: kind, product_id: line.product.id, quantity: line.quantity - 1 }); state.setQuantity(line.lineId, line.quantity - 1); }}>−</button><span>{line.quantity}</span><button aria-label={t("增加数量")} onClick={() => { void analytics.track("cart_item_quantity_changed", { product_channel: kind, product_id: line.product.id, quantity: line.quantity + 1 }); state.setQuantity(line.lineId, line.quantity + 1); }}>+</button><button className="text" onClick={() => { void analytics.track("cart_item_removed", { product_channel: kind, product_id: line.product.id, quantity: line.quantity, item_amount_cents: lineAmount(line) }); state.removeItem(line.lineId); }}>{t("删除")}</button></div></article>)}</div><div className="summary"><span>{t("合计")}</span><strong>{money(state.totalCents(), locale)}</strong></div><Link className="button wide" to={`/checkout?kind=${kind}`}>{t("去结算")}</Link></>}
  </main>;
}

function readDirect(kind: CartKind): CartLine[] {
  try {
    const value = JSON.parse(window.sessionStorage.getItem("coffeebar.direct") ?? "null") as CartLine | null;
    return value?.product?.channel === kind && typeof value.lineId === "string" ? [value] : [];
  } catch { return []; }
}

function defaultPickup() {
  const date = new Date(Date.now() + 30 * 60_000);
  date.setSeconds(0, 0);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function cartSignature(lines: CartLine[]) {
  return JSON.stringify(lines.map((line) => ({ lineId: line.lineId, quantity: line.quantity, optionIds: line.optionIds })));
}

function CheckoutPage() {
  const [params] = useSearchParams();
  const kind: CartKind = params.get("kind") === "SHOP" ? "SHOP" : "MENU";
  const direct = params.get("direct") === "1";
  const services = useAppServices();
  const { c, t } = useLocale();
  const cart = useStore(services.carts[kind]);
  const network = useStore(services.network);
  const lines = direct ? readDirect(kind) : cart.items;
  const [token] = useState(() => crypto.randomUUID());
  const [result, setResult] = useState<{ orderId: string; orderNumber: string } | null>(null);
  const mutation = useMutation({ mutationFn: services.customerApi.checkout });
  const submitInFlight = useRef(false);
  const trackedCheckout = useRef(false);
  useEffect(() => { if (!trackedCheckout.current && lines.length) { trackedCheckout.current = true; void services.analytics.track("checkout_started", { product_channel: kind, checkout_mode: direct ? "direct" : "cart", item_count: lines.length, quantity_total: lines.reduce((sum, line) => sum + line.quantity, 0), cart_amount_cents: lines.reduce((sum, line) => sum + lineAmount(line), 0) }); } }, [direct, kind, lines, services.analytics]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!network.online || mutation.isPending || submitInFlight.current || lines.length === 0) return;
    submitInFlight.current = true;
    const submittedSignature = cartSignature(lines);
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const checkoutProperties = { product_channel: kind, checkout_mode: direct ? "direct" : "cart", item_count: lines.length, quantity_total: lines.reduce((sum, line) => sum + line.quantity, 0), cart_amount_cents: lines.reduce((sum, line) => sum + lineAmount(line), 0) };
    void services.analytics.track("checkout_form_submitted", { ...checkoutProperties, has_note: Boolean(String(values.note ?? "").trim()) });
    void services.analytics.track("payment_submitted", checkoutProperties);
    try {
      const response = await mutation.mutateAsync({ token, kind, pickupName: String(values.pickupName), pickupPhone: String(values.pickupPhone), pickupAt: new Date(String(values.pickupAt)).toISOString(), note: String(values.note ?? ""), useGiftCard: values.useGiftCard === "on", items: lines.map((line) => ({ productId: line.product.id, quantity: line.quantity, optionIds: line.optionIds })) });
      if (!response.ok) throw new Error(response.message);
      setResult({ orderId: response.orderId, orderNumber: response.orderNumber });
      if (direct) {
        if (cartSignature(readDirect(kind)) === submittedSignature) window.sessionStorage.removeItem("coffeebar.direct");
      } else if (cartSignature(services.carts[kind].getState().items) === submittedSignature) {
        services.carts[kind].getState().clear();
      }
      void services.analytics.track("order_payment_succeeded", { order_id: response.orderId, order_amount_cents: response.totalAmount });
    } catch { void services.analytics.track("order_payment_failed", { product_channel: kind }); } finally { submitInFlight.current = false; }
  }
  if (result) return <main id="main-content" className="page success"><p className="success-mark">✓</p><h1>{t("下单成功")}</h1><p>{t("订单号")} {result.orderNumber}</p><Link className="button" to={`/orders/${result.orderId}`}>{t("查看订单")}</Link></main>;
  const conflict = mutation.error instanceof ApiClientError && mutation.error.code === "CONFLICT";
  return <main id="main-content" className="page"><h1>{c.checkout}</h1>{lines.length === 0 && <p role="alert">{t("购物车为空，请先添加商品。")}</p>}{!network.online && <p role="alert">{t("网络恢复后才能提交订单。")}</p>}{mutation.error && <p role="alert" className="form-error">{t(conflict ? "库存、规格或购物卡余额已变化，请返回购物车确认后重试。" : "提交失败，请稍后重试。")}</p>}
    <form onSubmit={submit}><label>{t("取货人")}<input name="pickupName" required minLength={2} /></label><label>{t("手机号")}<input name="pickupPhone" inputMode="tel" pattern="1[0-9]{10}" /></label><label>{t("取货时间")}<input name="pickupAt" type="datetime-local" defaultValue={defaultPickup()} required /></label><label>{t("备注")}<textarea name="note" maxLength={200} /></label><label className="check"><input name="useGiftCard" type="checkbox" /> {t("优先使用购物卡")}</label><button type="submit" disabled={!network.online || lines.length === 0 || mutation.isPending}>{t(mutation.isPending ? "正在提交…" : "确认下单")}</button></form>
  </main>;
}

function safeAuthError(mode: "login" | "register", cause: unknown) {
  if (cause instanceof Error && cause.message.includes("无法安全保存")) return "无法安全保存登录状态";
  return mode === "login" ? "邮箱或密码不正确，请重试" : "无法创建账户，请检查填写内容";
}

function AuthForm({ mode, controller }: { mode: "login" | "register"; controller: AuthController }) {
  const navigate = useNavigate();
  const { analytics } = useAppServices(); const { c, t } = useLocale();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const title = mode === "login" ? c.login : c.register;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const values = Object.fromEntries(new FormData(event.currentTarget)); setSubmitting(true); setError(null);
    const authMode = mode === "register" ? "signup" : "login";
    const hasNext = Boolean(window.sessionStorage.getItem("coffeebar.intended-route"));
    void analytics.track("auth_submitted", { auth_mode: authMode, has_next: hasNext });
    try {
      const user = mode === "login" ? await controller.signIn({ email: String(values.email), password: String(values.password) }) : await controller.signUp({ name: String(values.name), email: String(values.email), password: String(values.password) });
      if (mode === "register") {
        await analytics.track("regist", { user_id: user.id, auth_mode: authMode, has_next: hasNext, regist_method: "email_password" });
        await analytics.track("login", { user_id: user.id, auth_mode: authMode, has_next: hasNext, login_method: "signup_auto_login" });
      } else {
        await analytics.track("login", { user_id: user.id, auth_mode: authMode, has_next: hasNext, login_method: "email_password" });
      }
      navigate(consumeIntendedRoute("/member"), { replace: true });
    } catch (cause) { setError(t(safeAuthError(mode, cause))); void analytics.track("auth_failed", { auth_mode: authMode, has_next: hasNext }); } finally { setSubmitting(false); }
  }
  return <main id="main-content" className="page"><h1>{title}</h1><form onSubmit={submit}>{mode === "register" && <label>{t("姓名")}<input name="name" autoComplete="name" required minLength={2} /></label>}<label>{t("邮箱")}<input name="email" type="email" autoComplete="email" required /></label><label>{t("密码")}<input name="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={8} /></label>{error && <p role="alert" className="form-error">{error}</p>}<button type="submit" disabled={submitting}>{submitting ? t("请稍候…") : title}</button></form><Link to={mode === "login" ? "/register" : "/login"}>{t(mode === "login" ? "创建账户" : "已有账户？登录")}</Link></main>;
}

function AnnouncementsPage() {
  const { customerApi } = useAppServices(); const { c, t } = useLocale(); const query = useQuery({ queryKey: ["announcements"], queryFn: customerApi.announcements });
  return <main id="main-content" className="page"><h1>{c.messages}</h1><QueryState pending={query.isPending} error={query.error} empty={query.data?.length === 0}><div className="list">{query.data?.map((item) => <Link className="message" key={item.id} to={`/messages/${item.id}`}><span className={item.read ? "dot read" : "dot"} /><div><h2>{t(item.title)}</h2><p>{t(item.summary)}</p></div><time>{item.date}</time></Link>)}</div></QueryState></main>;
}

function AnnouncementPage({ auth }: { auth: AuthSnapshot }) {
  const { id = "" } = useParams(); const services = useAppServices(); const network = useStore(services.network);
  const { locale, t } = useLocale();
  const query = useQuery({ queryKey: ["announcement", id], queryFn: () => services.customerApi.announcement(id), enabled: Boolean(id) });
  const { mutate: markRead } = useMutation({ mutationFn: () => services.customerApi.markAnnouncementRead(id) });
  const readAttempted = useRef<string | null>(null);
  useEffect(() => { if (query.data) void services.analytics.track("message_opened", { message_id: id, was_unread: !query.data.read }); }, [id, query.data, services.analytics]);
  useEffect(() => { if (query.data && auth.status === "authenticated" && network.online && !query.data.read && readAttempted.current !== id) { readAttempted.current = id; markRead(); } }, [auth.status, id, markRead, network.online, query.data]);
  return <main id="main-content" className="page"><QueryState pending={query.isPending} error={query.error}>{query.data && <article><p className="eyebrow">{dateOnly(query.data.publishedAt, locale)}</p><h1>{t(query.data.title)}</h1><p className="lead">{t(query.data.summary)}</p><div className="prose">{t(query.data.content)}</div>{auth.status !== "authenticated" && <p className="hint">{t("登录后可同步已读状态。")}</p>}{!network.online && auth.status === "authenticated" && <p className="hint">{t("已离线，恢复网络后同步已读状态。")}</p>}</article>}</QueryState></main>;
}

function MemberPage({ controller }: { controller: AuthController }) {
  const { customerApi } = useAppServices(); const { c, locale, t } = useLocale(); const navigate = useNavigate(); const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["dashboard"], queryFn: customerApi.dashboard, meta: { sensitive: true } });
  async function logout() { await controller.signOut(); const roots = new Set(["dashboard", "orders", "order", "gift-card"]); queryClient.removeQueries({ predicate: (q) => q.meta?.sensitive === true || roots.has(String(q.queryKey[0] ?? "")) }); navigate("/", { replace: true }); }
  return <main id="main-content" className="page"><h1>{c.mine}</h1><QueryState pending={query.isPending} error={query.error}>{query.data && <><section className="member-card"><p>LEVEL {query.data.level.level}</p><h2>{query.data.user.name}</h2><strong>{money(query.data.totalPaid, locale)}</strong><small>{t("累计消费 · {count} 笔订单", { count: query.data.orderCount })}</small><progress value={query.data.level.progress} max="100" /></section><div className="menu-list"><Link to="/orders">{c.orders} <span>→</span></Link><Link to="/gift-card">{c.gift} · {money(query.data.giftCardBalance, locale)} <span>→</span></Link><Link to="/privacy-account">{c.privacy} <span>→</span></Link><button onClick={() => void logout()}>{t("退出登录")}</button></div></>}</QueryState></main>;
}

function OrdersPage() {
  const { customerApi } = useAppServices(); const { c, locale, t } = useLocale(); const query = useQuery({ queryKey: ["orders"], queryFn: customerApi.orders, meta: { sensitive: true } });
  return <main id="main-content" className="page"><h1>{c.orders}</h1><QueryState pending={query.isPending} error={query.error} empty={query.data?.length === 0}><div className="list">{query.data?.map((order) => <Link className="order-card" key={order.id} to={`/orders/${order.id}`}><div><small>{order.orderNumber}</small><h2>{order.items.map((i) => `${t(i.productName)} ×${i.quantity}`).join(" · ")}</h2><time>{dateTime(order.createdAt, locale)}</time></div><div><span className="badge">{t(order.status)}</span><strong>{money(order.totalAmount, locale)}</strong></div></Link>)}</div></QueryState></main>;
}

function OrderPage() {
  const { id = "" } = useParams(); const { customerApi } = useAppServices(); const { locale, t } = useLocale(); const query = useQuery({ queryKey: ["order", id], queryFn: () => customerApi.order(id), enabled: Boolean(id), meta: { sensitive: true } });
  return <main id="main-content" className="page"><QueryState pending={query.isPending} error={query.error}>{query.data && <><p className="eyebrow">{query.data.orderNumber}</p><h1>{t(query.data.status)}</h1><p className="lead">{dateTime(query.data.pickupAt, locale)} · {query.data.pickupName}</p><div className="list">{query.data.items.map((item) => <article className="line" key={item.id}><div><h2>{t(item.productName)} ×{item.quantity}</h2><p>{item.options.map((o) => t(o.name)).join(" · ")}</p></div><strong>{money(item.subtotal, locale)}</strong></article>)}</div><div className="summary"><span>{t("合计")}</span><strong>{money(query.data.totalAmount, locale)}</strong></div></>}</QueryState></main>;
}

function GiftCardPage() {
  const services = useAppServices(); const { c, locale, t } = useLocale(); const network = useStore(services.network); const client = useQueryClient();
  const query = useQuery({ queryKey: ["gift-card"], queryFn: services.customerApi.giftCard, meta: { sensitive: true } });
  const [token, setToken] = useState(() => crypto.randomUUID()); const recharge = useMutation({ mutationFn: (amount: 10000 | 20000 | 30000 | 50000) => services.customerApi.recharge({ token, amount }), onSuccess: async () => { setToken(crypto.randomUUID()); await client.invalidateQueries({ queryKey: ["gift-card"] }); } });
  return <main id="main-content" className="page"><h1>{c.gift}</h1><QueryState pending={query.isPending} error={query.error}>{query.data && <><section className="gift-card"><small>BALANCE</small><strong>{money(query.data.balance, locale)}</strong></section><h2>{t("模拟充值")}</h2>{!network.online && <p role="alert">{t("网络恢复后才能充值。")}</p>}<div className="amounts">{([10000, 20000, 30000, 50000] as const).map((amount) => <button key={amount} disabled={!network.online || recharge.isPending} onClick={() => recharge.mutate(amount)}>{money(amount, locale)}</button>)}</div>{recharge.isSuccess && <p role="status">{t("充值成功。")}</p>}{recharge.error && <p role="alert">{t("充值失败，请稍后重试。")}</p>}<h2>{t("交易记录")}</h2><div className="list">{query.data.transactions.map((item) => <article className="transaction" key={item.id}><div><strong>{t(item.type)}</strong><time>{dateTime(item.createdAt, locale)}</time></div><span>{item.amount >= 0 ? "+" : ""}{money(item.amount, locale)}</span></article>)}</div></>}</QueryState></main>;
}

function safeHttps(value: string | undefined) { try { const url = new URL(value ?? ""); return url.protocol === "https:" ? url.toString() : null; } catch { return null; } }

function PrivacyAccountPage({ controller }: { controller: AuthController }) {
  const services = useAppServices(); const { c, t } = useLocale(); const consent = useStore(services.consent); const navigate = useNavigate(); const queryClient = useQueryClient();
  const config = useQuery({ queryKey: ["app-config"], queryFn: services.customerApi.appConfig });
  const [error, setError] = useState<string | null>(null); const [deleting, setDeleting] = useState(false);
  async function toggle(allowed: boolean) { await consent.decide(allowed); if (allowed) await services.analytics.track("analytics_consent", { consent: "granted" }); }
  async function remove(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const values = Object.fromEntries(new FormData(event.currentTarget)); if (values.confirm !== "on") return setError(t("请先确认了解删除后果"));
    setDeleting(true); setError(null); try { await controller.deleteAccount(String(values.password)); await services.analytics.track("account_deleted"); const sensitiveRoots = new Set(["session", "dashboard", "member", "orders", "order", "gift-card", "giftCard"]); queryClient.removeQueries({ predicate: (q) => q.meta?.sensitive === true || sensitiveRoots.has(String(q.queryKey[0] ?? "")) }); navigate("/", { replace: true }); } catch { setError(t("账户未删除")); } finally { setDeleting(false); }
  }
  const privacy = safeHttps(config.data?.privacyUrl); const support = safeHttps(config.data?.supportUrl);
  return <main id="main-content" className="page"><h1>{c.privacy}</h1><section className="settings"><div><h2>{t("分析数据")}</h2><p>{t("帮助我们改善产品。默认关闭，不读取 IDFA。")}</p></div><label className="switch"><input aria-label={t("允许分析数据")} type="checkbox" checked={consent.allowed} onChange={(e) => void toggle(e.currentTarget.checked)} /><span /></label></section><div className="menu-list">{privacy ? <a href={privacy} target="_blank" rel="noreferrer">{t("隐私政策")} <span>↗</span></a> : <span>{t("隐私政策链接暂不可用")}</span>}{support ? <a href={support} target="_blank" rel="noreferrer">{t("帮助与支持")} <span>↗</span></a> : <span>{t("支持链接暂不可用")}</span>}</div><section className="danger"><h2>{t("删除账户")}</h2><p>{t("将永久删除会话、购物车、模拟订单、支付、购物卡和消息回执。")}</p><form onSubmit={remove}><label>{t("当前密码")}<input name="password" type="password" autoComplete="current-password" required /></label><label className="check"><input name="confirm" type="checkbox" /> {t("我了解账户和数据将永久删除")}</label>{error && <p role="alert" className="form-error">{error}</p>}<button className="danger-button" disabled={deleting}>{t(deleting ? "正在删除…" : "永久删除账户")}</button></form></section></main>;
}

function Protected({ auth, children }: { auth: AuthSnapshot; children: ReactNode }) {
  const location = useLocation();
  const { t } = useLocale();
  useEffect(() => { if (auth.status === "anonymous") saveIntendedRoute(`${location.pathname}${location.search}`); }, [auth.status, location.pathname, location.search]);
  if (auth.status === "restoring") return <main id="main-content" className="page" aria-live="polite"><div className="state"><span className="skeleton" />{t("正在恢复登录状态…")}</div></main>;
  if (auth.status === "retryable") return <main id="main-content" className="page" aria-live="polite"><div className="state">{t("暂时无法验证登录状态，网络恢复后将自动重试。")}</div></main>;
  if (auth.status === "anonymous") return <Navigate to="/login" replace />;
  return children;
}

export function AppRoutes({ auth, controller }: { auth: AuthSnapshot; controller: AuthController }) {
  return <Routes><Route element={<AppShell />}><Route index element={<HomePage />} /><Route path="menu" element={<CatalogPage kind="MENU" />} /><Route path="shop" element={<CatalogPage kind="SHOP" />} /><Route path="cart/:kind" element={<CartPage />} /><Route path="login" element={<AuthForm mode="login" controller={controller} />} /><Route path="register" element={<AuthForm mode="register" controller={controller} />} /><Route path="messages" element={<AnnouncementsPage />} /><Route path="messages/:id" element={<AnnouncementPage auth={auth} />} /><Route path="checkout" element={<Protected auth={auth}><CheckoutPage /></Protected>} /><Route path="member" element={<Protected auth={auth}><MemberPage controller={controller} /></Protected>} /><Route path="orders" element={<Protected auth={auth}><OrdersPage /></Protected>} /><Route path="orders/:id" element={<Protected auth={auth}><OrderPage /></Protected>} /><Route path="gift-card" element={<Protected auth={auth}><GiftCardPage /></Protected>} /><Route path="privacy-account" element={<Protected auth={auth}><PrivacyAccountPage controller={controller} /></Protected>} /><Route path="*" element={<Navigate to="/" replace />} /></Route></Routes>;
}
