import { useSyncExternalStore } from "react";
import type { AuthController } from "../auth/auth-controller";

export function useAuthSnapshot(auth: AuthController) {
  return useSyncExternalStore(auth.subscribe, auth.getSnapshot, auth.getSnapshot);
}
