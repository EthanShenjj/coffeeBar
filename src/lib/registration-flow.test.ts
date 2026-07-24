import { describe, expect, it, vi } from "vitest";
import { completeRegistration } from "@/lib/registration-flow";

describe("registration completion", () => {
  it("clears the registration session and returns to login without consuming the intended route", async () => {
    const signOut = vi.fn(async () => undefined);
    const notifySuccess = vi.fn();
    const navigate = vi.fn();

    await completeRegistration({
      next: "/orders/order-1",
      signOut,
      notifySuccess,
      navigate,
    });

    expect(signOut).toHaveBeenCalledOnce();
    expect(notifySuccess).toHaveBeenCalledOnce();
    expect(navigate).toHaveBeenCalledWith("/login?next=%2Forders%2Forder-1");
  });
});
