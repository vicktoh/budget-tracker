import type { ReactNode } from "react";
import { AskProvider } from "@/components/executive/ask-panel";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <AskProvider>{children}</AskProvider>;
}
