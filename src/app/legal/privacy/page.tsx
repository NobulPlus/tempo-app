import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How Tempo collects, uses and protects your personal data, in line with the Nigeria Data Protection Act 2023.",
};

const EFFECTIVE = "14 August 2026";

export default function PrivacyPage() {
  return (
    <>
      <h1>Privacy Policy</h1>
      <p className="meta">
        Effective {EFFECTIVE}. This policy is written to comply with the{" "}
        <strong>Nigeria Data Protection Act 2023 (NDPA)</strong>.
      </p>

      <p>
        Tempo is a platform that helps people in Lagos find and book football pitches
        and join games. This policy explains what personal data we collect, why we
        collect it, what we do with it, and the rights you have over it. We&apos;ve
        tried to write it in plain language rather than legal fog.
      </p>

      <h2>1. Who we are</h2>
      <p>
        Tempo is the data controller for the personal data described here. You can
        reach us at <a href="mailto:privacy@tempo.ng">privacy@tempo.ng</a> for any
        question about your data, or to exercise any of the rights in section 7.
      </p>

      <h2>2. What we collect</h2>
      <table>
        <thead>
          <tr>
            <th>Data</th>
            <th>Why we need it</th>
            <th>Lawful basis (NDPA s.25)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Name</td>
            <td>To identify you to hosts and other players in a game</td>
            <td>Performance of a contract</td>
          </tr>
          <tr>
            <td>Email address</td>
            <td>Account login, booking confirmations, receipts</td>
            <td>Performance of a contract</td>
          </tr>
          <tr>
            <td>Phone number (optional)</td>
            <td>WhatsApp reminders about games you&apos;ve joined</td>
            <td>Consent — you may withdraw it at any time</td>
          </tr>
          <tr>
            <td>Profile photo (optional)</td>
            <td>So teammates recognise you at the pitch</td>
            <td>Consent</td>
          </tr>
          <tr>
            <td>Approximate location</td>
            <td>To sort pitches by distance from you</td>
            <td>Consent — asked for in your browser, never stored</td>
          </tr>
          <tr>
            <td>Bookings, games joined, attendance</td>
            <td>To run the service and calculate your reputation</td>
            <td>Performance of a contract</td>
          </tr>
          <tr>
            <td>Payment records</td>
            <td>Receipts, refunds, accounting obligations</td>
            <td>Legal obligation</td>
          </tr>
          <tr>
            <td>Ratings you give and receive</td>
            <td>Community trust and no-show tracking</td>
            <td>Legitimate interest</td>
          </tr>
        </tbody>
      </table>

      <p>
        <strong>We do not store your card details.</strong> Card payments are handled
        entirely by our payment processor. Tempo never sees your full card number, CVV
        or bank credentials.
      </p>

      <h2>3. What is public</h2>
      <p>
        Some information is visible to other users by design, because a marketplace
        for team sport only works if people can see who they&apos;re playing with:
      </p>
      <ul>
        <li>Your name, handle, profile photo and area</li>
        <li>Your position, preferred foot and bio, if you fill them in</li>
        <li>Your games played, punctuality score, streak, traits and peer rating</li>
        <li>Which upcoming games you have joined</li>
      </ul>
      <p>
        Your email address, phone number, payment records and exact location are{" "}
        <strong>never</strong> shown to other users.
      </p>

      <h2>4. Location data</h2>
      <p>
        When you tap &ldquo;Near me&rdquo;, your browser asks your permission and
        returns approximate coordinates. We use them once, in your browser session, to
        sort pitches by distance. We do not write them to our database, we do not
        build a location history, and declining costs you nothing except distance
        sorting.
      </p>

      <h2>5. Who we share data with</h2>
      <ul>
        <li>
          <strong>Venues</strong> — when you book a pitch, that venue receives your
          name and booking reference so they can let you in.
        </li>
        <li>
          <strong>Hosts</strong> — when you join a game, the host sees your public
          profile.
        </li>
        <li>
          <strong>Payment processor</strong> — to take payment and issue refunds.
        </li>
        <li>
          <strong>Infrastructure providers</strong> — hosting and database providers
          acting under contract as data processors.
        </li>
      </ul>
      <p>
        We do not sell your personal data. We do not share it with advertisers. If
        any of our processors store data outside Nigeria, we ensure an adequate level
        of protection as required by the NDPA.
      </p>

      <h2>6. How long we keep it</h2>
      <ul>
        <li>Account and profile data — until you delete your account</li>
        <li>Booking and payment records — 6 years, to meet accounting obligations</li>
        <li>Ratings and attendance — anonymised when you delete your account</li>
        <li>Waitlist entries — until we launch in your area, or you ask us to remove them</li>
      </ul>

      <h2>7. Your rights</h2>
      <p>Under the NDPA you have the right to:</p>
      <ul>
        <li>Ask what personal data we hold about you, and get a copy</li>
        <li>Correct anything inaccurate</li>
        <li>Delete your account and the data attached to it</li>
        <li>Object to processing based on legitimate interest</li>
        <li>Withdraw consent (for your phone number or photo) at any time</li>
        <li>Receive your data in a portable format</li>
        <li>
          Lodge a complaint with the{" "}
          <strong>Nigeria Data Protection Commission</strong> if you think we&apos;ve
          got it wrong
        </li>
      </ul>
      <p>
        Email <a href="mailto:privacy@tempo.ng">privacy@tempo.ng</a> and we will
        respond within 30 days.
      </p>

      <h2>8. Security</h2>
      <p>
        Passwords are hashed, never stored in readable form. Data is encrypted in
        transit. Access to the production database is restricted, and every table
        enforces row-level security so one user&apos;s data cannot be read by another
        even if application code has a bug. If a breach occurs that risks your rights,
        we will notify the Commission within 72 hours and tell you directly.
      </p>

      <h2>9. Children</h2>
      <p>
        Tempo is not intended for anyone under 18. If you are under 18 and want to
        play, a parent or guardian must create and manage the account. If we learn we
        hold data about a child without consent, we delete it.
      </p>

      <h2>10. Changes</h2>
      <p>
        If we change this policy materially, we will email registered users at least
        14 days before it takes effect. The date at the top always reflects the
        current version.
      </p>
    </>
  );
}
