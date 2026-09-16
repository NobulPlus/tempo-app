import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Venue Owner Terms",
  description: "Rules for listing and managing venues, spaces, availability and bookings on Tempo.",
};

export default function VenueOwnerTermsPage() {
  return (
    <>
      <h1>Venue Owner Terms</h1>
      <p className="meta">Effective 16 September 2026.</p>

      <p>
        These terms apply when you apply for venue-owner access, list a venue, manage
        spaces or accept bookings through Tempo. They sit alongside the general{" "}
        <a href="/legal/terms">Terms of Service</a>.
      </p>

      <h2>1. Approval and access</h2>
      <p>
        Venue-owner tools are not open to every account by default. Tempo may ask for
        business details, operator contact details, location information, venue photos
        or identity checks before approving access.
      </p>
      <p>
        Tempo may approve, reject, pause or remove venue-owner access if information
        cannot be verified, the venue is not suitable, complaints are unresolved, or
        the account creates trust or payment risk.
      </p>

      <h2>2. Listing accuracy</h2>
      <p>You are responsible for keeping the following accurate:</p>
      <ul>
        <li>Venue name, address, map location and contact details</li>
        <li>Photos, descriptions, amenities and supported activities</li>
        <li>Spaces or pitches, sizes, surfaces, features and restrictions</li>
        <li>Availability, pricing, peak pricing, buffers and closure periods</li>
        <li>Rules on footwear, age, parking, changing rooms, lighting and access</li>
      </ul>
      <p>
        If something changes, update the listing or contact Tempo before accepting
        more bookings.
      </p>

      <h2>3. Availability and bookings</h2>
      <p>
        Slots generated in Tempo should represent time you can actually supply. You
        must not list slots that are blocked, sold elsewhere, under maintenance or
        uncertain.
      </p>
      <p>
        When a booking or hosted game is confirmed, the venue is expected to honour
        the slot, give the customer access and provide the listed space at the listed
        time.
      </p>

      <h2>4. Cancellations and service failures</h2>
      <p>
        If you need to cancel, close early, move a customer to another pitch or mark a
        pitch unplayable, tell Tempo as early as possible. Late venue cancellations,
        double bookings, locked gates, unavailable staff or material listing
        inaccuracies may lead to customer credit, rescheduling, settlement adjustment
        or venue suspension.
      </p>

      <h2>5. Settlement</h2>
      <p>
        Tempo records money movement through platform ledgers. Venue settlement may be
        subject to payment-provider confirmation, refunds, chargebacks, disputes,
        taxes, platform fees and any payout schedule agreed with Tempo.
      </p>
      <p>
        Tempo may hold, deduct, reverse or delay settlement where there is a customer
        dispute, failed booking, suspected fraud, chargeback, duplicate payment or
        breach of these terms.
      </p>

      <h2>6. Safety and compliance</h2>
      <p>
        You are responsible for operating the venue safely and lawfully. This includes
        appropriate access control, staff conduct, surface condition, lighting,
        equipment, emergency response and compliance with applicable laws, permits and
        tax obligations.
      </p>
      <p>
        Tempo verification is not a replacement for your legal duties as a venue
        operator.
      </p>

      <h2>7. Customer data</h2>
      <p>
        Venue owners may receive booking information only to fulfil Tempo bookings.
        Do not misuse customer data, add customers to marketing lists without consent,
        sell data, contact users outside the booking purpose, or pressure users to pay
        outside Tempo.
      </p>

      <h2>8. Reviews, reports and removal</h2>
      <p>
        Tempo may review bookings, complaints, attendance, payout history and venue
        performance. Venues that repeatedly fail bookings, misdescribe facilities,
        cancel late, push side payments or create safety concerns may be unpublished
        or removed.
      </p>
    </>
  );
}
