"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { MessageCircleQuestionIcon } from "lucide-react";
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
import {
  Suggestion,
  Suggestions,
} from "@/components/ai-elements/suggestion";
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from "@/components/ai-elements/tool";
import type { AssistantUIMessage } from "@/lib/assistant/agent";

/** The chat route returns JSON error bodies; unwrap them for display. */
function formatChatError(error: Error): string {
  try {
    const parsed = JSON.parse(error.message) as { error?: string };
    if (parsed && typeof parsed.error === "string") return parsed.error;
  } catch {
    // Not JSON — show the message as-is.
  }
  return error.message;
}

const SUGGESTIONS = [
  "What did we spend this quarter, by category?",
  "Show budget vs actual by MDA for this fiscal year",
  "Which funding sources contributed the most this year?",
  "Are there expenditure entries not linked to any funding?",
];

type QueryToolPart = Extract<
  AssistantUIMessage["parts"][number],
  { type: "tool-queryDatabase" }
>;

function QueryToolCard({ part }: { part: QueryToolPart }) {
  const table =
    part.state === "input-available" || part.state === "output-available"
      ? part.input.table
      : undefined;

  return (
    <Tool>
      <ToolHeader
        state={part.state}
        title={table ? `Query: ${table}` : "Database query"}
        type={part.type}
      />
      <ToolContent>
        {part.input === undefined ? null : <ToolInput input={part.input} />}
        <ToolOutput
          errorText={part.state === "output-error" ? part.errorText : undefined}
          output={part.state === "output-available" ? part.output : undefined}
        />
      </ToolContent>
    </Tool>
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
      <div className="flex max-w-3xl flex-col gap-1 pb-4">
        <h1 className="text-2xl font-bold tracking-normal">Assistant</h1>
        <p className="text-sm text-muted-foreground">
          Ask questions about funding, expenditure, budgets, and reports. The
          assistant queries the live database with your own access rights.
        </p>
      </div>

      <Conversation className="min-h-0 flex-1 rounded-lg border bg-card">
        <ConversationContent className="mx-auto w-full max-w-3xl">
          {messages.length === 0 ? (
            <ConversationEmptyState>
              <MessageCircleQuestionIcon className="size-8 text-muted-foreground" />
              <div className="space-y-1">
                <h3 className="text-sm font-medium">Ask the finance assistant</h3>
                <p className="text-sm text-muted-foreground">
                  Answers come from live queries against the database, limited
                  to the data your account can see.
                </p>
              </div>
              <Suggestions className="justify-center">
                {SUGGESTIONS.map((suggestion) => (
                  <Suggestion
                    key={suggestion}
                    onClick={(text) => void sendMessage({ text })}
                    suggestion={suggestion}
                  />
                ))}
              </Suggestions>
            </ConversationEmptyState>
          ) : (
            messages.map((message) => (
              <Message from={message.role} key={message.id}>
                <MessageContent>
                  {message.parts.map((part, index) => {
                    switch (part.type) {
                      case "text":
                        return (
                          <MessageResponse key={`${message.id}-${index}`}>
                            {part.text}
                          </MessageResponse>
                        );
                      case "tool-queryDatabase":
                        return (
                          <QueryToolCard
                            key={part.toolCallId}
                            part={part}
                          />
                        );
                      default:
                        return null;
                    }
                  })}
                </MessageContent>
              </Message>
            ))
          )}
          {showThinking ? <Shimmer>Looking at the data…</Shimmer> : null}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="mx-auto w-full max-w-3xl pt-3">
        {error ? (
          <p className="pb-2 text-sm text-destructive">
            Something went wrong: {formatChatError(error)}
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
          The assistant can make mistakes. Verify important figures in the
          reports.
        </p>
      </div>
    </div>
  );
}
