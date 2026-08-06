import { createAgentUIStreamResponse } from "ai";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadProfileForUser } from "@/lib/db/memberships";
import { createAssistantAgent } from "@/lib/assistant/agent";

export const maxDuration = 120;

/**
 * Assistant chat endpoint. Unlike the admin routes, this deliberately uses
 * the cookie-scoped Supabase client (never the service role): every tool
 * call the agent makes runs under the caller's own JWT, so row-level
 * security gives the assistant exactly the same visibility as the user.
 */
export async function POST(request: Request) {
  if (!process.env.AI_GATEWAY_API_KEY) {
    return NextResponse.json(
      { error: "Assistant is not configured (missing AI_GATEWAY_API_KEY)." },
      { status: 503 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    messages?: unknown[];
  } | null;

  if (!body || !Array.isArray(body.messages) || body.messages.length === 0) {
    return NextResponse.json(
      { error: "Request must include a non-empty messages array." },
      { status: 400 },
    );
  }

  const profile = await loadProfileForUser(supabase, user);
  const agent = createAssistantAgent({ supabase, profile });

  return createAgentUIStreamResponse({
    agent,
    uiMessages: body.messages,
  });
}
