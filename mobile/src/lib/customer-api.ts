import {
  checkoutResultSchema,
  giftCardRechargeResultSchema,
  type CheckoutRequestInput,
  type GiftCardRechargeInput,
} from "@coffeebar/contracts";
import { z } from "zod";
import type { ApiClient } from "./api-client";
import type { createNetworkStore } from "../state/network-store";

const readResultSchema = z.object({ read: z.boolean() }).strict();

export function createCustomerApi(api: ApiClient, network: ReturnType<typeof createNetworkStore>) {
  return {
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
