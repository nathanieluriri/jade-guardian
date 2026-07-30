"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

type AdminTransitionState = {
  activeRouteKey: string;
  phase: "idle" | "exiting" | "entering";
  transitionId: number;
};

type AdminTransitionContextValue = AdminTransitionState & {
  beginRouteChange: (routeKey: string) => void;
  markEntering: (transitionId: number) => void;
  markEntered: (transitionId: number) => void;
};

const AdminTransitionContext = createContext<AdminTransitionContextValue | null>(null);

export function AdminTransitionProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AdminTransitionState>({
    activeRouteKey: "",
    phase: "idle",
    transitionId: 0,
  });

  const beginRouteChange = useCallback((routeKey: string) => {
    setState((current) => {
      return {
        activeRouteKey: routeKey,
        phase: "exiting",
        transitionId: current.transitionId + 1,
      };
    });
  }, []);

  const markEntering = useCallback((transitionId: number) => {
    setState((current) => {
      if (current.transitionId !== transitionId) return current;
      return {
        ...current,
        phase: "entering",
      };
    });
  }, []);

  const markEntered = useCallback((transitionId: number) => {
    setState((current) => {
      if (current.transitionId !== transitionId) return current;
      return {
        ...current,
        phase: "idle",
      };
    });
  }, []);

  const value = useMemo(
    () => ({
      ...state,
      beginRouteChange,
      markEntering,
      markEntered,
    }),
    [beginRouteChange, markEntered, markEntering, state]
  );

  return <AdminTransitionContext.Provider value={value}>{children}</AdminTransitionContext.Provider>;
}

export function useAdminTransition() {
  const context = useContext(AdminTransitionContext);
  if (!context) {
    throw new Error("useAdminTransition must be used within AdminTransitionProvider");
  }
  return context;
}
