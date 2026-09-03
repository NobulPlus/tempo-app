import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The agreement between you and Tempo when you book a pitch or join a game.",
};

export default function TermsPage() {
  return (
    <>
      <h1>Terms of Service</h1>
      <p className="meta">Effective 14 August 2026. Governed by the laws of Nigeria.</p>

      <p>
        These terms are the agreement between you and Tempo. By creating an account,
        booking a pitch or joining a game, you accept them.
      </p>

      <h2>1. What Tempo is — and isn&apos;t</h2>
      <p>
        Tempo is a booking and coordination platform. We connect players with venues
        and with each other. <strong>We do not own or operate the pitches.</strong>{" "}
        Each venue is independently run and is responsible for the condition and
        safety of its facility.
      </p>
      <p>
        &ldquo;Verified&rdquo; means someone from Tempo has visited the venue,
        checked the surface, lighting and facilities, and confirmed the
        operator&apos;s contact details. It is not a guarantee of safety, and it is
        not a substitute for your own judgement on the day.
      </p>

      <h2>2. Your account</h2>
      <ul>
        <li>Tempo is open to all ages — there is no minimum age to hold an account.</li>
        <li>Give accurate information and keep it up to date.</li>
        <li>You are responsible for anything done through your account.</li>
        <li>One person, one account. Don&apos;t share logins.</li>
      </ul>

      <h2>3. Booking a pitch</h2>
      <p>
        When you book a slot and payment clears, you have a contract with the venue
        for that hour, arranged through Tempo. Your slot is held exclusively — the
        system will not sell the same hour twice.
      </p>
      <p>
        Tempo charges a service fee on top of the venue&apos;s price. It is shown
        clearly at checkout before you pay.
      </p>

      <h2>4. Joining a game</h2>
      <p>
        Games are created by hosts, who are users like you — not Tempo staff. When you
        join, you agree to pay the stated price per player and to turn up.
      </p>
      <p>
        Every game has a <strong>minimum number to go ahead</strong>. If that number
        isn&apos;t reached by kickoff, the game is cancelled and{" "}
        <strong>everyone is credited in full, automatically</strong>. This is the
        guarantee — it is honoured by the platform, not left to the host.
      </p>

      <h2>5. Hosting a game</h2>
      <p>If you host, you agree to:</p>
      <ul>
        <li>Turn up, and run the game you advertised</li>
        <li>Describe the level honestly</li>
        <li>Not discriminate against anyone joining</li>
        <li>Tell players promptly if you have to cancel</li>
      </ul>
      <p>
        Hosts who repeatedly cancel late, or advertise games that don&apos;t happen,
        lose hosting privileges.
      </p>

      <h2>6. Behaviour</h2>
      <p>
        Football is physical; abuse isn&apos;t part of it. Harassment,
        discrimination, threats or violence — on the pitch or in messages — result in
        removal from the platform. See the{" "}
        <a href="/legal/community">Community Rules</a>.
      </p>

      <h2>7. Payments, wallet and credits</h2>
      <p>
        Payments are processed by a licensed provider. Money you pay in — whether
        topping up your wallet or paying for a booking — stays on the platform as
        Tempo wallet balance and is spent on future bookings and games. Cancellations
        follow the{" "}
        <a href="/legal/refunds">Cancellations &amp; Refunds policy</a>, which forms
        part of these terms.
      </p>

      <h2>8. Risk and liability</h2>
      <p>
        <strong>You play sport at your own risk.</strong> Football carries a real risk
        of injury. Tempo does not provide insurance, medical cover or supervision.
        Make sure you are fit to play and consider your own insurance.
      </p>
      <p>
        To the fullest extent permitted by Nigerian law, Tempo&apos;s total liability
        for any claim is limited to the amount you paid for the booking or game the
        claim relates to. Nothing here excludes liability for death or personal injury
        caused by our negligence, or for fraud — those cannot be limited by contract.
      </p>

      <h2>9. Suspension</h2>
      <p>
        We may suspend or close an account that breaches these terms, defrauds users
        or venues, or repeatedly fails to show up for games. Where possible we will
        tell you why and give you a chance to respond.
      </p>

      <h2>10. Changes and disputes</h2>
      <p>
        We may update these terms; material changes are notified by email 14 days in
        advance. These terms are governed by Nigerian law and the courts of Lagos
        State have jurisdiction. We would much rather sort a problem out directly —
        email <a href="mailto:hello@tempo.ng">hello@tempo.ng</a> first.
      </p>
    </>
  );
}
