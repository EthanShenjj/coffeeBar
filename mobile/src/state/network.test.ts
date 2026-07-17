import { createNetworkStore, OfflineOperationError } from "./network-store";

describe("network operation guard", () => {
  it.each(["checkout", "recharge", "mark-read"] as const)("blocks %s offline with a presentable message", (operation) => {
    const network = createNetworkStore({ initialOnline: false });
    expect(() => network.getState().requireOnline(operation)).toThrow(OfflineOperationError);
    expect(() => network.getState().requireOnline(operation)).toThrow("网络恢复后再试");
  });

  it("announces recovery and invokes refetch", async () => {
    const refetch = vi.fn(async () => undefined);
    const network = createNetworkStore({ initialOnline: false, onReconnect: refetch });
    await network.getState().setOnline(true);
    expect(network.getState().recoveryNotice).toBe("网络已恢复");
    expect(refetch).toHaveBeenCalledOnce();
  });
});
