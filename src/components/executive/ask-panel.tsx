"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { ArrowUpIcon, CloudOffIcon, RotateCcwIcon, SparklesIcon, XIcon } from "lucide-react";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent } from "@/components/ai-elements/message";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Button } from "@/components/ui/button";
import {
  AssistantAvatar,
  AssistantMessageParts,
  describeChatError,
} from "@/routes/assistant";
import type { AssistantUIMessage } from "@/lib/assistant/agent";
import { cn } from "@/lib/utils";

export const EXAMPLE_QUESTIONS = [
  "How is the immunization programme performing?",
  "Show actual immunization spending versus budget.",
  "Which MDAs have not reported their expenses?",
  "Which MDAs or programmes are not being funded?",
  "Compare personnel and overhead expenditure.",
  "Generate a quarterly budget-performance report.",
];

const QUEUE_KEY = "exec-ask-queue";

type AskContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  ask: (question: string) => void;
  online: boolean;
  queued: string[];
};

const AskContext = React.createContext<AskContextValue | null>(null);

const NO_ASK: AskContextValue = {
  open: false,
  setOpen: () => {},
  ask: () => {},
  online: true,
  queued: [],
};

/** Outside <AskProvider> (e.g. isolated tests) asking is a harmless no-op. */
export function useAsk(): AskContextValue {
  return React.useContext(AskContext) ?? NO_ASK;
}

function readQueue(): string[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}

function writeQueue(queue: string[]) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // Storage unavailable — the queue just won't survive a reload.
  }
}

/**
 * Hosts one assistant conversation for every /admin page, so a question asked
 * on the overview keeps its answer while the Commissioner drills into an MDA.
 * Questions asked offline are queued on the device and sent on reconnect.
 */
export function AskProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const [online, setOnline] = React.useState(true);
  const [queued, setQueued] = React.useState<string[]>([]);
  const [transport] = React.useState(() => new DefaultChatTransport({ api: "/api/chat" }));
  // Throttle streamed message updates: long table/chart answers otherwise push
  // one state update per chunk and trip React's nested-update limit.
  const chat = useChat<AssistantUIMessage>({ transport, throttle: 80 });
  const { sendMessage } = chat;

  React.useEffect(() => {
    setOnline(navigator.onLine);
    setQueued(readQueue());
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);

  // Flush questions queued while offline once the connection returns.
  React.useEffect(() => {
    if (!online || queued.length === 0) return;
    const [next, ...rest] = queued;
    setQueued(rest);
    writeQueue(rest);
    setOpen(true);
    void sendMessage({ text: next });
  }, [online, queued, sendMessage]);

  const ask = React.useCallback(
    (question: string) => {
      const text = question.trim();
      if (!text) return;
      setOpen(true);
      if (!navigator.onLine) {
        setQueued((current) => {
          const next = [...current, text];
          writeQueue(next);
          return next;
        });
        return;
      }
      void sendMessage({ text });
    },
    [sendMessage],
  );

  const value = React.useMemo(
    () => ({ open, setOpen, ask, online, queued }),
    [open, ask, online, queued],
  );

  return (
    <AskContext.Provider value={value}>
      <div className={cn("transition-[padding]", open && "xl:pr-[460px]")}>{children}</div>
      <AskDock chat={chat} />
    </AskContext.Provider>
  );
}

function AskDock({ chat }: { chat: ReturnType<typeof useChat<AssistantUIMessage>> }) {
  const { open, setOpen, ask, online, queued } = useAsk();
  const router = useRouter();
  const [draft, setDraft] = React.useState("");
  const { messages, status, error, stop, setMessages } = chat;
  const generating = status === "submitted" || status === "streaming";
  const showThinking =
    status === "submitted" || (status === "streaming" && messages.at(-1)?.role !== "assistant");

  // Keep in-app links from answers inside the SPA so the conversation survives.
  const onClickCapture = (event: React.MouseEvent) => {
    const anchor = (event.target as HTMLElement).closest("a");
    const href = anchor?.getAttribute("href");
    if (anchor && href && href.startsWith("/")) {
      event.preventDefault();
      router.push(href);
    }
  };

  if (!open) return null;

  return (
    <aside
      aria-label="Ask the assistant"
      className="fixed inset-y-0 right-0 z-40 flex w-full flex-col border-l bg-background shadow-2xl sm:w-[460px]"
    >
      <header className="flex items-center justify-between gap-2 border-b px-4 py-3">
        <div className="flex items-center gap-2.5">
          <AssistantAvatar />
          <div className="flex flex-col">
            <span className="text-sm font-semibold">Ask about the budget</span>
            <span className="text-xs text-muted-foreground">
              Same figures as the dashboard · live data
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 ? (
            <Button
              size="icon"
              variant="ghost"
              aria-label="New conversation"
              onClick={() => setMessages([])}
            >
              <RotateCcwIcon className="size-4" />
            </Button>
          ) : null}
          <Button size="icon" variant="ghost" aria-label="Close" onClick={() => setOpen(false)}>
            <XIcon className="size-4" />
          </Button>
        </div>
      </header>

      {!online || queued.length > 0 ? (
        <div className="flex items-center gap-2 border-b bg-status-pending-bg px-4 py-2 text-xs text-status-pending">
          <CloudOffIcon className="size-3.5 shrink-0" />
          {online
            ? `Sending ${queued.length} queued question${queued.length === 1 ? "" : "s"}…`
            : `Offline — the assistant needs a connection. ${
                queued.length
                  ? `${queued.length} question${queued.length === 1 ? " is" : "s are"} queued and will be answered on reconnect.`
                  : "Questions you ask now will be queued."
              }`}
        </div>
      ) : null}

      <div className="min-h-0 flex-1" onClickCapture={onClickCapture}>
        <Conversation className="h-full">
          <ConversationContent className="gap-5 px-4 py-5">
            {messages.length === 0 ? (
              <div className="flex flex-col gap-2">
                <p className="text-sm text-muted-foreground">Try one of these:</p>
                {EXAMPLE_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => ask(q)}
                    className="focus-ring rounded-lg border bg-card px-3 py-2 text-left text-sm hover:border-primary/40 hover:bg-primary/5"
                  >
                    {q}
                  </button>
                ))}
              </div>
            ) : (
              messages.map((message) =>
                message.role === "assistant" ? (
                  <Message className="max-w-full" from="assistant" key={message.id}>
                    <div className="flex min-w-0 flex-1 flex-col gap-2 text-sm">
                      <AssistantMessageParts message={message} />
                    </div>
                  </Message>
                ) : (
                  <Message from={message.role} key={message.id}>
                    <MessageContent className="group-[.is-user]:rounded-xl group-[.is-user]:rounded-br-sm group-[.is-user]:bg-primary group-[.is-user]:text-primary-foreground">
                      {message.parts.map((part, i) =>
                        part.type === "text" ? <span key={i}>{part.text}</span> : null,
                      )}
                    </MessageContent>
                  </Message>
                ),
              )
            )}
            {showThinking ? <Shimmer className="text-sm">Looking at the figures…</Shimmer> : null}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>
      </div>

      <form
        className="border-t p-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (generating) return;
          ask(draft);
          setDraft("");
        }}
      >
        {error ? (
          <p className="pb-2 text-xs text-destructive" role="alert">
            {describeChatError(error)}
          </p>
        ) : null}
        <div className="flex items-end gap-2 rounded-xl border bg-card p-2 focus-within:ring-2 focus-within:ring-ring">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
            rows={2}
            placeholder="Ask about any MDA, programme or report…"
            className="min-h-[2.5rem] flex-1 resize-none bg-transparent px-1 text-sm outline-none"
          />
          {generating ? (
            <Button type="button" size="sm" variant="outline" onClick={() => stop()}>
              Stop
            </Button>
          ) : (
            <Button type="submit" size="icon" aria-label="Ask" disabled={!draft.trim()}>
              <ArrowUpIcon className="size-4" />
            </Button>
          )}
        </div>
      </form>
    </aside>
  );
}

/** The prominent "Ask" hero for the top of the executive overview. */
export function AskHero() {
  const { ask, online } = useAsk();
  const [draft, setDraft] = React.useState("");
  return (
    <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-card to-card p-4 md:p-5">
      <form
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          ask(draft);
          setDraft("");
        }}
      >
        <label htmlFor="exec-ask" className="flex items-center gap-2 text-sm font-semibold">
          <SparklesIcon className="size-4 text-primary" />
          Ask about any MDA, programme or report
          {!online ? (
            <span className="ml-auto inline-flex items-center gap-1 text-xs font-normal text-status-pending">
              <CloudOffIcon className="size-3" /> Offline — questions will be queued
            </span>
          ) : null}
        </label>
        <div className="flex gap-2">
          <input
            id="exec-ask"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="e.g. Which MDAs have not reported their expenses?"
            className="h-11 flex-1 rounded-lg border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <Button type="submit" className="h-11 px-5" disabled={!draft.trim()}>
            Ask
          </Button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {EXAMPLE_QUESTIONS.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => ask(q)}
              className="focus-ring rounded-full border bg-background px-3 py-1 text-xs text-muted-foreground hover:border-primary/40 hover:text-foreground"
            >
              {q}
            </button>
          ))}
        </div>
      </form>
    </div>
  );
}
