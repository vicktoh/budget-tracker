import type { Metadata } from "next";
import { AskView } from "@/components/public/ask-view";
import { PageHero } from "@/components/public/page-hero";

export const metadata: Metadata = {
  title: "Ask AI",
  description: "Ask questions about Kano State's health budget in English or Hausa, answered from the official reports.",
};

export default function AskPage() {
  return (
    <>
      <PageHero eyebrow="Ask AI" title="Ask a question about the health budget">
        In English or Hausa. Answers come only from the published Budget Performance Reports, with a chart where it helps and the
        report and page each figure comes from.
      </PageHero>
    <div className="mx-auto max-w-4xl px-4 pb-14 sm:px-6">
      <div className="mt-8">
        <AskView />
      </div>
    </div>
    </>
  );
}
