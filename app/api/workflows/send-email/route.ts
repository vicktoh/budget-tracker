import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/server/auth";

export async function POST(request: Request) {
  try {
    const { user } = await requireAuthenticatedUser(request);

    return NextResponse.json({
      status: "accepted",
      actor_id: user.id,
      message:
        "Workflow email delivery will be implemented with Resend in the notifications phase.",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 401 },
    );
  }
}
