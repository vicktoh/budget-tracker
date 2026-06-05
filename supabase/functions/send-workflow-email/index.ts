import { corsHeaders, jsonResponse } from "../_shared/http.ts";
import { requireAuthenticatedUser } from "../_shared/auth.ts";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { user } = await requireAuthenticatedUser(request);

    return jsonResponse({
      status: "accepted",
      actor_id: user.id,
      message:
        "Workflow email delivery will be implemented with Resend in the notifications phase.",
    });
  } catch (error) {
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 401 },
    );
  }
});
