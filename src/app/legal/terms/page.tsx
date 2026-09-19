import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The agreement between you and Tempo when you book a pitch, host a game or join a game.",
};

export default function TermsPage() {
  return (
    <>
      <h1>Terms of Service</h1>
      <p className="meta">Effective 16 September 2026. Governed by the laws of Nigeria.</p>

      <p>
        These terms are the agreement between you and Tempo. By creating an account,
        booking a pitch, hosting a game, joining a game or listing a venue, you accept
        them.
      </p>

      <h2>1. What Tempo is</h2>
      <p>
        Tempo is a sports booking and coordination platform. We help players find
        venues, reserve available time, host public games and join games created by
        other users. <strong>Tempo does not own or operate the venues listed on the platform.</strong>
      </p>
      <p>
        Each venue is independently operated and remains responsible for its facility,
        staff, access control, safety, equipment, opening hours and the accuracy of
        the information it gives Tempo.
      </p>

      <h2>2. User roles</h2>
      <ul>
        <li>
          <strong>Players</strong> can book private slots, join public games and use
          Tempo credit where available.
        </li>
        <li>
          <strong>Hosts</strong> are users who reserve a pitch and publish a public
          game for other players to join.
        </li>
        <li>
          <strong>Venue owners</strong> manage venue listings, spaces, availability,
          pricing and booking fulfilment after Tempo approves their access.
        </li>
        <li>
          <strong>Admins</strong> review venues, roles, reports, payment exceptions
          and trust issues.
        </li>
      </ul>

      <h2>3. Your account</h2>
      <ul>
        <li>You must give accurate information and keep it up to date.</li>
        <li>You are responsible for anything done through your account.</li>
        <li>One person, one account. Do not share logins.</li>
        <li>Tempo is intended for users aged 16 and above.</li>
        <li>
          Users under 18 must use Tempo under the supervision of a parent or legal
          guardian, who is responsible for the account, booking, payment, attendance
          and the minor&apos;s participation.
        </li>
      </ul>

      <h2>4. Venue verification</h2>
      <p>
        &quot;Verified&quot; means Tempo has reviewed the venue information and may have checked
        the facility, operator details, location, surface, lighting or amenities before
        making it bookable. Verification is a trust signal, not a guarantee that every
        condition will always remain the same.
      </p>
      <p>
        Tempo may unpublish a venue, pitch or slot if information becomes inaccurate,
        complaints are unresolved, the facility is unsafe, or the venue no longer meets
        the platform standard.
      </p>

      <h2>5. Booking a pitch</h2>
      <p>
        When you choose an available slot and payment clears, Tempo records the booking
        and the venue is expected to honour that slot. The same confirmed slot should
        not be sold twice through Tempo.
      </p>
      <p>
        Checkout shows the venue price and any Tempo service fee or payment-channel
        fee before you pay. You should check the date, time, venue, pitch and amount
        carefully before confirming payment.
      </p>

      <h2>6. Hosting a public game</h2>
      <p>
        To host a public game, you first reserve the pitch by paying the required
        booking amount and applicable fees. Once payment clears, the game can be
        published for other players to join.
      </p>
      <p>
        Player payments are collected against that specific game. They are used to
        reimburse the host up to the pitch cost the host paid, and any hosting earnings
        are recorded separately in the host&apos;s Tempo credit ledger unless another payout
        process is agreed.
      </p>
      <p>
        If you already have a confirmed Tempo pitch booking and some players of your
        own, you may publish only the remaining spaces. You must state the number of
        players already committed accurately.
      </p>
      <p>
        If the game does not reach its minimum number, the host may choose to continue
        with fewer players or cancel. If the host or Tempo cancels, eligible player
        payments are credited back through the platform.
      </p>
      <p>
        A host may cancel only while the session is below 80% of its advertised
        capacity. At 80% full or above, the session proceeds, subject to Tempo&apos;s
        intervention for safety, venue failure, fraud or another exceptional issue.
      </p>

      <h2>7. Joining a game</h2>
      <p>
        When you join a game, you agree to pay the stated player price, attend on time
        and follow the host&apos;s reasonable game instructions. Your spot is confirmed
        when payment is completed or when Tempo credit fully covers the amount due.
      </p>
      <p>
        If a game is already full, Tempo may add you to the waitlist. You are not
        charged for a waitlist spot unless a place opens and you complete payment.
      </p>

      <h2>8. Payments and Tempo credit</h2>
      <p>
        Normal payments on Tempo are tied to a specific action: booking a pitch,
        hosting a game, joining a game or paying a game balance. Tempo does not
        encourage casual wallet funding.
      </p>
      <p>
        Card and bank payments are processed by payment providers such as KoraPay and
        Flutterwave. Tempo does not store your full card number, CVV or bank login
        details.
      </p>
      <p>
        Tempo credit is reusable platform credit from refunds, host reimbursements and
        hosting earnings. It is not a bank account, deposit account or stored-value
        product for general cash storage. Credit may be used in full or alongside a
        card or bank payment where checkout supports a split payment.
      </p>
      <p>
        Only an organiser may request a bank withdrawal, and only for verified hosting
        earnings from that organiser&apos;s own completed sessions. Refunds and other
        reusable credit remain Tempo credit unless Tempo agrees otherwise.
      </p>
      <p>
        Cancellations, credits and disputed payments follow the{" "}
        <a href="/legal/refunds">Cancellations &amp; Refunds policy</a>, which forms
        part of these terms. Nothing in these terms limits a right you have under
        Nigerian consumer-protection law that cannot legally be excluded.
      </p>

      <h2>9. Venue-owner responsibilities</h2>
      <p>
        If you operate a venue on Tempo, you must keep venue details, photos,
        amenities, pitch information, location, pricing and availability accurate.
        You must honour confirmed bookings, tell Tempo quickly when a pitch is
        unavailable, and avoid listing slots you cannot supply.
      </p>
      <p>
        Tempo may hold, adjust or reverse venue-related settlement where there is a
        double booking, failed access, venue cancellation, misdescription, fraud,
        chargeback, serious complaint or unresolved dispute.
      </p>

      <h2>10. Behaviour</h2>
      <p>
        Abuse, discrimination, threats, violence, fraud, fake attendance, side
        payments designed to avoid the platform, or repeated no-shows can lead to loss
        of booking, joining, hosting or venue-owner access. See the{" "}
        <a href="/legal/community">Community Rules</a>.
      </p>

      <h2>11. Risk and liability</h2>
      <p>
        <strong>You play sport at your own risk.</strong> Football and other sports
        carry a real risk of injury. Tempo does not provide insurance, medical cover,
        referees or supervision unless a specific event page says otherwise.
      </p>
      <p>
        To the fullest extent permitted by Nigerian law, Tempo&apos;s total liability
        for any claim is limited to the amount you paid for the booking or game the
        claim relates to. Nothing here excludes liability for death or personal injury
        caused by our negligence, fraud, or any liability that cannot lawfully be
        excluded.
      </p>

      <h2>12. Suspension and disputes</h2>
      <p>
        We may suspend or close an account that breaches these terms, defrauds users
        or venues, creates safety risk, repeatedly fails to show up, or misuses
        payments and credits. Where possible, we will tell you why and give you a
        chance to respond.
      </p>
      <p>
        If something goes wrong, email{" "}
        <a href="mailto:info@playtempo11.com">info@playtempo11.com</a> with your
        account email, booking or game reference, payment reference if relevant, and a
        clear description of the issue.
      </p>

      <h2>13. Changes</h2>
      <p>
        We may update these terms. Material changes are notified by email or in-app
        notice before they take effect where practical. These terms are governed by
        Nigerian law and the courts of Lagos State have jurisdiction.
      </p>
    </>
  );
}
