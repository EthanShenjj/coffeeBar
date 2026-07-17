# CoffeeBar iOS / TestFlight 发布手册

## 架构边界

- Vercel 继续托管 Next.js、Better Auth、`/api/v1` 与数据库访问。
- `mobile/` 由 Vite 构建；`npx cap sync ios` 将 `mobile/dist` 复制进安装包。生产配置不得添加 `server.url`。
- Web 使用 Cookie，会话令牌在 iOS 中使用 Bearer 并保存到 Keychain。客户端不得包含数据库、Better Auth 或 APNs 私钥。
- 顾客离线时可使用已缓存目录和双购物车；结算、充值、已读同步与推送 Token 注册需要网络。

## 一次性 Apple 配置

1. 安装完整 Xcode 26 或更高版本，在 Xcode 登录 Apple Developer 账号，并让 `xcode-select` 指向该 Xcode。
2. 在 Developer Portal 创建 App ID `com.coffeebar.app`，启用 Push Notifications。
3. 创建 APNs `.p8` Key，记录 Team ID 与 Key ID。私钥只配置到 Vercel，不能放入仓库或移动端 `.env`。
4. 在 App Store Connect 创建 CoffeeBar App，Bundle ID 使用 `com.coffeebar.app`，准备隐私政策和支持 URL。
5. 在 Xcode 的 CoffeeBar target 选择团队并确认自动签名。Debug 使用 APNs development，Release 使用 production。

## Vercel 环境

除现有 Web 变量外，Production 至少配置：

```text
MOBILE_ALLOWED_ORIGIN=capacitor://localhost
IOS_MINIMUM_VERSION=1.0.0
IOS_MAINTENANCE_MODE=false
APNS_TEAM_ID=...
APNS_KEY_ID=...
APNS_PRIVATE_KEY_BASE64=...
APNS_BUNDLE_ID=com.coffeebar.app
APNS_ENVIRONMENT=production
NEXT_PUBLIC_SUPPORT_EMAIL=...
```

APNs 私钥应在可信环境中 Base64 编码后写入 Vercel。日志不得记录 Bearer Token、密码、手机号或 APNs Token 原文。

## 构建本地 bundle

在 `mobile/.env.production.local` 填入公开构建变量（该文件被 Git 忽略）：

```text
VITE_API_BASE_URL=https://生产域名
VITE_APP_VERSION=1.0.0
VITE_BUILD_NUMBER=1
VITE_APNS_ENVIRONMENT=PRODUCTION
```

三个分析平台仅填写公开客户端标识；若不配置，对应 SDK 不会初始化。然后运行：

```bash
npm install
npm run mobile:test
npm run mobile:sync
```

确认 `mobile/capacitor.config.ts` 没有 `server.url`。每次修改移动端前端或 Capacitor 插件后都要重新执行 `npm run mobile:sync`。

## Xcode Archive 与上传

1. 打开 `mobile/ios/App/App.xcodeproj`。
2. 选择 CoffeeBar target，确认 Marketing Version 与 `VITE_APP_VERSION` 一致，Build 与 `VITE_BUILD_NUMBER` 一致且每次上传递增。
3. 在真机检查 Keychain 会话恢复、深链与 APNs development 环境。
4. 选择 Generic iOS Device，执行 Product → Archive。
5. 在 Organizer 中 Validate App，再 Distribute App → App Store Connect → Upload。
6. App Store Connect 完成处理后，将构建加入内部测试组；提供可用审核账号、隐私政策 URL 与支持 URL。

## 发布顺序

1. 部署兼容 Web 的服务层、认证与 `/api/v1`。
2. 运行 `npm run db:deploy`，仅应用已审核的增量迁移。
3. 执行 Web 回归及 API 验证。
4. 构建并同步本地移动 bundle。
5. 真机验证后上传 TestFlight。

## 真机验收清单

- 首次安装展示分析授权；拒绝后不初始化分析 SDK，且仍能正常浏览和下单。
- 登录后强制结束并重启 App，会话从 Keychain 恢复；两类购物车保持不变。
- 飞行模式下可浏览缓存和编辑购物车，结算、充值和已读操作被明确禁用；恢复网络后自动刷新。
- 冷启动与前台状态分别验证 `coffeebar://orders/:id`、`coffeebar://messages/:id`；受保护链接登录后回到原目标。
- 完成首单后才请求推送权限；拒绝不影响下单。
- 分别验证 APNs development 与 production；点击订单通知进入正确订单。
- 后台将订单推进到 PREPARING、READY、COMPLETED，状态成功保存；推送失败不回滚订单。
- 退出登录解绑当前 deviceId；账户删除要求当前密码和二次确认，完成后会话失效。
- 将 `IOS_MAINTENANCE_MODE` 临时设为 true 验证维护门禁；提高 `IOS_MINIMUM_VERSION` 验证强制更新门禁，随后恢复生产值。

## 当前发布门禁

当前机器只有 Command Line Tools，无法执行 `xcodebuild`、Archive、签名或 TestFlight 上传。安装完整 Xcode 并配置 Apple Developer 资源后才能完成上述真机步骤。当前支付与充值仍为模拟能力，只用于开发和 TestFlight；接入真实支付并完成订单留存政策前，不提交正式 App Store 审核。
