import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cancellations & Refunds",
  description:
    "Exactly when you get your money back — pitch bookings, open games, and the guarantee.",
};

export default function RefundsPage() {
  return (
    <>
      <h1>Cancellations &amp; Refunds</h1>
      <p className="meta">Effective 14 August 2026.</p>

      <p>
        No small print games. Here is exactly when you get your money back, and why
        the cut-offs are where they are.
      </p>

      <h2>Pitch bookings</h2>
      <table>
        <thead>
          <tr>
            <th>When you cancel</th>
            <th>You get back</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>More than 24 hours before kickoff</td>
            <td>
              <strong>100%</strong>, including the service fee
            </td>
          </tr>
          <tr>
            <td>Between 24 and 6 hours before</td>
            <td>
              <strong>50%</strong> of the pitch price
            </td>
          </tr>
          <tr>
            <td>Less than 6 hours before</td>
            <td>No refund</td>
          </tr>
        </tbody>
      </table>
      <p>
        The reason for the tiers is simple: once a venue has turned other bookings
        away for your hour, that hour is gone. Under six hours it almost never
        re-sells.
      </p>

      <h2>Open games</h2>
      <table>
        <thead>
          <tr>
            <th>Situation</th>
            <th>What happens</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>You drop out and someone from the waitlist takes your spot</td>
            <td>
              <strong>Full refund</strong> — the game is unaffected
            </td>
          </tr>
          <tr>
            <td>You drop out more than 12 hours before, no replacement</td>
            <td>
              <strong>Full refund</strong>
            </td>
          </tr>
          <tr>
            <td>You drop out under 12 hours, no replacement</td>
            <td>No refund — the host has already committed to the pitch</td>
          </tr>
          <tr>
            <td>The game doesn&apos;t reach its minimum</td>
            <td>
              <strong>Full refund to everyone, automatically</strong>
            </td>
          </tr>
          <tr>
            <td>The host cancels</td>
            <td>
              <strong>Full refund to everyone</strong>
            </td>
          </tr>
          <tr>
            <td>The venue cancels or the pitch is unplayable</td>
            <td>
              <strong>Full refund to everyone</strong>
            </td>
          </tr>
        </tbody>
      </table>

      <h2>The guarantee</h2>
      <p>
        Every game shows a minimum number of players needed to go ahead. If that
        number isn&apos;t met by kickoff, the game is cancelled and everyone is
        refunded in full — automatically, without anyone having to ask. That promise
        is enforced by the platform, not by the host&apos;s goodwill.
      </p>

      <h2>Rain and unplayable pitches</h2>
      <p>
        For outdoor pitches during the rainy season, if the venue declares the pitch
        unplayable you get a full refund or a free reschedule, your choice. If the
        venue says it&apos;s playable and you decide not to travel, the normal
        cancellation tiers apply.
      </p>

      <h2>How refunds reach you</h2>
      <p>
        Refunds go back to the method you paid with. Cards typically take 5–10
        working days depending on your bank. Bank transfers and USSD payments are
        usually back within 3 working days. We&apos;ll email you when the refund is
        issued.
      </p>

      <h2>If something goes wrong</h2>
      <p>
        If you turned up and the pitch was locked, double-booked, or nothing like what
        was advertised, email{" "}
        <a href="mailto:help@tempo.ng">help@tempo.ng</a> within 48 hours with your
        booking reference. We will investigate with the venue and refund you if the
        complaint stands. Venues that do this repeatedly are removed.
      </p>
    </>
  );
}
