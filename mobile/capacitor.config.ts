/// <reference types="@capacitor/push-notifications" />
import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.coffeebar.app",
  appName: "CoffeeBar",
  webDir: "dist",
  ios: {
    backgroundColor: "#ffffff",
    contentInset: "automatic",
    preferredContentMode: "mobile",
  },
  plugins: {
    StatusBar: {
      style: "DARK",
      overlaysWebView: false,
      backgroundColor: "#ffffff",
    },
    Keyboard: {
      resize: "body",
      style: "LIGHT",
      resizeOnFullScreen: true,
    },
    SplashScreen: {
      launchShowDuration: 800,
      launchAutoHide: true,
      backgroundColor: "#ffffff",
      showSpinner: false,
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "banner", "list"],
    },
  },
};

export default config;

