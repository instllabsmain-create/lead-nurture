import { NextRequest, NextResponse } from "next/server";

import { createClient, createServiceRoleClient } from "@/lib/supabase/server";

const DEFAULT_DEMO_CLIENT_ID = "11111111-1111-1111-1111-111111111111";
const DEFAULT_DEMO_EMAIL = "smoke-test@example.com";
const DEFAULT_DEMO_NAME = "Smoke Test Business";

function getSafeErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Unknown error";
}

function getRequiredDemoToken(): string | null {
  const token = process.env.DEMO_LOGIN_TOKEN?.trim();

  if (!token) {
    return null;
  }

  return token;
}

function getDemoEmail(): string {
  return process.env.DEMO_LOGIN_EMAIL?.trim() || DEFAULT_DEMO_EMAIL;
}

function getDemoName(): string {
  return process.env.DEMO_LOGIN_NAME?.trim() || DEFAULT_DEMO_NAME;
}

function getDemoClientId(): string {
  return process.env.DEMO_CLIENT_ID?.trim() || DEFAULT_DEMO_CLIENT_ID;
}

function buildDemoConfig(name: string) {
  return {
    business_name: name,
    business_description:
      "We sell and install water purifiers for homes and offices.",
    ideal_customer:
      "Families and small offices in Mumbai who want fast installation.",
    qualification_questions: [
      "What product or service are you looking for?",
      "What is your budget range?",
      "When are you looking to get started?",
      "Where are you located?",
    ],
    scoring: {
      question_answered: 10,
      buying_signal: 15,
      urgency_signal: 20,
      negative_signal: -20,
    },
    routing: {
      type: "human_handoff",
      assignment_threshold: 95,
      handoff_triggers: ["talk to someone", "human", "call me", "speak to"],
      notify_via: ["whatsapp"],
      accept_timeout_minutes: 10,
      fallback: "notify_owner",
    },
    ai: {
      model: "google/gemini-2.5-flash-lite",
      language: "auto",
      response_delay_seconds: 0,
    },
    disabled_features: [],
  };
}

export async function GET(request: NextRequest) {
  const configuredToken = getRequiredDemoToken();
  const providedToken = request.nextUrl.searchParams.get("token")?.trim();

  if (!configuredToken || !providedToken || providedToken !== configuredToken) {
    return NextResponse.redirect(new URL("/login?error=demo_unavailable", request.url));
  }

  try {
    const demoEmail = getDemoEmail();
    const demoName = getDemoName();
    const demoClientId = getDemoClientId();
    const serviceSupabase = createServiceRoleClient();

    const { data: linkData, error: linkError } =
      await serviceSupabase.auth.admin.generateLink({
        type: "magiclink",
        email: demoEmail,
        options: {
          redirectTo: `${request.nextUrl.origin}/auth/callback`,
          data: {
            name: demoName,
          },
        },
      });

    if (linkError || !linkData?.user || !linkData.properties.email_otp) {
      console.error(
        `Demo login link generation failed: ${linkError?.message ?? "Unknown error"}`,
      );
      return NextResponse.redirect(new URL("/login?error=demo_failed", request.url));
    }

    const { error: clientError } = await serviceSupabase.from("clients").upsert(
      {
        id: demoClientId,
        user_id: linkData.user.id,
        name: demoName,
        email: demoEmail,
        onboarding_completed: true,
        config: buildDemoConfig(demoName),
      },
      { onConflict: "id" },
    );

    if (clientError) {
      console.error(`Demo client upsert failed: ${clientError.message}`);
      return NextResponse.redirect(new URL("/login?error=demo_failed", request.url));
    }

    const supabase = await createClient();
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email: demoEmail,
      token: linkData.properties.email_otp,
      type: "email",
    });

    if (verifyError) {
      console.error(`Demo session verification failed: ${verifyError.message}`);
      return NextResponse.redirect(new URL("/login?error=demo_failed", request.url));
    }

    return NextResponse.redirect(new URL("/dashboard", request.url));
  } catch (error) {
    console.error(`Demo login failed: ${getSafeErrorMessage(error)}`);
    return NextResponse.redirect(new URL("/login?error=demo_failed", request.url));
  }
}
