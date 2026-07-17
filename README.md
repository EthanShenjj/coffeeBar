# CoffeeBar

移动优先的单店咖啡点单与生活方式商店。项目使用 Next.js 16、React 19、Tailwind CSS 4、Better Auth、Prisma 7 和 PostgreSQL，并包含 Vite + Capacitor 8 的 iOS 顾客端。

## 已实现

- 邮箱注册登录、验证/重置邮件接口、修改密码与角色权限
- 美式、奶咖、果咖、手冲、特调、甜品、咖啡豆分类及饮品规格
- 餐饮与商店双购物车、直接点单、门店自取结算
- 服务端重新计价、库存事务、幂等模拟支付和金额持久化
- L1–L8 会员等级、消费统计、历史订单和站内消息
- 商品、订单、活动消息运营后台及 Vercel Blob 上传接口
- 无数据库时可直接浏览的演示模式
- iOS 本地前端 bundle、Keychain Bearer 会话、离线目录与双购物车
- iOS 深链、首单后推送授权、订单状态 APNs 通知和应用内账户删除

## 本地启动

1. 复制 `.env.example` 为 `.env.local` 并填写环境变量。
2. 在 Vercel 创建项目，添加托管 PostgreSQL、Blob 和 Resend 配置。
3. 在项目关联和环境变量检查完成后运行：

```bash
npm run db:generate
npm run db:migrate -- --name init
npm run db:seed
npm run dev
```

若暂时不配置数据库，直接运行 `npm run dev` 会进入演示模式；支付结果不会持久化，并会在成功页明确标识。

## 环境变量

- `DATABASE_URL`: PostgreSQL 连接地址
- `BETTER_AUTH_SECRET`: 至少 32 字节的随机密钥
- `BETTER_AUTH_URL` / `NEXT_PUBLIC_APP_URL`: 应用公开地址
- `AUTH_REQUIRE_EMAIL_VERIFICATION`: 生产环境设置为 `true`
- `RESEND_API_KEY` / `EMAIL_FROM`: 认证邮件
- `BLOB_READ_WRITE_TOKEN`: 商品图片上传
- `NEXT_PUBLIC_AMPLITUDE_API_KEY`: Amplitude 项目的 API Key，用于前端行为事件上报
- `NEXT_PUBLIC_MIXPANEL_PROJECT_TOKEN`: Mixpanel 项目的 Project Token，用于前端行为事件上报
- `NEXT_PUBLIC_THINKINGDATA_APP_ID`: ThinkingData 项目的 App ID，用于前端行为事件上报
- `NEXT_PUBLIC_THINKINGDATA_SERVER_URL`: ThinkingData 数据接收地址，例如 `https://ta-preview.thinkingdata.cn`
- `NEXT_PUBLIC_APP_VERSION`: 传给 ThinkingData A/B 分流服务的 Web 应用版本
- `THINKINGDATA_EXPERIMENT_FETCH_URL`: ThinkingData Web Experiment 远端分流 Fetch 完整地址；由实验服务提供方确认，未配置或请求失败时登录页使用原始文案
- `THINKINGDATA_WEBHOOK_SECRET`: ThinkingData AE Webhook 通道鉴权密钥；配置后接口会校验 `X-AE-OPS-Signature` / `X-TE-OPS-Signature` 的 HmacSHA1 签名
- `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`: 首次种子管理员，仅通过安全环境变量提供
- `MOBILE_ALLOWED_ORIGIN`: iOS 固定使用 `capacitor://localhost`
- `IOS_MINIMUM_VERSION` / `IOS_MAINTENANCE_MODE`: iOS 版本与维护门禁
- `APNS_TEAM_ID` / `APNS_KEY_ID` / `APNS_PRIVATE_KEY_BASE64` / `APNS_BUNDLE_ID` / `APNS_ENVIRONMENT`: 仅服务端使用的 APNs 配置

## iOS 客户端

Web 与 API 继续部署在 Vercel；iOS 页面由 `mobile/` 构建并打包进 `mobile/ios/`，不是从 Vercel 在线加载页面。App 只通过 HTTPS 请求 Vercel API。

```bash
npm run mobile:test
npm run mobile:build
npm run mobile:sync
```

公开构建变量参考 `mobile/.env.example`。完整 Xcode、签名、APNs 与 TestFlight 步骤见 [iOS / TestFlight 发布手册](docs/ios-testflight.md)。

## ThinkingData Webhook 通道

- 通道 URL：`{NEXT_PUBLIC_APP_URL}/api/thinkingdata/webhook`
- 请求方式：`POST`
- Content-Type：`application/json`
- 请求体：ThinkingData AE Webhook 通道下发的消息数组
- 返回值：`{ "return_code": 0, "return_message": "success", "data": { "fail_list": [] } }`

当前接口完成通道接入格式校验和成功回执；后续如果要把 Webhook 消息投递到 CoffeeBar 消息中心，可以在 `src/app/api/thinkingdata/webhook/route.ts` 的成功分支中接入持久化或发送逻辑。

## ThinkingData Web Experiment

- `src/lib/thinkingdata-ab-sdk.ts` 提供项目内通用 A/B SDK，支持自定义分流主体和请求参数、指定 Feature Key 拉取、String/Double/Boolean/JSON 类型读取及默认值。
- `src/lib/thinkingdata-ab-server.ts` 提供服务端实时分流 SDK：500 ms 超时、最多 3 次尝试、同请求并发去重、仅手动曝光，以及默认 1440 分钟/10000 条曝光去重缓存。
- 登录页已接入 Feature Key `登录页注册引导文案`；浏览器通过 `/api/thinkingdata/experiment/fetch` 同源代理请求，服务端单次超时 500 ms、最多尝试 3 次，并合并同一用户的并发请求。
- 成功分流结果缓存 12 小时；同时兼容 Feature 内嵌和顶层 `experiment_detail`。远端不可用、结果无效或缓存过期时稳定使用业务默认值。
- 自动曝光只在业务实际读取 Feature 后触发，也支持关闭自动曝光并调用 `expose(featureKey)`；同一分流主体、实验和组别 24 小时内只上报一次 `te_experiment_exposure`。
- 接口、请求字段、缓存及客户端/服务端示例见 [`docs/thinkingdata-ab-sdk.md`](docs/thinkingdata-ab-sdk.md)。

ThinkingData 的公开 JavaScript 与 Node.js 接入文档目前只覆盖数据采集 SDK，没有公布 Web Experiment Fetch 地址或鉴权格式。部署前需要由 ThinkingData 实验服务提供方确认 `THINKINGDATA_EXPERIMENT_FETCH_URL` 的完整值；不要用数据接收地址 `/sync_js` 代替实验 Fetch 地址。

## 校验

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
npm run mobile:test
npm run mobile:build
npm run mobile:sync
```

数据库迁移和种子命令必须在 Vercel 项目关联、资源创建和环境变量完整后执行。真实支付、配送、多门店、优惠、退款与营销推送不在首版范围内。
