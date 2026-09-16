import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cancellations & Refunds",
  description:
    "How Tempo handles cancellations, Tempo credit, host reimbursements and payment exceptions.",
};

export default function RefundsPage() {
  return (
    <>
      <h1>Cancellations &amp; Refunds</h1>
      <p className="meta">Effective 16 September 2026.</p>

      <p>
        Tempo payments are meant to start from the booking or game you are paying for.
        If a qualifying cancellation or reimbursement happens, the reusable value
        usually lands as Tempo credit rather than an instant card or bank reversal.
      </p>

      <h2>1. Tempo credit</h2>
      <p>
        Tempo credit is your reusable platform balance. It can come from cancellation
        credits, game refunds, host reimbursements and hosting earnings. It is not
        designed for casual wallet funding or long-term cash storage.
      </p>
      <p>
        Tempo credit does not expire while your account is active. It can be used on
        bookings and games where the checkout flow supports it. In most flows, credit
        can be used only when it covers the full amount due.
      </p>

      <h2>2. Private pitch bookings</h2>
      <table>
        <thead>
          <tr>
            <th>Situation</th>
            <th>What happens</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>You cancel 6 hours or more before start time</td>
            <td>
              <strong>Full Tempo credit</strong> for the booking amount and Tempo
              service fee
            </td>
          </tr>
          <tr>
            <td>You cancel less than 6 hours before start time</td>
            <td>No automatic credit unless the venue agrees or Tempo decides otherwise</td>
          </tr>
          <tr>
            <td>The venue cancels, is closed, double-books or cannot provide the pitch</td>
            <td>
              <strong>Full Tempo credit or reschedule support</strong>. Where legally
              required or appropriate, Tempo may process a payment-provider refund.
            </td>
          </tr>
        </tbody>
      </table>
      <p>
        The 6-hour cut-off exists because venues often cannot resell a slot close to
        start time. It does not remove any consumer right that Nigerian law gives you
        when a paid service is not provided.
      </p>

      <h2>3. Hosting a public game</h2>
      <p>
        A host pays first to reserve the pitch and publish the game. Player payments
        for that game are collected against the game ledger, not as casual wallet
        top-ups.
      </p>
      <table>
        <thead>
          <tr>
            <th>Situation</th>
            <th>What happens</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Players join and pay</td>
            <td>
              Their payments reimburse the host up to the pitch cost the host paid.
              Any additional hosting earnings are tracked separately.
            </td>
          </tr>
          <tr>
            <td>The game does not reach the minimum</td>
            <td>
              The host decides whether to continue with fewer players or cancel and
              trigger eligible credits.
            </td>
          </tr>
          <tr>
            <td>The host cancels</td>
            <td>
              Player payments are credited back. Host recovery depends on timing,
              venue policy and whether the pitch booking can still be cancelled.
            </td>
          </tr>
          <tr>
            <td>The venue cancels or the pitch is unavailable</td>
            <td>
              Players receive full Tempo credit or reschedule support. Tempo also
              reviews the host deposit and venue settlement.
            </td>
          </tr>
        </tbody>
      </table>

      <h2>4. Joining a public game</h2>
      <table>
        <thead>
          <tr>
            <th>Situation</th>
            <th>What happens</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>You leave and a waitlisted player takes your spot</td>
            <td>
              <strong>Full Tempo credit</strong>
            </td>
          </tr>
          <tr>
            <td>You leave 6 hours or more before start time and there is no replacement</td>
            <td>
              <strong>Full Tempo credit</strong>
            </td>
          </tr>
          <tr>
            <td>You leave less than 6 hours before start time and there is no replacement</td>
            <td>No automatic credit because the host has already committed to the pitch</td>
          </tr>
          <tr>
            <td>The game is cancelled by the host, venue or Tempo</td>
            <td>
              <strong>Full Tempo credit</strong> for eligible players
            </td>
          </tr>
        </tbody>
      </table>

      <h2>5. Payment-provider issues</h2>
      <p>
        Sometimes a payment provider may mark a payment successful before Tempo has
        received or processed the webhook. If your provider receipt says success but
        Tempo has not applied the payment, do not keep retrying with new payments
        unless the app clearly asks you to. Email us with:
      </p>
      <ul>
        <li>Your Tempo account email</li>
        <li>The booking or game you were paying for</li>
        <li>The payment reference or transaction ID</li>
        <li>A screenshot or receipt from KoraPay, Flutterwave or the bank</li>
      </ul>
      <p>
        Tempo admins can verify the payment and apply it where the provider confirms
        success and the amount matches the expected booking or game amount.
      </p>

      <h2>6. Rain and unplayable pitches</h2>
      <p>
        If a venue declares a pitch unplayable, Tempo will support a full Tempo credit,
        reschedule or provider refund where appropriate. If the venue says the pitch is
        playable and you choose not to attend, the normal cancellation timing applies.
      </p>

      <h2>7. Abuse, fraud and chargebacks</h2>
      <p>
        Tempo may hold or reverse credits, reimbursements, hosting earnings or venue
        settlements where there is suspected fraud, duplicate payment, chargeback,
        false attendance, side payment, abuse of cancellation rules or a serious
        unresolved dispute.
      </p>

      <h2>8. Contact</h2>
      <p>
        Email <a href="mailto:info@playtempo11.com">info@playtempo11.com</a> within
        48 hours of the issue where possible. Include the booking reference, game
        link, venue name and payment reference so we can investigate quickly.
      </p>
    </>
  );
}
