import "server-only";

/**
 * Brevo's HTTP transactional-email API — not SMTP. Two real problems with
 * SMTP ruled this out: Brevo's SMTP relay enforces an IP allowlist (a
 * serverless deploy like Vercel has no fixed outbound IP to allowlist), and
 * nodemailer 9.1.1 hung indefinitely against this relay in testing regardless
 * of port/TLS mode, while older nodemailer versions carry real unpatched
 * CVEs. The HTTP API sidesteps both — plain fetch(), no IP restriction, no
 * SMTP socket library at all.
 *
 * Same graceful-degradation posture as Flutterwave in
 * src/lib/payments/flutterwave.ts — an unconfigured environment skips
 * sending rather than throwing, so nothing downstream ever depends on mail
 * actually working.
 */

const BREVO_API = "https://api.brevo.com/v3/smtp/email";

export function isMailConfigured(): boolean {
  return Boolean(process.env.BREVO_API_KEY);
}

function fromSender(): { name: string; email: string } {
  const raw = process.env.MAIL_FROM || "Tempo <info@playtempo11.com>";
  const match = raw.match(/^(.*)<(.+)>$/);
  return match
    ? { name: match[1].trim(), email: match[2].trim() }
    : { name: "Tempo", email: raw.trim() };
}

interface SendMailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/**
 * Fire-and-forget by design: every call site is a side effect on top of an
 * already-succeeded booking/cancellation/top-up/signup. A mail failure must
 * never surface as if the underlying action failed, so this only logs.
 */
export async function sendMail(input: SendMailInput): Promise<void> {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) return;

  try {
    const res = await fetch(BREVO_API, {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        sender: fromSender(),
        to: [{ email: input.to }],
        subject: input.subject,
        htmlContent: input.html,
        textContent: input.text,
      }),
    });

    if (!res.ok) {
      console.error("[mail] Brevo API rejected send:", res.status, await res.text().catch(() => ""));
    }
  } catch (err) {
    console.error("[mail] send failed:", err);
  }
}
