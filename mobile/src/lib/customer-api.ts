import {
  announcementDetailSchema,
  announcementSummarySchema,
  appConfigSchema,
  checkoutResultSchema,
  giftCardSummarySchema,
  giftCardRechargeResultSchema,
  orderDetailSchema,
  orderSummarySchema,
  profileDashboardSchema,
  type CheckoutRequestInput,
  type GiftCardRechargeInput,
} from "@coffeebar/contracts";
import { z } from "zod";
import type { ApiClient } from "./api-client";
import type { createNetworkStore } from "../state/network-store";

const readResultSchema = z.object({ read: z.boolean() }).strict();

export function createCustomerApi(api: ApiClient, network: ReturnType<typeof createNetworkStore>) {
  return {
    appConfig: () => api.get("/api/v1/app-config", { schema: appConfigSchema, authenticated: false }),
    announcements: () => api.get("/api/v1/announcements", { schema: z.array(announcementSummarySchema), authenticated: false }),
    announcement: (id: string) => api.get(`/api/v1/announcements/${encodeURIComponent(id)}`, { schema: announcementDetailSchema, authenticated: false }),
    dashboard: () => api.get("/api/v1/me/dashboard", { schema: profileDashboardSchema }),
    orders: () => api.get("/api/v1/me/orders", { schema: z.array(orderSummarySchema) }),
    order: (id: string) => api.get(`/api/v1/me/orders/${encodeURIComponent(id)}`, { schema: orderDetailSchema }),
    giftCard: () => api.get("/api/v1/me/gift-card", { schema: giftCardSummarySchema }),
    checkout(input: CheckoutRequestInput) {
      network.getState().requireOnline("checkout");
      return api.post("/api/v1/checkout", input, { schema: checkoutResultSchema });
    },
    recharge(input: GiftCardRechargeInput) {
      network.getState().requireOnline("recharge");
      return api.post("/api/v1/gift-card/recharges", input, { schema: giftCardRechargeResultSchema });
    },
    markAnnouncementRead(id: string) {
      network.getState().requireOnline("mark-read");
      return api.post(`/api/v1/me/messages/${encodeURIComponent(id)}/read`, undefined, { schema: readResultSchema });
    },
  };
}

export type CustomerApi = ReturnType<typeof createCustomerApi>;
