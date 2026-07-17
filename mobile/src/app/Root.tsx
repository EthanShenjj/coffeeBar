import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import type { AuthController } from "../auth/auth-controller";
import { AppRoutes } from "./App";
import { useAuthSnapshot } from "./use-auth";

export function Root({ auth, queryClient }: { auth: AuthController; queryClient: QueryClient }) {
  const snapshot = useAuthSnapshot(auth);
  return <QueryClientProvider client={queryClient}><BrowserRouter><AppRoutes auth={snapshot} controller={auth} /></BrowserRouter></QueryClientProvider>;
}
