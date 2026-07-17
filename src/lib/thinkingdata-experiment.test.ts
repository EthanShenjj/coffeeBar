import { describe, expect, it } from "vitest";
import {
  buildExperimentFetchBody,
  exposureCacheKey,
  parseLoginCopyEvaluation,
} from "@/lib/thinkingdata-experiment";

describe("ThinkingData experiment integration", () => {
  it("builds the documented fetch body with account and distinct IDs", () => {
    expect(buildExperimentFetchBody({ accountId: "account-1", distinctId: "visitor-1" }, "登录页注册引导文案"))
      .toEqual({
        "#account_id": "account-1",
        "#distinct_id": "visitor-1",
        "#feature_key": ["登录页注册引导文案"],
        "#lib": "tga_js_sdk",
      });
  });

  it("parses feature-scoped experiment details", () => {
    const evaluation = parseLoginCopyEvaluation({
      "登录页注册引导文案": {
        value: JSON.stringify({
          title: "每一杯，都值得被记住。",
          description: "登录或创建账号，保存订单。",
          registration_cta: "免费创建账号",
        }),
        experiment_detail: {
          "#experiment_id": "0138",
          "#experiment_group_id": "treatment",
          "#is_control_group": false,
        },
      },
    });

    expect(evaluation).toEqual({
      value: {
        title: "每一杯，都值得被记住。",
        description: "登录或创建账号，保存订单。",
        registration_cta: "免费创建账号",
      },
      experiment: {
        experimentId: "0138",
        experimentGroupId: "treatment",
        isControlGroup: false,
        bucketId: undefined,
      },
    });
  });

  it("matches top-level experiment details to the requested feature", () => {
    const evaluation = parseLoginCopyEvaluation({
      data: {
        "登录页注册引导文案": {
          title: "欢迎回来。",
          description: "登录后保存订单。",
          registration_cta: "立即注册",
        },
        experiment_detail: [{
          feature_list: ["登录页注册引导文案"],
          experiment_id: "0138",
          experiment_group_id: "control",
          is_control: true,
          bucketid: { "#account_id": "account-1" },
        }],
      },
    });

    expect(evaluation?.experiment).toEqual({
      experimentId: "0138",
      experimentGroupId: "control",
      isControlGroup: true,
      bucketId: { "#account_id": "account-1" },
    });
  });

  it("rejects incomplete copy and creates a stable exposure cache key", () => {
    expect(parseLoginCopyEvaluation({
      "登录页注册引导文案": { title: "missing fields" },
    })).toBeNull();

    expect(exposureCacheKey({
      experimentId: "0138",
      experimentGroupId: "treatment",
      isControlGroup: false,
      bucketId: { "#account_id": "account-1" },
    })).toBe("thinkingdata-exposure:0138:treatment:{\"#account_id\":\"account-1\"}");
  });
});
