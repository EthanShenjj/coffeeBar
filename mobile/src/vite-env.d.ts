/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_AMPLITUDE_API_KEY?: string;
  readonly VITE_MIXPANEL_PROJECT_TOKEN?: string;
  readonly VITE_THINKINGDATA_APP_ID?: string;
  readonly VITE_THINKINGDATA_SERVER_URL?: string;
  readonly VITE_APP_VERSION?: string;
  readonly VITE_BUILD_NUMBER?: string;
}
