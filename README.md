# CoffeeBar

移动优先的单店咖啡点单与生活方式商店。项目使用 Next.js 16、React 19、Tailwind CSS 4、Better Auth、Prisma 7 和 PostgreSQL。

## 已实现

- 邮箱注册登录、验证/重置邮件接口、修改密码与角色权限
- 美式、奶咖、果咖、手冲、特调、甜品、咖啡豆分类及饮品规格
- 餐饮与商店双购物车、直接点单、门店自取结算
- 服务端重新计价、库存事务、幂等模拟支付和金额持久化
- L1–L8 会员等级、消费统计、历史订单和站内消息
- 商品、订单、活动消息运营后台及 Vercel Blob 上传接口
- 无数据库时可直接浏览的演示模式

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
- `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`: 首次种子管理员，仅通过安全环境变量提供

## 校验

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

数据库迁移和种子命令必须在 Vercel 项目关联、资源创建和环境变量完整后执行。真实支付、配送、多门店、优惠、退款与营销推送不在首版范围内。
