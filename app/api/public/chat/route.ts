import { createAgentUIStreamResponse, type UIMessage } from "ai";
import { NextResponse } from "next/server";
import { createPublicAssistantAgent, PUBLIC_ASSISTANT_MODEL } from "@/lib/public/assistant";
import { MAX_USER_TURNS, checkGuards, logExchange, verifyTurnstile, visitorHash } from "@/lib/public/assistant-guard";
import { loadPublicDataset, reportPdfUrl } from "@/lib/public/dataset";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

function textOf(message: UIMessage | undefined): string {
  return (message?.parts ?? [])
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("\n")
    .trim();
}

/**
 * Anonymous "Ask the data" endpoint. No sign-in; the agent's tools read only
 * the published dataset. Guardrails live in src/lib/public/assistant-guard.ts.
 */
export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "The assistant is not available right now." }, { status: 503 });
  }
  const body = (await request.json().catch(() => null)) as { id?: string; messages?: UIMessage[] } | null;
  const messages = Array.isArray(body?.messages) ? body!.messages : [];
  if (!messages.length) return NextResponse.json({ error: "Ask a question to get started." }, { status: 400 });

  const conversationId = typeof body?.id === "string" ? body.id : "unknown";
  const question = textOf(messages.at(-1));
  const visitor = visitorHash(request);
  const userTurns = messages.filter((m) => m.role === "user").length;

  if (!question || question.length > 1500) {
    return NextResponse.json({ error: "Please ask a shorter question (up to about 1,500 characters)." }, { status: 400 });
  }
  if (userTurns > MAX_USER_TURNS) {
    return NextResponse.json({ error: "This conversation is long enough. Start a new one to keep answers quick and accurate." }, { status: 400 });
  }
  if (!(await verifyTurnstile(request.headers.get("x-turnstile-token"), request))) {
    await logExchange({ visitor, conversationId, question, status: "rejected" });
    return NextResponse.json({ error: "We could not confirm you are a person. Refresh the page and try again." }, { status: 403 });
  }

  const guard = await checkGuards(visitor);
  if (!guard.ok) {
    await logExchange({ visitor, conversationId, question, status: guard.reason });
    return NextResponse.json({ error: guard.message }, { status: guard.status });
  }

  const ds = await loadPublicDataset();
  const agent = createPublicAssistantAgent(ds, (r) => reportPdfUrl(r));
  let inputTokens = 0;
  let outputTokens = 0;

  return createAgentUIStreamResponse({
    agent,
    // Only the conversation's text and tool parts travel; history is capped above.
    uiMessages: messages,
    onStepEnd: (step) => {
      inputTokens += step.usage?.inputTokens ?? 0;
      outputTokens += step.usage?.outputTokens ?? 0;
    },
    onEnd: async ({ responseMessage, isAborted }) => {
      await logExchange({
        visitor,
        conversationId,
        question,
        answer: textOf(responseMessage),
        model: PUBLIC_ASSISTANT_MODEL,
        inputTokens,
        outputTokens,
        status: isAborted ? "error" : "ok",
      });
    },
    onError: () => "Something went wrong while answering. Please try again.",
  });
}
