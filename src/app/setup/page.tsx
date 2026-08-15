import type { Metadata } from "next";
import { demoMode } from "@/lib/data/repo";
import { CheckIcon, ShieldIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Setup",
  robots: { index: false, follow: false },
};

export default function SetupPage() {
  const isDemo = demoMode();

  return (
    <div className="py-12">
      <div className="container-t max-w-3xl">
        <h1 className="text-[clamp(28px,5vw,42px)] font-extrabold tracking-[-.025em]">
          Going live
        </h1>

        <div
          className={`mt-5 flex items-center gap-3 rounded-xl border p-4 ${
            isDemo
              ? "border-gold/30 bg-gold/10 text-gold"
              : "border-green/30 bg-green/10 text-green"
          }`}
        >
          {isDemo ? <ShieldIcon size={18} /> : <CheckIcon size={18} />}
          <span className="text-[14.5px] font-semibold">
            {isDemo
              ? "Running in demo mode — seeded data, in memory, resets on restart."
              : "Connected to Supabase. You're running on a real database."}
          </span>
        </div>

        <div className="legal-prose mt-8">
          <h2>1. Create a Supabase project</h2>
          <p>
            Go to <a href="https://supabase.com">supabase.com</a>, create a free
            project, and choose the region closest to Lagos (currently{" "}
            <strong>eu-west-1, Ireland</strong> — it&apos;s the lowest latency option
            for Nigerian traffic).
          </p>

          <h2>2. Run the migration</h2>
          <p>
            In the Supabase dashboard open <strong>SQL Editor</strong>, paste the
            contents of <code>supabase/migrations/0001_init.sql</code> and run it.
            This creates every table, the row-level security policies, the reputation
            triggers, and the exclusion constraint that makes double-booking
            impossible.
          </p>

          <h2>3. Add your keys</h2>
          <p>
            Copy <code>.env.example</code> to <code>.env.local</code> and fill in the
            two public values from <strong>Project Settings → API</strong>:
          </p>
          <ul>
            <li>
              <code>NEXT_PUBLIC_SUPABASE_URL</code>
            </li>
            <li>
              <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>
            </li>
          </ul>
          <p>
            Restart the dev server. The demo banner disappears and every query routes
            to Postgres instead of memory.
          </p>

          <h2>4. Seed it</h2>
          <p>
            Run <code>npm run seed</code> to push the Lagos venues, pitches and a
            fortnight of availability slots into your database. Safe to re-run — it
            upserts.
          </p>

          <h2>5. Take real payments</h2>
          <p>
            Create a <a href="https://paystack.com">Paystack</a> account and add{" "}
            <code>PAYSTACK_SECRET_KEY</code> and{" "}
            <code>NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY</code> to your environment. The
            checkout flow, the payments table and the refund rules are already built —
            what&apos;s left is calling Paystack&apos;s initialise endpoint and
            handling the webhook.
          </p>

          <h2>6. Deploy</h2>
          <p>
            Push to GitHub and import the repo in Vercel, or run{" "}
            <code>vercel</code> from the project directory. Add the same environment
            variables in <strong>Project Settings → Environment Variables</strong>.
            Set <code>NEXT_PUBLIC_SITE_URL</code> to your real domain so the metadata
            and sitemap point at the right place.
          </p>

          <h2>Before you take a single real booking</h2>
          <ul>
            <li>Read the Terms, Privacy and Refunds pages and make them true for you</li>
            <li>Put a real support address behind hello@ / help@ / safety@ / privacy@</li>
            <li>Visit and photograph every venue you mark as verified</li>
            <li>Decide who holds the money between booking and play, and write it down</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
