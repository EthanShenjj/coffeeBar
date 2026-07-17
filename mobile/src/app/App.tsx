import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link, Navigate, Outlet, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import type { AuthController, AuthSnapshot } from "../auth/auth-controller";
import { consumeIntendedRoute, saveIntendedRoute } from "../auth/intended-route";

const pages: Record<string, { title: string; body: string }> = {
  home: { title: "CoffeeBar", body: "你的每日咖啡与生活好物。" },
  menu: { title: "菜单", body: "浏览咖啡、茶饮与当季特调。" },
  shop: { title: "商店", body: "浏览 CoffeeBar 周边与咖啡豆。" },
  cart: { title: "购物车", body: "确认商品、规格和数量。" },
  checkout: { title: "结算", body: "选择取货时间并提交订单。" },
  login: { title: "登录", body: "登录后可查看订单与会员权益。" },
  register: { title: "注册", body: "创建 CoffeeBar 账户。" },
  messages: { title: "消息", body: "查看门店公告与最新活动。" },
  message: { title: "消息详情", body: "消息正文。" },
  member: { title: "会员", body: "查看等级、消费与会员进度。" },
  orders: { title: "订单", body: "查看历史订单。" },
  order: { title: "订单详情", body: "查看订单状态与取货信息。" },
  giftCard: { title: "购物卡", body: "查看余额与交易记录。" },
  privacy: { title: "隐私与账户", body: "管理数据分析授权和账户。" },
};

function Page({ name }: { name: keyof typeof pages }) {
  const page = pages[name]!;
  return <main id="main-content" className="page"><h1>{page.title}</h1><p>{page.body}</p></main>;
}

function AuthForm({ mode, controller }: { mode: "login" | "register"; controller?: AuthController }) {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const title = mode === "login" ? "登录" : "注册";
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!controller) return;
    const values = Object.fromEntries(new FormData(event.currentTarget));
    setSubmitting(true);
    setError(null);
    try {
      if (mode === "login") await controller.signIn({ email: String(values.email), password: String(values.password) });
      else await controller.signUp({ name: String(values.name), email: String(values.email), password: String(values.password) });
      navigate(consumeIntendedRoute("/member"), { replace: true });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "认证失败，请稍后重试");
    } finally {
      setSubmitting(false);
    }
  }
  return <main id="main-content" className="page">
    <h1>{title}</h1>
    <form onSubmit={submit}>
      {mode === "register" && <label>姓名<input name="name" autoComplete="name" required minLength={2} /></label>}
      <label>邮箱<input name="email" type="email" autoComplete="email" required /></label>
      <label>密码<input name="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={8} /></label>
      {error && <p role="alert">{error}</p>}
      <button type="submit" disabled={submitting || !controller}>{submitting ? "请稍候…" : title}</button>
    </form>
    <Link to={mode === "login" ? "/register" : "/login"}>{mode === "login" ? "创建账户" : "已有账户？登录"}</Link>
  </main>;
}

function PrivacyAccountPage({ controller }: { controller?: AuthController }) {
  const navigate = useNavigate();
  async function logout() {
    if (!controller) return;
    await controller.signOut();
    navigate("/login", { replace: true });
  }
  return <main id="main-content" className="page"><h1>{pages.privacy!.title}</h1><p>{pages.privacy!.body}</p><button type="button" onClick={() => void logout()} disabled={!controller}>退出登录</button></main>;
}

export function AppShell() {
  return <div className="app-shell">
    <a className="skip-link" href="#main-content">跳到主内容</a>
    <header><Link to="/" aria-label="CoffeeBar 首页" className="brand">CB/</Link></header>
    <Outlet />
    <nav aria-label="主导航">
      <Link to="/">首页</Link><Link to="/menu">菜单</Link><Link to="/shop">商店</Link>
      <Link to="/messages">消息</Link><Link to="/member">我的</Link>
    </nav>
  </div>;
}

function Protected({ auth, children }: { auth: AuthSnapshot; children: ReactNode }) {
  const location = useLocation();
  useEffect(() => {
    if (auth.status === "anonymous") saveIntendedRoute(`${location.pathname}${location.search}`);
  }, [auth.status, location.pathname, location.search]);
  if (auth.status === "restoring") return <main id="main-content" aria-live="polite"><p>正在恢复登录状态…</p></main>;
  if (auth.status === "retryable") return <main id="main-content" aria-live="polite"><p>暂时无法验证登录状态，网络恢复后将自动重试。</p></main>;
  if (auth.status === "anonymous") return <Navigate to="/login" replace />;
  return children;
}

export function AppRoutes({ auth, controller }: { auth: AuthSnapshot; controller?: AuthController }) {
  return <Routes>
    <Route element={<AppShell />}>
      <Route index element={<Page name="home" />} />
      <Route path="menu" element={<Page name="menu" />} />
      <Route path="shop" element={<Page name="shop" />} />
      <Route path="cart/:kind" element={<Page name="cart" />} />
      <Route path="login" element={<AuthForm mode="login" controller={controller} />} />
      <Route path="register" element={<AuthForm mode="register" controller={controller} />} />
      <Route path="messages" element={<Page name="messages" />} />
      <Route path="messages/:id" element={<Page name="message" />} />
      <Route path="checkout" element={<Protected auth={auth}><Page name="checkout" /></Protected>} />
      <Route path="member" element={<Protected auth={auth}><Page name="member" /></Protected>} />
      <Route path="orders" element={<Protected auth={auth}><Page name="orders" /></Protected>} />
      <Route path="orders/:id" element={<Protected auth={auth}><Page name="order" /></Protected>} />
      <Route path="gift-card" element={<Protected auth={auth}><Page name="giftCard" /></Protected>} />
      <Route path="privacy-account" element={<Protected auth={auth}><PrivacyAccountPage controller={controller} /></Protected>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Route>
  </Routes>;
}
