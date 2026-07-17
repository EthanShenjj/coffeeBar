# ThinkingData A/B SDK

CoffeeBar 的 A/B 能力由 `src/lib/thinkingdata-ab-sdk.ts` 提供。它是对 ThinkingData Experiment Fetch 协议的项目内封装，不包含或替代 ThinkingData 数据采集 SDK；曝光事件仍由现有 `thinkingdata-browser` 客户端发送。

## 已实现能力

- 使用 `#account_id` 或 `#distinct_id` 作为分流身份，可附带 `#device_id`。
- 通过 `setBucketId` 设置 `#custom_bucketid`，通过 `setCustomFetchParams` 增加 `#app_version` 等自定义参数；协议保留字段不能被覆盖。
- 可一次拉取全部 Feature，或传入 Feature Key 列表。
- 提供通用、String、Double、Boolean、JSON 和全部值读取方法，每个方法都要求业务默认值。
- 同时解析 Feature 内嵌 `experiment_detail` 与顶层 `experiment_detail + feature_list`，兼容新旧字段名。
- 成功结果默认缓存 12 小时；缓存过期时立即返回默认值，并在后台刷新。
- 同一实例的相同并发请求只访问远端一次。
- 自动曝光默认开启，但只在 Getter 实际读取命中实验的 Feature 时触发；也可使用手动曝光。
- 曝光按分流主体、实验 ID、实验组 ID 去重 24 小时。

## 浏览器接入

```ts
import { createThinkingDataAbSdk } from "@/lib/thinkingdata-ab-sdk";

const ab = createThinkingDataAbSdk({
  appId: "your-thinkingdata-app-id",
  identity: () => ({
    accountId: currentUser?.id,
    distinctId: analyticsDistinctId,
    deviceId,
  }),
  storage: window.localStorage,
  fetcher: async (body) => {
    const response = await fetch("/api/thinkingdata/experiment/fetch", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error("experiment fetch failed");
    return response.json();
  },
  trackExposure: (detail) => {
    // 上报 te_experiment_exposure，携带实验、组别、对照组和 bucket 信息。
  },
});

ab.setBucketId({ member_id: currentUser?.id });
ab.setCustomFetchParams({ "#app_version": "1.0.0", country: "CN" });

if (!await ab.restore()) await ab.fetch(["checkout_button_color"]);
const color = ab.getValueAsString("checkout_button_color", "black");
```

`getValueAsString` 执行到此处时才会自动曝光。预读取但不曝光时使用 `peekFeature`。

## 手动曝光

服务端分流或业务需要严格控制曝光时，关闭自动模式：

```ts
const ab = createThinkingDataAbSdk({
  appId: "your-thinkingdata-app-id",
  identity: () => ({ accountId: userId }),
  automaticExposureTracking: false,
  fetcher,
  trackExposure,
});

await ab.fetch(["recommendation_strategy"]);
const strategy = ab.getValueAsString("recommendation_strategy", "default");

// 只有用户真正进入使用该策略的流程后再调用。
ab.expose("recommendation_strategy");
```

## 服务端接入

服务端不能复用客户端的 12 小时 Feature 缓存。`src/lib/thinkingdata-ab-server.ts` 每次调用都实时请求远端，只合并尚未完成的相同并发请求，并且从不自动曝光：

```ts
import { createThinkingDataServerAbSdk } from "@/lib/thinkingdata-ab-server";

const ab = createThinkingDataServerAbSdk({
  lib: "tga_node_sdk",
  fetcher: async (body, signal) => {
    const response = await fetch(process.env.THINKINGDATA_EXPERIMENT_FETCH_URL!, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
    if (!response.ok) throw new Error("experiment fetch failed");
    return response.json();
  },
  trackExposure: ({ identity, experiment, properties }) => {
    // 使用 ThinkingData 服务端数据采集 SDK 上报 te_experiment_exposure。
  },
});

const result = await ab.fetch(
  { accountId: userId, distinctId },
  ["recommendation_strategy"],
  { bucketId: { tenant_id: tenantId } },
);
const strategy = result.getValueAsString("recommendation_strategy", "default");

// 业务真正使用该策略时显式曝光。
result.expose("recommendation_strategy", { endpoint: "checkout" });
```

默认单次请求 500 ms 超时、最多 3 次尝试。曝光按分流主体、实验和组别在内存中去重 1440 分钟，最多保存 10000 条；这些值可以通过 `timeoutMs`、`attempts`、`eventCacheTimeMs` 和 `eventCacheSize` 调整。

服务端文档的请求字段为 `custom_bucketid`，客户端文档为 `#custom_bucketid`，两个 SDK 分别按对应协议发送，避免混用。

## 请求与返回约定

代理接受 JSON 对象，至少包含一个非空的 `#account_id` 或 `#distinct_id`。可选字段包括：

```json
{
  "#account_id": "user-123",
  "#distinct_id": "visitor-456",
  "#device_id": "device-789",
  "#custom_bucketid": { "member_id": "member-123" },
  "#feature_key": ["checkout_button_color"],
  "#app_version": "1.0.0",
  "#lib": "tga_js_sdk"
}
```

`THINKINGDATA_EXPERIMENT_FETCH_URL` 必须配置为 Experiment Fetch 的完整服务地址。该地址只保存在服务端，浏览器不直连实验服务。代理限制请求体为 64 KB、Feature Key 不超过 100 个，不记录身份或分流响应。

## CoffeeBar 现有接入

登录页面通过 `src/lib/thinkingdata-experiment.ts` 使用该 SDK读取 `登录页注册引导文案`：

- 无身份、未配置远端、超时或非法返回时使用原始中英文文案。
- 只有实验文案进入页面状态并实际渲染后才手动曝光。
- 代理端合并完全相同的并发请求，单次远端请求超时 500 ms，最多尝试 3 次。

相关测试位于：

- `src/lib/thinkingdata-ab-sdk.test.ts`
- `src/lib/thinkingdata-ab-server.test.ts`
- `src/lib/thinkingdata-experiment.test.ts`
- `src/app/api/thinkingdata/experiment/fetch/route.test.ts`
