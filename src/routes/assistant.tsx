"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import {
  BarChart3Icon,
  CheckCircle2Icon,
  LandmarkIcon,
  PieChartIcon,
  SearchCheckIcon,
  SparklesIcon,
  XCircleIcon,
} from "lucide-react";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
  type PromptInputMessage,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { AssistantChartCard } from "@/components/assistant/chart-card";
import { Badge } from "@/components/ui/badge";
import type { AssistantUIMessage } from "@/lib/assistant/agent";
import { cn } from "@/lib/utils";

/** Chat transport errors carry the route's JSON body in error.message. */
function describeChatError(error: Error): string {
  try {
    const parsed = JSON.parse(error.message) as { error?: unknown };
    if (parsed && typeof parsed.error === "string") return parsed.error;
  } catch {
    // Not JSON — fall through to the raw message.
  }
  return error.message || "The assistant is unavailable right now.";
}

const SUGGESTIONS = [
  {
    icon: BarChart3Icon,
    label: "Spending overview",
    prompt: "What did we spend this quarter? Break it down by category with a chart.",
  },
  {
    icon: LandmarkIcon,
    label: "Budget vs actual",
    prompt: "Show budget vs actual by MDA for this fiscal year, with a chart.",
  },
  {
    icon: PieChartIcon,
    label: "Funding sources",
    prompt: "Which funding sources contributed the most this year? Visualize their shares.",
  },
  {
    icon: SearchCheckIcon,
    label: "Data quality",
    prompt: "Are there expenditure entries not linked to any funding source?",
  },
] as const;

type MessagePart = AssistantUIMessage["parts"][number];
type QueryToolPart = Extract<MessagePart, { type: "tool-queryDatabase" }>;
type ChartToolPart = Extract<MessagePart, { type: "tool-renderChart" }>;

function QueryToolStatus({ part }: { part: QueryToolPart }) {
  const table =
    part.state === "input-available" || part.state === "output-available"
      ? part.input.table
      : undefined;

  if (part.state === "output-error") {
    return (
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <XCircleIcon className="size-3.5 text-destructive" />
        {table ? `Query on ${table} failed` : "A database query failed"} —
        retrying another way
      </p>
    );
  }

  if (part.state === "output-available") {
    const output = part.output as {
      rowCount?: number;
      matchingRows?: number;
      error?: string;
    };
    if (output?.error) {
      return (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <XCircleIcon className="size-3.5 text-destructive" />
          Query on {table} failed — retrying another way
        </p>
      );
    }
    const rows = output?.matchingRows ?? output?.rowCount;
    return (
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <CheckCircle2Icon className="size-3.5 text-primary" />
        Queried {table}
        {typeof rows === "number"
          ? ` · ${rows.toLocaleString("en-NG")} row${rows === 1 ? "" : "s"}`
          : null}
      </p>
    );
  }

  return (
    <Shimmer className="text-xs">
      {table ? `Querying ${table}…` : "Querying the database…"}
    </Shimmer>
  );
}

function ChartToolPartView({ part }: { part: ChartToolPart }) {
  if (part.state === "input-available" || part.state === "output-available") {
    return <AssistantChartCard spec={part.input} />;
  }
  if (part.state === "output-error") {
    return (
      <p className="text-xs text-destructive">
        Could not render the chart: {part.errorText}
      </p>
    );
  }
  return <Shimmer className="text-sm">Preparing chart…</Shimmer>;
}

function AssistantMessageParts({ message }: { message: AssistantUIMessage }) {
  return (
    <>
      {message.parts.map((part, index) => {
        const key = `${message.id}-${index}`;
        switch (part.type) {
          case "text":
            return <MessageResponse key={key}>{part.text}</MessageResponse>;
          case "tool-queryDatabase":
            return <QueryToolStatus key={part.toolCallId} part={part} />;
          case "tool-renderChart":
            return <ChartToolPartView key={part.toolCallId} part={part} />;
          default:
            return null;
        }
      })}
    </>
  );
}

function AssistantAvatar({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex size-7 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary",
        className,
      )}
    >
      <SparklesIcon className="size-3.5" />
    </div>
  );
}

export function AssistantRoute() {
  const { messages, sendMessage, status, stop, error } =
    useChat<AssistantUIMessage>({
      transport: new DefaultChatTransport({ api: "/api/chat" }),
    });

  const isGenerating = status === "submitted" || status === "streaming";

  const handleSubmit = (message: PromptInputMessage) => {
    const text = message.text.trim();
    if (!text || isGenerating) return;
    void sendMessage({ text });
  };

  const lastMessage = messages.at(-1);
  const showThinking =
    status === "submitted" ||
    (status === "streaming" && lastMessage?.role !== "assistant");

  return (
    <div className="flex h-[calc(100dvh-5.5rem)] flex-col md:h-[calc(100dvh-6.5rem)]">
      <div className="flex items-start justify-between gap-4 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
            <SparklesIcon className="size-5" />
          </div>
          <div className="flex flex-col">
            <h1 className="text-xl font-bold tracking-normal">Assistant</h1>
            <p className="text-sm text-muted-foreground">
              Answers from the live database, scoped to your access.
            </p>
          </div>
        </div>
        <Badge className="hidden shrink-0 gap-1.5 sm:inline-flex" variant="outline">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-60" />
            <span className="relative inline-flex size-2 rounded-full bg-primary" />
          </span>
          Live data
        </Badge>
      </div>

      <Conversation className="min-h-0 flex-1 rounded-xl border bg-muted/25">
        <ConversationContent className="mx-auto w-full max-w-3xl gap-6 px-4 py-6 md:px-6">
          {messages.length === 0 ? (
            <ConversationEmptyState>
              <div className="flex size-14 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                <SparklesIcon className="size-7" />
              </div>
              <div className="max-w-md space-y-1.5">
                <h2 className="text-base font-semibold">
                  Ask anything about the numbers
                </h2>
                <p className="text-sm text-muted-foreground">
                  Funding, expenditure, budgets, AOP activities, reports — the
                  assistant queries the database live and only sees data your
                  account can see.
                </p>
              </div>
              <div className="mt-2 grid w-full max-w-lg grid-cols-1 gap-2 sm:grid-cols-2">
                {SUGGESTIONS.map(({ icon: Icon, label, prompt }) => (
                  <button
                    className="focus-ring group flex items-center gap-2.5 rounded-lg border bg-card px-3.5 py-3 text-left text-sm transition-colors hover:border-primary/40 hover:bg-primary/5"
                    key={label}
                    onClick={() => void sendMessage({ text: prompt })}
                    type="button"
                  >
                    <Icon className="size-4 shrink-0 text-primary" />
                    <span className="min-w-0">
                      <span className="block font-medium">{label}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {prompt}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </ConversationEmptyState>
          ) : (
            messages.map((message) =>
              message.role === "assistant" ? (
                <Message
                  className="max-w-full"
                  from={message.role}
                  key={message.id}
                >
                  <div className="flex w-full gap-3">
                    <AssistantAvatar className="mt-0.5" />
                    <div className="flex min-w-0 flex-1 flex-col gap-2 pt-0.5 text-sm">
                      <AssistantMessageParts message={message} />
                    </div>
                  </div>
                </Message>
              ) : (
                <Message from={message.role} key={message.id}>
                  <MessageContent className="group-[.is-user]:bg-primary group-[.is-user]:text-primary-foreground group-[.is-user]:rounded-xl group-[.is-user]:rounded-br-sm">
                    {message.parts.map((part, index) =>
                      part.type === "text" ? (
                        <span key={`${message.id}-${index}`}>{part.text}</span>
                      ) : null,
                    )}
                  </MessageContent>
                </Message>
              ),
            )
          )}
          {showThinking ? (
            <div className="flex gap-3">
              <AssistantAvatar className="mt-0.5" />
              <Shimmer className="pt-1 text-sm">Looking at the data…</Shimmer>
            </div>
          ) : null}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="mx-auto w-full max-w-3xl pt-3">
        {error ? (
          <p className="pb-2 text-sm text-destructive" role="alert">
            {describeChatError(error)}
          </p>
        ) : null}
        <PromptInput onSubmit={handleSubmit}>
          <PromptInputBody>
            <PromptInputTextarea placeholder="Ask about funding, expenditure, budgets…" />
          </PromptInputBody>
          <PromptInputFooter>
            <PromptInputTools />
            <PromptInputSubmit onStop={stop} status={status} />
          </PromptInputFooter>
        </PromptInput>
        <p className="pt-2 text-center text-xs text-muted-foreground">
          The assistant reads live data with your permissions and can make
          mistakes — verify important figures in Reports.
        </p>
      </div>
    </div>
  );
}
