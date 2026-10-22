import type { Metadata } from "next";
import { AskView } from "@/components/public/ask-view";

export const metadata: Metadata = {
  title: "Ask the data",
  description: "Ask questions about Kano State's health budget in English or Hausa, answered from the official reports.",
};

export default function AskPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--pub-green-deep)]">Ask the data</p>
      <h1 className="font-display mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">Ask a question about the health budget</h1>
      <p className="mt-4 max-w-2xl text-lg leading-relaxed text-[var(--pub-ink-2)]">
        In English or Hausa. Answers come only from the published Budget Performance Reports, with a chart where it helps and a
        link to the page each figure comes from.
      </p>
      <div className="mt-8">
        <AskView />
      </div>
    </div>
  );
}
