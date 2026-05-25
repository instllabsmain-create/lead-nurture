import Link from "next/link";
import Script from "next/script";

const FALLBACK_CLIENT_ID = "11111111-1111-1111-1111-111111111111";

function getDemoClientId(): string {
  return (
    process.env.APP_CLIENT_ID?.trim()
    || process.env.DEMO_CLIENT_ID?.trim()
    || FALLBACK_CLIENT_ID
  );
}

export default function DemoSitePage() {
  const clientId = getDemoClientId();

  return (
    <>
      <Script
        src="/widget.js"
        strategy="afterInteractive"
        data-client={clientId}
      />

      <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(199,109,45,0.18),_transparent_38%),linear-gradient(180deg,_#f7f0e3_0%,_#fffaf2_100%)] text-pitch">
        <section className="mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-center px-6 py-16 sm:px-10">
          <div className="max-w-3xl">
            <p className="font-mono text-[10px] uppercase tracking-[2.8px] text-dust">
              Demo Website
            </p>
            <h1 className="mt-5 font-display text-5xl font-black uppercase leading-none text-pitch sm:text-7xl">
              Smoke Test Business
            </h1>
            <p className="mt-6 max-w-2xl font-body text-base leading-7 text-dust sm:text-lg">
              This is a dummy customer-facing website for testing the Lead Nurture website widget.
              Use the chat bubble in the bottom-right corner to send a message as a visitor and watch
              it appear inside the Lead Nurture inbox.
            </p>
          </div>

          <div className="mt-10 flex flex-wrap gap-4">
            <Link
              href="/login"
              className="rounded-full bg-pitch px-6 py-3 font-body text-sm font-medium text-parchment transition-opacity hover:opacity-90"
            >
              Open Lead Nurture Login
            </Link>
            <a
              href="#how-it-works"
              className="rounded-full border border-pitch/15 bg-white/70 px-6 py-3 font-body text-sm font-medium text-pitch transition-colors hover:bg-white"
            >
              See Test Steps
            </a>
          </div>

          <div className="mt-14 grid gap-4 md:grid-cols-3">
            {[
              {
                title: "Fast lead replies",
                body: "Visitors can ask about pricing, products, or bookings and receive a response inside the website chat.",
              },
              {
                title: "Shared team inbox",
                body: "Every website message is stored as a lead conversation so the operator can continue it from the dashboard.",
              },
              {
                title: "AI plus human handoff",
                body: "AI can answer first, and a human can take over later from the same lead thread.",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-3xl border border-pitch/10 bg-white/70 p-6 shadow-[0_18px_60px_rgba(41,28,16,0.06)] backdrop-blur"
              >
                <h2 className="font-display text-2xl font-black uppercase text-pitch">
                  {item.title}
                </h2>
                <p className="mt-3 font-body text-sm leading-6 text-dust">
                  {item.body}
                </p>
              </div>
            ))}
          </div>

          <section
            id="how-it-works"
            className="mt-14 rounded-[32px] border border-pitch/10 bg-[#20150f] px-6 py-8 text-parchment shadow-[0_24px_80px_rgba(41,28,16,0.12)] sm:px-8"
          >
            <p className="font-mono text-[10px] uppercase tracking-[2.6px] text-saffron">
              Test Flow
            </p>
            <ol className="mt-5 space-y-4 font-body text-sm leading-6 text-parchment/85">
              <li>1. Open the website widget from the bottom-right corner.</li>
              <li>2. Send a message like “What are your prices?”</li>
              <li>3. Wait a few seconds for the AI reply to appear in the widget.</li>
              <li>4. Open the Lead Nurture dashboard in another tab and check the Inbox.</li>
              <li>5. Confirm the same conversation appears there as a lead thread.</li>
            </ol>
            <p className="mt-5 font-mono text-[11px] text-parchment/60">
              Demo client id: {clientId}
            </p>
          </section>
        </section>
      </main>
    </>
  );
}
