import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cancellations & Refunds",
  description:
    "Exactly when you get wallet credit back — pitch bookings, open games, and the guarantee.",
};

export default function RefundsPage() {
  return (
    <>
      <h1>Cancellations &amp; Refunds</h1>
      <p className="meta">Effective 14 August 2026.</p>

      <p>
        No small print games. Money you pay Tempo — for a top-up or a booking — stays
        as credit in your Tempo wallet, ready to spend on your next match. Here is
        exactly when a cancellation puts that credit back in your balance, and why the
        cut-off is where it is.
      </p>

      <h2>The rule</h2>
      <table>
        <thead>
          <tr>
            <th>When you cancel</th>
            <th>What happens to your money</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>6 hours or more before kickoff</td>
            <td>
              <strong>100% credited back to your wallet</strong>, including the
              service fee
            </td>
          </tr>
          <tr>
            <td>Less than 6 hours before kickoff</td>
            <td>No credit — the amount is forfeited</td>
          </tr>
        </tbody>
      </table>
      <p>
        The reason for the cut-off is simple: once a venue has turned other bookings
        away for your hour, that hour is gone. Under six hours it almost never
        re-sells. This one rule applies the same way to a single pitch booking and to
        dropping out of an open game.
      </p>

      <h2>Wallet credit, not cash-back</h2>
      <p>
        Tempo does not refund cancellations back to your card or bank account. Instead,
        the amount is credited to your Tempo wallet immediately and is available to
        spend on any pitch booking or game straight away. This is what lets us
        guarantee your money stays safe and usable on the platform, without waiting on
        bank refund timelines.
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
              <strong>Full wallet credit</strong> — the game is unaffected
            </td>
          </tr>
          <tr>
            <td>You drop out 6 hours or more before, no replacement</td>
            <td>
              <strong>Full wallet credit</strong>
            </td>
          </tr>
          <tr>
            <td>You drop out under 6 hours, no replacement</td>
            <td>No credit — the host has already committed to the pitch</td>
          </tr>
          <tr>
            <td>The game doesn&apos;t reach its minimum</td>
            <td>
              <strong>Full wallet credit to everyone, automatically</strong>
            </td>
          </tr>
          <tr>
            <td>The host cancels</td>
            <td>
              <strong>Full wallet credit to everyone</strong>
            </td>
          </tr>
          <tr>
            <td>The venue cancels or the pitch is unplayable</td>
            <td>
              <strong>Full wallet credit to everyone</strong>
            </td>
          </tr>
        </tbody>
      </table>

      <h2>The guarantee</h2>
      <p>
        Every game shows a minimum number of players needed to go ahead. If that
        number isn&apos;t met by kickoff, the game is cancelled and everyone is
        credited in full — automatically, without anyone having to ask. That promise
        is enforced by the platform, not by the host&apos;s goodwill.
      </p>

      <h2>Rain and unplayable pitches</h2>
      <p>
        For outdoor pitches during the rainy season, if the venue declares the pitch
        unplayable you get a full wallet credit or a free reschedule, your choice. If
        the venue says it&apos;s playable and you decide not to travel, the normal
        6-hour cut-off applies.
      </p>

      <h2>How credit reaches you</h2>
      <p>
        Wallet credit lands the moment a qualifying cancellation is processed —
        there&apos;s no bank or card wait involved. Check your balance in your Tempo
        wallet at any time; we&apos;ll also email you when credit is added.
      </p>

      <h2>Topping up and spending your wallet</h2>
      <p>
        You top up your Tempo wallet in whatever amount suits you, and every pitch
        booking or game you pay for is deducted from that balance. Wallet credit
        doesn&apos;t expire and has no fee to hold — it&apos;s simply how you pay on
        Tempo.
      </p>

      <h2>If something goes wrong</h2>
      <p>
        If you turned up and the pitch was locked, double-booked, or nothing like what
        was advertised, email{" "}
        <a href="mailto:help@tempo.ng">help@tempo.ng</a> within 48 hours with your
        booking reference. We will investigate with the venue and credit your wallet
        if the complaint stands. Venues that do this repeatedly are removed.
      </p>
    </>
  );
}
