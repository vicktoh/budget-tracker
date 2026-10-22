"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";

type AskContext = {
  open: boolean;
  setOpen: (open: boolean) => void;
  ask: (question?: string) => void;
  pending: string | null;
  takePending: () => string | null;
};

const Ctx = createContext<AskContext | null>(null);

export function useAsk() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAsk must be used inside AskProvider");
  return ctx;
}

export function AskProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const pendingRef = useRef<string | null>(null);
  const ask = useCallback((question?: string) => {
    if (question) {
      pendingRef.current = question;
      setPending(question);
    }
    setOpen(true);
  }, []);
  const takePending = useCallback(() => {
    const q = pendingRef.current;
    pendingRef.current = null;
    setPending(null);
    return q;
  }, []);
  const value = useMemo(() => ({ open, setOpen, ask, pending, takePending }), [open, ask, pending, takePending]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
