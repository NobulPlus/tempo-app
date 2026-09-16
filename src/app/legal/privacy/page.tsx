import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How Tempo collects, uses and protects personal data for players, hosts and venue owners.",
};

const EFFECTIVE = "16 September 2026";

export default function PrivacyPage() {
  return (
    <>
      <h1>Privacy Policy</h1>
      <p className="meta">
        Effective {EFFECTIVE}. This policy is written with the{" "}
        <strong>Nigeria Data Protection Act 2023 (NDPA)</strong> in mind.
      </p>

      <p>
        Tempo helps people find venues, book sports spaces, host public games and join
        games. This policy explains what personal data we collect, why we collect it,
        who sees it and how you can exercise your rights.
      </p>

      <h2>1. Who we are</h2>
      <p>
        Tempo is the data controller for the personal data described here. Contact us
        at <a href="mailto:info@playtempo11.com">info@playtempo11.com</a> for privacy
        questions or requests.
      </p>

      <h2>2. What we collect</h2>
      <table>
        <thead>
          <tr>
            <th>Data</th>
            <th>Why we use it</th>
            <th>Lawful basis</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Name, handle, email and password credentials</td>
            <td>Account creation, login, email verification and support</td>
            <td>Contract</td>
          </tr>
          <tr>
            <td>Phone number</td>
            <td>Account trust, venue-owner follow-up, booking or game communication</td>
            <td>Contract or consent, depending on use</td>
          </tr>
          <tr>
            <td>Profile details and photo</td>
            <td>Player identity, host trust, public player cards and team coordination</td>
            <td>Consent or legitimate interest</td>
          </tr>
          <tr>
            <td>Identity-verification documents</td>
            <td>Trust and safety checks for users, hosts or venue operators</td>
            <td>Consent, legitimate interest and fraud prevention</td>
          </tr>
          <tr>
            <td>Venue-owner application details</td>
            <td>Reviewing whether someone should manage venues on Tempo</td>
            <td>Contract and legitimate interest</td>
          </tr>
          <tr>
            <td>Venue names, addresses, photos, map coordinates and operating details</td>
            <td>Publishing venues, showing directions, generating availability and bookings</td>
            <td>Contract and legitimate interest</td>
          </tr>
          <tr>
            <td>Bookings, games, attendance, cancellations and reports</td>
            <td>Running the marketplace, trust scores, refunds and dispute handling</td>
            <td>Contract and legitimate interest</td>
          </tr>
          <tr>
            <td>Payment references, ledger entries and provider responses</td>
            <td>Receipts, reconciliation, refunds, reimbursements and accounting</td>
            <td>Contract and legal obligation</td>
          </tr>
          <tr>
            <td>Device, browser and security logs</td>
            <td>Security, debugging, fraud prevention and abuse investigation</td>
            <td>Legitimate interest</td>
          </tr>
        </tbody>
      </table>

      <p>
        <strong>We do not store your full card details.</strong> Card and bank
        payments are handled by payment processors such as KoraPay and Flutterwave.
        Tempo stores payment references and status information, not your CVV or full
        card number.
      </p>

      <h2>3. What other people can see</h2>
      <ul>
        <li>
          Players and hosts may see your public profile, name, handle, photo, game
          status and attendance signals.
        </li>
        <li>
          Hosts can see who has joined their game and whether a player is confirmed,
          pending or waitlisted.
        </li>
        <li>
          Venues can see booking information needed to honour a confirmed booking.
        </li>
        <li>
          Venue owners can see operational booking and game information for venues
          they manage.
        </li>
        <li>
          Admins can review user, venue, payment and trust data to operate the platform.
        </li>
      </ul>
      <p>
        Your password, full payment details, private support messages and identity
        documents are not shown publicly.
      </p>

      <h2>4. Location and address lookup</h2>
      <p>
        Tempo may use address search, map lookup or coordinates to help create venues,
        show directions, suggest nearby options and reduce wrong-location bookings.
        If you use browser location, your browser will ask permission first.
      </p>
      <p>
        Venue coordinates may be stored because they are part of the venue listing.
        Personal browser-location data is used only for the feature you request unless
        we clearly ask to store it.
      </p>

      <h2>5. Who we share data with</h2>
      <ul>
        <li>
          <strong>Payment processors</strong> such as KoraPay and Flutterwave for
          payment, verification, refunds and fraud checks.
        </li>
        <li>
          <strong>Venues and venue owners</strong> for bookings, access and operational
          fulfilment.
        </li>
        <li>
          <strong>Hosts and players</strong> where visibility is needed to run a game.
        </li>
        <li>
          <strong>Map, hosting, email, storage and database providers</strong> acting
          as service providers.
        </li>
        <li>
          <strong>Regulators, courts, banks or law-enforcement bodies</strong> where
          legally required or needed to protect users and the platform.
        </li>
      </ul>
      <p>
        We do not sell your personal data or share it with advertisers.
      </p>

      <h2>6. How long we keep data</h2>
      <ul>
        <li>Account and profile data: until you delete your account or we close it.</li>
        <li>Bookings, payments and accounting records: generally 6 years.</li>
        <li>Identity and venue-owner review records: only as long as needed for trust, safety and legal reasons.</li>
        <li>Venue listings and operational history: while the venue is active and as needed for disputes or accounting.</li>
        <li>Waitlist or lead records: until we contact you, launch in the area or you ask us to remove them.</li>
      </ul>

      <h2>7. Your rights</h2>
      <p>Subject to applicable law, you can ask us to:</p>
      <ul>
        <li>Confirm whether we process your personal data</li>
        <li>Give you a copy of your data</li>
        <li>Correct inaccurate data</li>
        <li>Delete data where we no longer need it</li>
        <li>Restrict or object to certain processing</li>
        <li>Withdraw consent where processing depends on consent</li>
        <li>Provide your data in a portable format where applicable</li>
      </ul>
      <p>
        Email <a href="mailto:info@playtempo11.com">info@playtempo11.com</a>. We aim
        to respond within 30 days. You may also complain to the Nigeria Data Protection
        Commission.
      </p>

      <h2>8. Security</h2>
      <p>
        Passwords are not stored in readable form. Data is encrypted in transit.
        Production access is restricted. The database uses row-level security so users
        should only access data they are allowed to see. If a breach creates a real
        risk to your rights, we will notify the appropriate regulator and affected
        users as required.
      </p>

      <h2>9. Children</h2>
      <p>
        Tempo is intended for users aged 18 and above. If a minor participates in a
        game or booking, a parent or legal guardian must manage the account and consent
        to the use of the minor&apos;s data. If we learn that we hold a minor&apos;s data
        without appropriate consent, we will remove it where required.
      </p>

      <h2>10. Changes</h2>
      <p>
        If we make material changes to this policy, we will notify registered users
        by email or in-app notice where practical. The date above shows the current
        version.
      </p>
    </>
  );
}
