import type { Metadata } from "next";
import Link from "next/link";
import Script from "next/script";
import { DM_Serif_Display } from "next/font/google";
import type { ReactNode } from "react";
import { SiteHeader } from "@/components/public/site-header";
import { PublicMotion } from "@/components/public/motion";
import { AskPanel, AskProvider } from "@/components/public/ask-panel";

const display = DM_Serif_Display({ subsets: ["latin"], variable: "--font-display", weight: "400" });

export const metadata: Metadata = {
  title: {
    absolute: "Kano Health Budget — official health budget figures for Kano State",
    template: "%s · Kano Health Budget",
  },
  description:
    "How much Kano State budgets for health, how much has been spent, and where — from the State's official Budget Performance Reports, every quarter.",
  openGraph: {
    title: "Kano Health Budget",
    description: "Official Kano State health budget and spending figures, every quarter.",
    url: "https://kanohealthbudget.org",
    siteName: "Kano Health Budget",
    type: "website",
  },
};

export default function PublicLayout({ children }: { children: ReactNode }) {
  const beacon = process.env.NEXT_PUBLIC_CF_ANALYTICS_TOKEN;
  return (
    <div className={`public-site ${display.variable} min-h-screen`}>
      <PublicMotion>
        <AskProvider>
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2">
          Skip to content
        </a>
        <SiteHeader />
        <main id="main">{children}</main>
        <SiteFooter />
        <AskPanel />
        </AskProvider>
      </PublicMotion>
      {beacon ? (
        // Cloudflare Web Analytics: cookieless, no personal data, no consent banner needed.
        <Script
          src="https://static.cloudflareinsights.com/beacon.min.js"
          data-cf-beacon={JSON.stringify({ token: beacon })}
          strategy="afterInteractive"
        />
      ) : null}
    </div>
  );
}

function SiteFooter() {
  return (
    <footer className="mt-24 bg-[var(--pub-navy)] text-white/80">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-14 text-sm sm:px-6 md:grid-cols-3 [&_a]:text-white [&_.font-semibold]:text-white">
        <div className="space-y-2">
          <p className="font-display text-2xl text-white">Kano Health Budget</p>
          <p>
            Figures come from the Kano State Government&apos;s quarterly Budget Performance Reports, published by the
            Ministry of Budget and Planning. Amounts are in nominal naira and measured against the original budget.
          </p>
        </div>
        <div className="space-y-2">
          <p className="font-semibold text-white">Use the data</p>
          <p>
            Data on this site is free to reuse under{" "}
            <a className="underline underline-offset-2" href="https://creativecommons.org/licenses/by/4.0/" rel="license noopener" target="_blank">
              CC BY 4.0
            </a>
            . Credit: &ldquo;Kano State Government, Budget Performance Reports, via kanohealthbudget.org&rdquo;.
          </p>
          <p className="flex flex-wrap gap-x-4 gap-y-1">
            <Link className="underline underline-offset-2" href="/explore">Explore</Link>
            <Link className="underline underline-offset-2" href="/data">Download the data</Link>
            <Link className="underline underline-offset-2" href="/reports">All reports</Link>
            <Link className="underline underline-offset-2" href="/data#method">How figures are checked</Link>
          </p>
        </div>
        <div className="space-y-2">
          <p className="font-semibold text-white">For government staff</p>
          <p>MDA finance officers and reviewers record and check entries in the staff workspace.</p>
          <Link className="underline underline-offset-2" href="/sign-in">Staff sign-in</Link>
        </div>
      </div>
    </footer>
  );
}
