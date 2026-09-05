import "server-only";
import { formatNaira, formatDayShort, formatTime } from "@/lib/format";
import { emailLayout, textFooter, emailColors } from "./layout";

interface EmailContent {
  subject: string;
  html: string;
  text: string;
}

const site = () => process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

function highlightBox(rows: [string, string][]): string {
  const { border } = emailColors;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;border:1px solid ${border};border-radius:12px;">
    ${rows
      .map(
        ([label, value], i) => `<tr>
          <td style="padding:12px 16px;${i > 0 ? `border-top:1px solid ${border};` : ""}font-size:13px;color:${emailColors.inkSoft};">${label}</td>
          <td style="padding:12px 16px;${i > 0 ? `border-top:1px solid ${border};` : ""}font-size:14px;font-weight:700;color:${emailColors.ink};text-align:right;">${value}</td>
        </tr>`,
      )
      .join("")}
  </table>`;
}

export function bookingConfirmationEmail(input: {
  fullName: string;
  reference: string;
  venueName: string;
  address: string;
  pitchName: string;
  kickoffISO: string;
  totalKobo: number;
}): EmailContent {
  const when = `${formatDayShort(input.kickoffISO)}, ${formatTime(input.kickoffISO)}`;
  const firstName = input.fullName.split(" ")[0];
  const url = `${site()}/bookings/${input.reference}`;

  const html = emailLayout({
    previewText: `You've got the pitch — ${input.venueName}, ${when}`,
    ctaLabel: "View your booking",
    ctaUrl: url,
    bodyHtml: `
      <p style="margin:0;">Hey ${firstName},</p>
      <p style="margin:12px 0 0;">You&rsquo;ve got the pitch. Show your reference at the gate.</p>
      ${highlightBox([
        ["Reference", input.reference],
        ["Venue", `${input.venueName} · ${input.pitchName}`],
        ["Address", input.address],
        ["Kickoff", when],
        ["Paid", formatNaira(input.totalKobo)],
      ])}
    `,
  });

  const text = `Hey ${firstName},

You've got the pitch. Show your reference at the gate.

Reference: ${input.reference}
Venue: ${input.venueName} · ${input.pitchName}
Address: ${input.address}
Kickoff: ${when}
Paid: ${formatNaira(input.totalKobo)}

View your booking: ${url}${textFooter()}`;

  return { subject: `You've got the pitch — ${input.venueName}, ${when}`, html, text };
}

export function bookingCancelledEmail(input: {
  fullName: string;
  reference: string;
  venueName: string;
  kickoffISO: string;
  creditedKobo: number;
}): EmailContent {
  const when = `${formatDayShort(input.kickoffISO)}, ${formatTime(input.kickoffISO)}`;
  const firstName = input.fullName.split(" ")[0];
  const url = `${site()}/wallet`;
  const credited = input.creditedKobo > 0;

  const html = emailLayout({
    previewText: credited
      ? `Cancelled — ${formatNaira(input.creditedKobo)} credited to your wallet`
      : "Your booking was cancelled",
    ctaLabel: credited ? "View your wallet" : undefined,
    ctaUrl: credited ? url : undefined,
    bodyHtml: `
      <p style="margin:0;">Hey ${firstName},</p>
      <p style="margin:12px 0 0;">
        Your booking at ${input.venueName} for ${when} has been cancelled.
        ${
          credited
            ? `<strong>${formatNaira(input.creditedKobo)}</strong> has been credited straight back to your Tempo wallet — spend it on any pitch or game whenever you like.`
            : `This was inside the 6-hour cut-off, so no credit was issued this time.`
        }
      </p>
      ${highlightBox([
        ["Reference", input.reference],
        ["Venue", input.venueName],
        ["Was", when],
        [credited ? "Credited" : "Credited", credited ? formatNaira(input.creditedKobo) : "₦0"],
      ])}
    `,
  });

  const text = `Hey ${firstName},

Your booking at ${input.venueName} for ${when} has been cancelled.
${
  credited
    ? `${formatNaira(input.creditedKobo)} has been credited straight back to your Tempo wallet.`
    : "This was inside the 6-hour cut-off, so no credit was issued this time."
}

Reference: ${input.reference}
Venue: ${input.venueName}
Was: ${when}
Credited: ${credited ? formatNaira(input.creditedKobo) : "₦0"}
${credited ? `\nView your wallet: ${url}` : ""}${textFooter()}`;

  return {
    subject: credited ? `Cancelled — ${formatNaira(input.creditedKobo)} credited to your wallet` : "Your booking was cancelled",
    html,
    text,
  };
}

export function walletTopupEmail(input: {
  fullName: string;
  amountKobo: number;
  balanceKobo: number;
  reference: string;
}): EmailContent {
  const firstName = input.fullName.split(" ")[0];
  const url = `${site()}/wallet`;

  const html = emailLayout({
    previewText: `${formatNaira(input.amountKobo)} added to your Tempo wallet`,
    ctaLabel: "View your wallet",
    ctaUrl: url,
    bodyHtml: `
      <p style="margin:0;">Hey ${firstName},</p>
      <p style="margin:12px 0 0;">Your top-up landed. Ready to spend on your next booking.</p>
      ${highlightBox([
        ["Reference", input.reference],
        ["Top-up", formatNaira(input.amountKobo)],
        ["New balance", formatNaira(input.balanceKobo)],
      ])}
    `,
  });

  const text = `Hey ${firstName},

Your top-up landed. Ready to spend on your next booking.

Reference: ${input.reference}
Top-up: ${formatNaira(input.amountKobo)}
New balance: ${formatNaira(input.balanceKobo)}

View your wallet: ${url}${textFooter()}`;

  return { subject: `${formatNaira(input.amountKobo)} added to your Tempo wallet`, html, text };
}

export function welcomeEmail(input: {
  fullName: string;
  email: string;
  phone: string | null;
  handle: string;
}): EmailContent {
  const firstName = input.fullName.split(" ")[0];
  const findUrl = `${site()}/pitches`;
  const profileUrl = `${site()}/players/${input.handle}`;

  const accountRows: [string, string][] = [
    ["Name", input.fullName],
    ["Email", input.email],
    ...(input.phone ? ([["Phone", input.phone]] as [string, string][]) : []),
    ["Player ID", `@${input.handle}`],
  ];

  const html = emailLayout({
    previewText: "Find a facility, book a slot, join a game — welcome to Tempo",
    ctaLabel: "Find a pitch",
    ctaUrl: findUrl,
    bodyHtml: `
      <p style="margin:0;">Hey ${firstName},</p>
      <p style="margin:12px 0 0;">
        Welcome to Tempo. Here&rsquo;s the account you just created:
      </p>
      ${highlightBox(accountRows)}
      <p style="margin:20px 0 0;">
        Your <a href="${profileUrl}">player card</a> tracks the things that matter on Tempo —
        games played, punctuality, streaks, peer ratings — all earned, never self-declared.
        It fills in the more you play.
      </p>
      <p style="margin:16px 0 0;">
        From here you can find a verified sports facility near you, book a slot in
        under a minute, or join an open game with real players across Lagos.
      </p>
    `,
  });

  const text = `Hey ${firstName},

Welcome to Tempo. Here's the account you just created:

${accountRows.map(([label, value]) => `${label}: ${value}`).join("\n")}

Your player card (${profileUrl}) tracks games played, punctuality, streaks and peer ratings — all earned, never self-declared. It fills in the more you play.

From here you can find a verified sports facility near you, book a slot in under a minute, or join an open game with real players across Lagos.

Find a pitch: ${findUrl}${textFooter()}`;

  return { subject: "Welcome to Tempo", html, text };
}
