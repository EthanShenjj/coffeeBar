import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AppRoutes } from "./App";
import type { AuthSnapshot } from "../auth/auth-controller";

function renderPath(path: string, auth: AuthSnapshot) {
  render(<MemoryRouter initialEntries={[path]}><AppRoutes auth={auth} /></MemoryRouter>);
}

describe("mobile routes", () => {
  it.each(["/", "/menu", "/shop", "/cart/menu", "/login", "/register", "/messages"])("renders public route %s", (path) => {
    renderPath(path, { status: "anonymous", user: null });
    expect(screen.getByRole("main")).toBeInTheDocument();
  });

  it("does not redirect a protected route while session restoration is pending", () => {
    renderPath("/orders", { status: "restoring", user: null });
    expect(screen.getByText("正在恢复登录状态…")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "登录" })).not.toBeInTheDocument();
  });

  it("redirects anonymous protected routes and restores the intended route after login", async () => {
    renderPath("/orders/o1", { status: "anonymous", user: null });
    await waitFor(() => expect(screen.getByRole("heading", { name: "登录" })).toBeInTheDocument());
    expect(window.sessionStorage.getItem("coffeebar.intended-route")).toBe("/orders/o1");
  });

  it.each(["/checkout", "/member", "/orders", "/orders/o1", "/gift-card", "/privacy-account"])("renders protected route %s when authenticated", (path) => {
    renderPath(path, { status: "authenticated", user: { id: "u1", name: "A", email: "a@example.com" } });
    expect(screen.getByRole("main")).toBeInTheDocument();
  });
});
