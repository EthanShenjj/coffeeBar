import { describe, expect, it, vi } from "vitest";
import {
  OFFICIAL_EXPERIMENT_SCRIPT_SOURCES,
  buildExperimentFetchBody,
  createOfficialExperimentConfig,
  exposureCacheKey,
  initializeOfficialExperimentSdk,
  loadOfficialExperimentSdk,
  parseLoginCopyEvaluation,
  readOfficialLoginCopy,
} from "@/lib/thinkingdata-experiment";

describe("ThinkingData experiment integration", () => {
  it("loads the official Analytics, Remote Config, and Experiment SDKs in dependency order", () => {
    expect(OFFICIAL_EXPERIMENT_SCRIPT_SOURCES).toEqual([
      "/vendor/thinkingdata.umd.min.js",
      "/vendor/tdremoteconfig.umd.min.js",
      "/vendor/tdexperiment.umd.min.js",
    ]);
  });

  it("initializes the official Experiment SDK with automatic exposure tracking", () => {
    expect(createOfficialExperimentConfig({
      appId: "app-1",
      serverUrl: "https://receiver.example.test",
    })).toEqual(expect.objectContaining({
      appId: "app-1",
      serverUrl: "https://receiver.example.test",
      automaticExposureTracking: true,
      enableLog: false,
    }));
  });

  it("reads the JSON login-copy Feature through the official SDK", () => {
    const getValueAsJson = vi.fn(() => ({
      title: "让每一杯，都更懂你。",
      description: "注册 CoffeeBar，保存订单。",
      registration_cta: "免费创建账号",
    }));

    expect(readOfficialLoginCopy({ getValueAsJson })).toEqual({
      value: {
        title: "让每一杯，都更懂你。",
        description: "注册 CoffeeBar，保存订单。",
        registration_cta: "免费创建账号",
      },
    });
    expect(getValueAsJson).toHaveBeenCalledWith("login_registration_copy", expect.objectContaining({
      title: "欢迎回来。",
    }));
  });

  it("waits for the official SDK's first remote-config fetch before reading a Feature", async () => {
    const init = vi.fn((config: Record<string, unknown>) => {
      (config.onFetchSuccess as () => void)();
    });

    await initializeOfficialExperimentSdk({
      init,
      getValueAsJson: vi.fn(),
    }, {
      appId: "app-1",
      serverUrl: "https://receiver.example.test",
    });

    expect(init).toHaveBeenCalledWith(expect.objectContaining({
      automaticExposureTracking: true,
      onFetchSuccess: expect.any(Function),
      onFetchFailure: expect.any(Function),
    }));
  });

  it("initializes Analytics before loading Remote Config and Experiment", async () => {
    const steps: string[] = [];
    const sdk = {
      init: (config: Record<string, unknown>) => {
        (config.onFetchSuccess as () => void)();
      },
      getValueAsJson: vi.fn(),
    };

    expect(await loadOfficialExperimentSdk({
      initializeAnalytics: async () => { steps.push("analytics"); },
      loadScript: async (src) => { steps.push(src); },
      getSdk: () => sdk,
      config: {
        appId: "app-1",
        serverUrl: "https://receiver.example.test",
      },
    })).toBe(sdk);
    expect(steps).toEqual([
      "analytics",
      "/vendor/tdremoteconfig.umd.min.js",
      "/vendor/tdexperiment.umd.min.js",
    ]);
  });

  it("builds the documented fetch body with account and distinct IDs", () => {
    expect(buildExperimentFetchBody({ accountId: "account-1", distinctId: "visitor-1" }, "login_registration_copy"))
      .toEqual({
        "#account_id": "account-1",
        "#distinct_id": "visitor-1",
        "#feature_key": ["login_registration_copy"],
        "#lib": "tga_js_sdk",
      });
  });

  it("parses feature-scoped experiment details", () => {
    const evaluation = parseLoginCopyEvaluation({
      "login_registration_copy": {
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
        "login_registration_copy": {
          title: "欢迎回来。",
          description: "登录后保存订单。",
          registration_cta: "立即注册",
        },
        experiment_detail: [{
          feature_list: ["login_registration_copy"],
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
      "login_registration_copy": { title: "missing fields" },
    })).toBeNull();

    expect(exposureCacheKey({
      experimentId: "0138",
      experimentGroupId: "treatment",
      isControlGroup: false,
      bucketId: { "#account_id": "account-1" },
    })).toBe("thinkingdata-exposure:0138:treatment:{\"#account_id\":\"account-1\"}");
  });
});
