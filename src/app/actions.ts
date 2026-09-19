"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { DEMO_COOKIE } from "@/lib/session";
import { getCurrentUser, isVenueOwner } from "@/lib/session";
import {
  joinGame,
  leaveGame,
  payGameBalance,
  cancelGame,
  decideGameMinimum,
  settleGameHostReimbursement,
  markGameAttendance,
  markBookingAttendance,
  createGameSlotTransferOffer,
  acceptGameSlotTransfer,
  getGameBySlug,
  createBooking,
  cancelBooking,
  getBookingByReference,
  getBookingsForUser,
  getSlot,
  getGameById,
  getProfileById,
  listProfiles,
  verifyVenue,
  createVenue,
  updateVenue,
  getVenueById,
  createPitch,
  updatePitch,
  getPitchById,
  generateSlots,
  setSlotStatus,
  uploadVenuePhoto,
  uploadIdentityDocument,
  submitIdentityVerification,
  reviewIdentityVerification,
  submitVenueOwnerApplication,
  reviewVenueOwnerApplication,
} from "@/lib/data/repo";
import type { UserRole, PitchSize, PitchSurface } from "@/lib/types";
import { normalisePhone, formatNaira, generateReference, formatDayShort, formatTime } from "@/lib/format";
import { isSupabaseConfigured, createClient } from "@/lib/supabase/server";
import { store } from "@/lib/data/store";
import { redirect } from "next/navigation";
import { safeNext } from "@/lib/url";
import { initializeFlutterwavePayment, isFlutterwaveConfigured } from "@/lib/payments/flutterwave";
import { initializeKorapayPayment, isKorapayConfigured, verifyKorapayTransaction } from "@/lib/payments/korapay";
import { completeVerifiedWalletTopup } from "@/lib/payments/wallet";
import { sendMail } from "@/lib/mail/transport";
import { bookingConfirmationEmail, bookingCancelledEmail, welcomeEmail, gameCancelledEmail } from "@/lib/mail/templates";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  ACTIVITY_VALUES,
  AMENITY_VALUES,
  RESOURCE_FEATURE_VALUES,
  RESOURCE_TYPE_VALUES,
} from "@/lib/venue-options";
import { isCoordinateInLagos } from "@/lib/lagos";

export type ActionState = { ok?: boolean; error?: string; message?: string };

/* ------------------------------------------------------------- waitlist -- */

const waitlistSchema = z.object({
  contact: z.string().min(3, "Enter your email or phone number"),
  area: z.string().optional(),
});

export async function joinWaitlist(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = waitlistSchema.safeParse({
    contact: formData.get("contact"),
    area: formData.get("area"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { contact, area } = parsed.data;
  const isEmail = contact.includes("@");
  const phone = isEmail ? null : normalisePhone(contact);

  if (!isEmail && !phone) {
    return { ok: false, error: "That doesn't look like a Nigerian phone number." };
  }

  if (isSupabaseConfigured()) {
    const sb = await createClient();
    const { error } = await sb.from("waitlist").insert({
      email: isEmail ? contact : null,
      phone,
      area: area || null,
    });
    if (error) return { ok: false, error: "Couldn't save that — try again in a moment." };
  }

  return {
    ok: true,
    message: area
      ? `Got it. We'll let you know as soon as we verify a pitch in ${area}.`
      : "Got it. We'll be in touch when we're live in your area.",
  };
}

/**
 * Venue-owner interest, via the same waitlist table as the player waitlist
 * above — just tagged role: 'venue_owner' so we know to follow up about
 * listing a pitch rather than playing on one. No dedicated venues-lead
 * table exists yet; this is enough for a human to follow up from.
 */
const partnerSchema = z.object({
  contact: z.string().min(3, "Enter your email or phone number"),
  area: z.string().min(1, "Tell us where your venue is"),
});

const venueOwnerApplicationSchema = z.object({
  venueName: z.string().min(2, "Enter your venue name").max(120),
  area: z.string().min(1, "Tell us the venue area").max(80),
  address: z.string().min(4, "Enter the venue address").max(220),
  phone: z.string().optional(),
  notes: z.string().max(800).optional(),
});

export async function joinPartnerWaitlist(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = partnerSchema.safeParse({
    contact: formData.get("contact"),
    area: formData.get("area"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { contact, area } = parsed.data;
  const isEmail = contact.includes("@");
  const phone = isEmail ? null : normalisePhone(contact);

  if (!isEmail && !phone) {
    return { ok: false, error: "That doesn't look like a Nigerian phone number." };
  }

  if (isSupabaseConfigured()) {
    const sb = await createClient();
    const { error } = await sb.from("waitlist").insert({
      email: isEmail ? contact : null,
      phone,
      area,
      role: "venue_owner",
    });
    if (error) return { ok: false, error: "Couldn't save that — try again in a moment." };
  }

  return {
    ok: true,
    message: "Got it. Someone from Tempo will reach out to arrange a visit.",
  };
}

export async function submitVenueOwnerApplicationAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: "Venue owner applications need a live database." };
  }

  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "AUTH_REQUIRED" };
  if (isVenueOwner(user)) return { ok: false, error: "Your account already has venue owner access." };

  const parsed = venueOwnerApplicationSchema.safeParse({
    venueName: formData.get("venueName"),
    area: formData.get("area"),
    address: formData.get("address"),
    phone: formData.get("phone") || undefined,
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form" };
  }

  const phone = parsed.data.phone ? normalisePhone(parsed.data.phone) : null;
  if (parsed.data.phone && !phone) {
    return { ok: false, error: "That doesn't look like a Nigerian phone number." };
  }

  const result = await submitVenueOwnerApplication(user.id, {
    venueName: parsed.data.venueName,
    area: parsed.data.area,
    address: parsed.data.address,
    phone,
    notes: parsed.data.notes ?? null,
  });
  if (!result.ok) {
    const message = result.error.toLowerCase().includes("pending")
      ? "You already have a pending venue owner application."
      : result.error;
    return { ok: false, error: message };
  }

  revalidatePath("/partner");
  revalidatePath("/admin/leads");
  return { ok: true, message: "Application submitted. Tempo will review your venue owner access request." };
}

/* ----------------------------------------------------------------- games -- */

export async function joinGameAction(
  gameId: string,
  slug: string,
  priceKobo: number = 0,
  providerInput: "korapay" | "flutterwave" | "wallet" = "korapay",
): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "AUTH_REQUIRED" };

  if (isSupabaseConfigured()) {
    const parsedProvider = parsePaymentProvider(providerInput);
    if (!parsedProvider.ok) return { ok: false, error: parsedProvider.error };
    const provider = parsedProvider.provider;
    const game = await getGameById(gameId);
    if (!game) return { ok: false, error: "Game not found." };

    if (provider === "wallet") {
      const result = await joinGame(gameId, user.id);
      if (!result.ok) return { ok: false, error: result.error };
      revalidatePath(`/games/${slug}`);
      revalidatePath("/games");
      revalidatePath("/dashboard");
      revalidatePath("/", "layout");
      return result.status === "waitlist"
        ? {
            ok: true,
            message: "Game is full — you're on the waitlist. We'll message you the moment a spot opens.",
          }
        : { ok: true, message: "Tempo credit applied. You're in." };
    }

    const sb = await createClient();
    const { data, error } = await sb.rpc("start_external_game_join", { p_game_id: gameId });
    if (error) return { ok: false, error: friendlyPaymentSetupError(error.message) };

    const participant = data as { id: string; status: string; paid_kobo?: number | string | null };
    if (participant.status === "waitlist") {
      revalidatePath(`/games/${slug}`);
      revalidatePath("/games");
      revalidatePath("/dashboard");
      return {
        ok: true,
        message: "Game is full — you're on the waitlist. We'll message you the moment a spot opens.",
      };
    }

    const paidKobo = Number(participant.paid_kobo ?? 0);
    const dueKobo = Math.max(0, game.pricePerPlayerKobo - paidKobo);
    if (dueKobo <= 0) {
      revalidatePath(`/games/${slug}`);
      return { ok: true, message: "You're in. See you on the pitch." };
    }

    return startExactPayment({
      kind: "join_game",
      provider,
      amountKobo: dueKobo,
      gameId,
      participantId: participant.id,
      referencePrefix: "GPY",
      title: "Tempo game spot",
      description: `Join ${game.title}`,
      payload: {
        game_id: gameId,
        game_slug: slug,
        participant_id: participant.id,
      },
    });
  }

  const result = await joinGame(gameId, user.id);
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath(`/games/${slug}`);
  revalidatePath("/games");
  revalidatePath("/dashboard");

  if (result.status === "waitlist") {
    return {
      ok: true,
      message: "Game is full — you're on the waitlist. We'll message you the moment a spot opens.",
    };
  }
  if (result.status === "pending_payment") {
    const dueKobo = priceKobo - result.paidKobo;
    const deadline = result.paymentDeadline
      ? `${formatDayShort(result.paymentDeadline)}, ${formatTime(result.paymentDeadline)}`
      : "soon";
    return {
      ok: true,
      message:
        result.paidKobo > 0
          ? `You're in — Tempo credit covered ${formatNaira(result.paidKobo)} of ${formatNaira(priceKobo)}. Pay ${formatNaira(dueKobo)} by ${deadline} to keep your spot.`
          : `You're in, on hold — pay ${formatNaira(dueKobo)} by ${deadline} to keep your spot.`,
    };
  }
  return { ok: true, message: "You're in. See you on the pitch." };
}

export async function leaveGameAction(gameId: string, slug: string): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "AUTH_REQUIRED" };

  const result = await leaveGame(gameId, user.id);
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath(`/games/${slug}`);
  revalidatePath("/games");
  revalidatePath("/dashboard");
  return { ok: true, message: "You've left the game. Your spot went to the next person waiting." };
}

export async function payGameBalanceAction(
  gameId: string,
  slug: string,
  providerInput: "korapay" | "flutterwave" | "wallet" = "korapay",
): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "AUTH_REQUIRED" };

  if (isSupabaseConfigured()) {
    const parsedProvider = parsePaymentProvider(providerInput);
    if (!parsedProvider.ok) return { ok: false, error: parsedProvider.error };
    const provider = parsedProvider.provider;
    const game = await getGameById(gameId);
    if (!game) return { ok: false, error: "Game not found." };

    if (provider === "wallet") {
      const result = await payGameBalance(gameId, user.id);
      if (!result.ok) return { ok: false, error: result.error };
      revalidatePath(`/games/${slug}`);
      revalidatePath("/dashboard");
      revalidatePath("/", "layout");
      return {
        ok: true,
        message:
          result.status === "confirmed"
            ? "Tempo credit applied. You're all paid up."
            : "Tempo credit applied — still a balance left on this one.",
      };
    }
    const participant = game.participants.find((p) => p.userId === user.id);
    if (!participant || participant.status !== "pending_payment") {
      return { ok: false, error: "No payment is due." };
    }
    const dueKobo = Math.max(0, game.pricePerPlayerKobo - participant.paidKobo);
    if (dueKobo <= 0) return { ok: true, message: "You're all paid up. See you on the pitch." };

    return startExactPayment({
      kind: "game_balance",
      provider,
      amountKobo: dueKobo,
      gameId,
      participantId: participant.id,
      referencePrefix: "GBL",
      title: "Tempo game balance",
      description: `Complete payment for ${game.title}`,
      payload: {
        game_id: gameId,
        game_slug: slug,
        participant_id: participant.id,
      },
    });
  }

  const result = await payGameBalance(gameId, user.id);
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath(`/games/${slug}`);
  revalidatePath("/dashboard");

  return {
    ok: true,
    message:
      result.status === "confirmed"
        ? "You're all paid up. See you on the pitch."
        : "Payment received — still a balance left on this one.",
  };
}

export async function cancelGameAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "AUTH_REQUIRED" };

  const gameId = String(formData.get("gameId") ?? "");
  const slug = String(formData.get("slug") ?? "");

  const result = await cancelGame(gameId, user.id, user.role === "admin");
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath(`/games/${slug}`);
  revalidatePath("/games");
  revalidatePath("/dashboard");

  if (isSupabaseConfigured() && result.refundedCount > 0) {
    await notifyGameCancelled(gameId, slug);
  }

  return {
    ok: true,
    message:
      result.refundedCount > 0
        ? `Game cancelled — ${result.refundedCount} player${result.refundedCount === 1 ? "" : "s"} refunded ${formatNaira(result.refundedKobo)} total.`
        : "Game cancelled.",
  };
}

export async function decideGameMinimumAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "AUTH_REQUIRED" };

  const gameId = String(formData.get("gameId") ?? "");
  const slug = String(formData.get("slug") ?? "");
  const decision = formData.get("decision") === "cancel" ? "cancel" : "go_ahead";

  const result = await decideGameMinimum(gameId, user.id, user.role === "admin", decision);
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath(`/games/${slug}`);
  revalidatePath("/games");
  revalidatePath("/dashboard");

  if (isSupabaseConfigured() && result.status === "cancelled") {
    await notifyGameCancelled(gameId, slug);
  }

  return {
    ok: true,
    message:
      result.decisionStatus === "cancelled"
        ? "Game cancelled — players have been refunded."
        : result.decisionStatus === "not_needed"
          ? "This game has already reached its minimum."
          : "Game marked to go ahead, even below the original minimum.",
  };
}

export async function settleGameHostReimbursementAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "AUTH_REQUIRED" };

  const gameId = String(formData.get("gameId") ?? "");
  const slug = String(formData.get("slug") ?? "");

  const result = await settleGameHostReimbursement(gameId, user.id, user.role === "admin");
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath(`/games/${slug}`);
  revalidatePath("/dashboard");
  revalidatePath("/", "layout");

  return {
    ok: true,
    message:
      result.reimbursedKobo > 0
        ? `${formatNaira(result.reimbursedKobo)} moved back to the host wallet.`
        : "No new host reimbursement is due yet.",
  };
}

export async function markGameAttendanceAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "AUTH_REQUIRED" };

  const participantId = String(formData.get("participantId") ?? "");
  const slug = String(formData.get("slug") ?? "");
  const event = String(formData.get("event") ?? "checked_in") as "checked_in" | "late" | "no_show" | "flagged";
  const minutesLateRaw = String(formData.get("minutesLate") ?? "");
  const minutesLate = minutesLateRaw ? Number(minutesLateRaw) : null;
  const note = String(formData.get("note") ?? "");
  const code = String(formData.get("code") ?? "");

  const result = await markGameAttendance(participantId, user.id, event, minutesLate, note, code);
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath(`/games/${slug}`);
  revalidatePath("/dashboard");
  return { ok: true, message: "Attendance updated." };
}

export async function markBookingAttendanceAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "AUTH_REQUIRED" };
  if (!isVenueOwner(user) && user.role !== "admin") return { ok: false, error: "Venue owner access required." };

  const bookingId = String(formData.get("bookingId") ?? "");
  const reference = String(formData.get("reference") ?? "");
  const event = String(formData.get("event") ?? "checked_in") as "checked_in" | "late" | "no_show" | "flagged";
  const minutesLateRaw = String(formData.get("minutesLate") ?? "");
  const minutesLate = minutesLateRaw ? Number(minutesLateRaw) : null;
  const note = String(formData.get("note") ?? "");
  const code = String(formData.get("code") ?? "");

  const result = await markBookingAttendance(bookingId, user.id, event, minutesLate, note, code);
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath(`/bookings/${reference}`);
  revalidatePath("/venue");
  return { ok: true, message: "Booking attendance updated." };
}

export async function markBookingAttendanceFormAction(formData: FormData): Promise<void> {
  await markBookingAttendanceAction({}, formData);
}

export async function createGameSlotTransferOfferAction(gameId: string, slug: string): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "AUTH_REQUIRED" };

  const result = await createGameSlotTransferOffer(gameId, user.id);
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath(`/games/${slug}`);
  return {
    ok: true,
    message: `Transfer code created: ${result.code}. It expires ${formatDayShort(result.expiresAt)}, ${formatTime(result.expiresAt)}.`,
  };
}

export async function acceptGameSlotTransferAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "AUTH_REQUIRED" };

  const code = String(formData.get("code") ?? "");
  const slug = String(formData.get("slug") ?? "");
  const result = await acceptGameSlotTransfer(code);
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath(`/games/${slug}`);
  revalidatePath("/dashboard");
  return { ok: true, message: "Spot transferred. You are now on the roster." };
}

/** Emails every refunded player, not just the host who triggered the
 * cancellation — needs the service-role client to resolve their emails,
 * same trust boundary the reminders cron already relies on. Never lets a
 * notification failure surface as an error; the cancellation itself is
 * already committed by the time this runs. */
async function notifyGameCancelled(gameId: string, slug: string) {
  try {
    const game = await getGameBySlug(slug);
    if (!game) return;

    const admin = createAdminClient();
    const { data: rows } = await admin
      .from("game_cancellation_refunds")
      .select("id, user_id, amount_kobo")
      .eq("game_id", gameId)
      .is("notified_at", null);

    for (const row of rows ?? []) {
      try {
        const [{ data: authUser }, profile] = await Promise.all([
          admin.auth.admin.getUserById(row.user_id),
          getProfileById(row.user_id),
        ]);
        const email = authUser?.user?.email;
        if (!email || !profile) continue;

        const content = gameCancelledEmail({
          fullName: profile.fullName,
          title: game.title,
          venueName: game.pitch.venue.name,
          kickoffISO: game.startsAt,
          refundedKobo: Math.max(0, Number(row.amount_kobo ?? 0)),
        });
        await sendMail({ to: email, ...content });
        await admin
          .from("game_cancellation_refunds")
          .update({ notified_at: new Date().toISOString() })
          .eq("id", row.id);
      } catch (err) {
        console.error("[notifyGameCancelled] failed for user", row.user_id, err);
      }
    }
  } catch (err) {
    console.error("[notifyGameCancelled] failed:", err);
  }
}

/* -------------------------------------------------------------- bookings -- */

/**
 * Live mode only — demo profiles aren't real Supabase auth users and have
 * no real email to send to. A mail failure is logged inside sendMail() and
 * never thrown, so this never risks the booking/cancellation it follows.
 */
async function currentUserEmail(): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  const sb = await createClient();
  const {
    data: { user: authUser },
  } = await sb.auth.getUser();
  return authUser?.email ?? null;
}

export async function createBookingAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "AUTH_REQUIRED" };

  const slotId = String(formData.get("slotId") ?? "");

  const parsedProvider = parsePaymentProvider(formData.get("provider"));
  if (!parsedProvider.ok) return { ok: false, error: parsedProvider.error };
  const provider = parsedProvider.provider;

  if (isSupabaseConfigured()) {
    const slot = await getSlot(slotId);
    if (!slot) return { ok: false, error: "That slot no longer exists." };
    if (slot.status !== "open") return { ok: false, error: "Sorry — someone just took that slot." };
    if (new Date(slot.startsAt).getTime() <= Date.now()) return { ok: false, error: "That time has already passed." };
    const totalKobo = slot.priceKobo + Math.round(slot.priceKobo * 0.05);

    if (provider === "wallet") {
      const result = await createBooking(slotId, user.id);
      if (!result.ok) return { ok: false, error: result.error };
      const email = await currentUserEmail();
      if (email) {
        const full = await getBookingByReference(result.booking.reference);
        if (full) {
          const { subject, html, text } = bookingConfirmationEmail({
            fullName: user.fullName,
            reference: full.reference,
            venueName: full.slot.pitch.venue.name,
            address: full.slot.pitch.venue.address,
            pitchName: full.slot.pitch.name,
            kickoffISO: full.slot.startsAt,
            totalKobo: full.totalKobo,
          });
          await sendMail({ to: email, subject, html, text });
        }
      }
      revalidatePath("/", "layout");
      redirect(`/bookings/${result.booking.reference}`);
    }

    return startExactPayment({
      kind: "booking",
      provider,
      amountKobo: totalKobo,
      slotId,
      referencePrefix: "BKG",
      title: "Tempo pitch booking",
      description: `Book ${slot.pitch.venue.name} for ${formatDayShort(slot.startsAt)}, ${formatTime(slot.startsAt)}`,
      payload: {
        slot_id: slotId,
        pitch_name: slot.pitch.name,
        venue_name: slot.pitch.venue.name,
      },
    });
  }

  const result = await createBooking(slotId, user.id);
  if (!result.ok) return { ok: false, error: result.error };

  const email = await currentUserEmail();
  if (email) {
    const full = await getBookingByReference(result.booking.reference);
    if (full) {
      const { subject, html, text } = bookingConfirmationEmail({
        fullName: user.fullName,
        reference: full.reference,
        venueName: full.slot.pitch.venue.name,
        address: full.slot.pitch.venue.address,
        pitchName: full.slot.pitch.name,
        kickoffISO: full.slot.startsAt,
        totalKobo: full.totalKobo,
      });
      await sendMail({ to: email, subject, html, text });
    }
  }

  // '/', 'layout' — not just '/dashboard'/'/wallet' — so the nav's wallet
  // balance chip (rendered by the root layout) picks up the debit too.
  revalidatePath("/", "layout");
  redirect(`/bookings/${result.booking.reference}`);
}

export async function cancelBookingAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "AUTH_REQUIRED" };

  const bookingId = String(formData.get("bookingId") ?? "");
  const result = await cancelBooking(bookingId, user.id);
  if (!result.ok) return { ok: false, error: result.error };

  const email = await currentUserEmail();
  if (email) {
    const full = await getBookingByReference(result.booking.reference);
    if (full) {
      const { subject, html, text } = bookingCancelledEmail({
        fullName: user.fullName,
        reference: full.reference,
        venueName: full.slot.pitch.venue.name,
        kickoffISO: full.slot.startsAt,
        creditedKobo: result.creditedKobo,
      });
      await sendMail({ to: email, subject, html, text });
    }
  }

  revalidatePath("/", "layout");
  revalidatePath(`/bookings/${result.booking.reference}`);

  return {
    ok: true,
    message:
      result.creditedKobo > 0
        ? `Cancelled. ${formatNaira(result.creditedKobo)} credited to your wallet.`
        : "Cancelled. This was inside 6 hours of kickoff, so no credit was issued.",
  };
}

/* ---------------------------------------------------------------- wallet -- */

const topupSchema = z.object({
  amountNaira: z.coerce.number().int().min(500, "Minimum top-up is ₦500").max(500_000, "Maximum top-up is ₦500,000"),
  provider: z.enum(["korapay", "flutterwave"]).default("korapay"),
});

const paymentProviderSchema = z.enum(["korapay", "flutterwave", "wallet"]).default("korapay");
const paymentSetupMissingMessage =
  "Payment setup is not active on the database yet. Run the latest migrations, then try again.";

function friendlyPaymentSetupError(message: string) {
  return message.includes("action_payment_intents") ||
    message.includes("start_external_game_join") ||
    message.includes("complete_action_payment") ||
    message.includes("schema cache")
    ? paymentSetupMissingMessage
    : message;
}

function parsePaymentProvider(value: FormDataEntryValue | string | null | undefined):
  | { ok: true; provider: "korapay" | "flutterwave" | "wallet" }
  | { ok: false; error: string } {
  const parsed = paymentProviderSchema.safeParse(value ?? undefined);
  if (!parsed.success) return { ok: false, error: "Choose a valid payment channel." };
  return { ok: true, provider: parsed.data };
}

async function startExactPayment(input: {
  kind: "booking" | "host_game" | "join_game" | "game_balance";
  provider: "korapay" | "flutterwave";
  amountKobo: number;
  slotId?: string;
  gameId?: string;
  participantId?: string;
  payload?: Record<string, unknown>;
  referencePrefix: "BKG" | "HST" | "GPY" | "GBL";
  title: string;
  description: string;
}): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "AUTH_REQUIRED" };
  if (!isSupabaseConfigured()) return { ok: false, error: "Payments need the live database." };

  if (input.provider === "korapay" && !isKorapayConfigured()) {
    return { ok: false, error: "Korapay is not configured yet." };
  }
  if (input.provider === "flutterwave" && !isFlutterwaveConfigured()) {
    return { ok: false, error: "Flutterwave is not configured yet." };
  }

  const sb = await createClient();
  const {
    data: { user: authUser },
  } = await sb.auth.getUser();
  if (!authUser?.email) return { ok: false, error: "Your account has no email on file." };

  const reference = `${input.referencePrefix}-${generateReference().replace("TMP-", "")}`;
  const admin = createAdminClient();
  const { error } = await admin.from("action_payment_intents").insert({
    reference,
    user_id: user.id,
    kind: input.kind,
    provider: input.provider,
    amount_kobo: input.amountKobo,
    slot_id: input.slotId ?? null,
    game_id: input.gameId ?? null,
    participant_id: input.participantId ?? null,
    payload: input.payload ?? {},
  });
  if (error) return { ok: false, error: friendlyPaymentSetupError(error.message) };

  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const callback = `${site}/wallet/callback${input.provider === "korapay" ? `?provider=korapay&tempo_reference=${encodeURIComponent(reference)}` : ""}`;

  const payment =
    input.provider === "korapay"
      ? await initializeKorapayPayment({
          reference,
          amountKobo: input.amountKobo,
          email: authUser.email,
          name: user.fullName,
          redirectUrl: callback,
          notificationUrl: `${site}/api/webhooks/korapay`,
          narration: input.description,
          metadata: { kind: input.kind },
        })
      : await initializeFlutterwavePayment({
          reference,
          amountKobo: input.amountKobo,
          email: authUser.email,
          name: user.fullName,
          redirectUrl: callback,
          title: input.title,
          description: input.description,
          metadata: { kind: input.kind },
        });

  if (!payment.ok) return { ok: false, error: payment.error };
  redirect(payment.link);
}

export async function initiateWalletTopupAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "AUTH_REQUIRED" };

  const parsed = topupSchema.safeParse({
    amountNaira: formData.get("amountNaira"),
    provider: formData.get("provider") ?? undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Enter a valid amount." };
  }
  const amountKobo = parsed.data.amountNaira * 100;
  const reference = `TOPUP-${generateReference().replace("TMP-", "")}`;

  if (!isSupabaseConfigured()) {
    // Demo mode: no real gateway to redirect to — credit instantly, same
    // fast-path createBooking() already takes in demo mode.
    const s = store();
    const balance = (s.wallets[user.id] ?? 0) + amountKobo;
    s.wallets[user.id] = balance;
    s.walletTransactions.push({
      id: `wt-${Date.now()}`,
      userId: user.id,
      type: "topup",
      status: "completed",
      amountKobo,
      balanceAfterKobo: balance,
      reference,
      provider: "demo",
      providerRef: null,
      bookingId: null,
      gameId: null,
      createdAt: new Date().toISOString(),
    });
    revalidatePath("/", "layout");
    redirect("/wallet?topup=success");
  }

  const sb = await createClient();
  const { error: initError } = await sb.rpc("initiate_wallet_topup", {
    p_reference: reference,
    p_amount_kobo: amountKobo,
  });
  if (initError) return { ok: false, error: initError.message };
  await createAdminClient()
    .from("wallet_transactions")
    .update({ provider: parsed.data.provider })
    .eq("reference", reference);

  const {
    data: { user: authUser },
  } = await sb.auth.getUser();
  if (!authUser?.email) return { ok: false, error: "Your account has no email on file." };

  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  if (parsed.data.provider === "korapay" && !isKorapayConfigured()) {
    return { ok: false, error: "Korapay is not configured yet." };
  }
  if (parsed.data.provider === "flutterwave" && !isFlutterwaveConfigured()) {
    return { ok: false, error: "Flutterwave is not configured yet." };
  }

  const result =
    parsed.data.provider === "korapay"
      ? await initializeKorapayPayment({
          reference,
          amountKobo,
          email: authUser.email,
          name: user.fullName,
          redirectUrl: `${site}/wallet/callback?provider=korapay&tempo_reference=${encodeURIComponent(reference)}`,
          notificationUrl: `${site}/api/webhooks/korapay`,
        })
      : await initializeFlutterwavePayment({
          reference,
          amountKobo,
          email: authUser.email,
          name: user.fullName,
          redirectUrl: `${site}/wallet/callback`,
        });
  if (!result.ok) return { ok: false, error: result.error };

  redirect(result.link);
}

const verifyTopupSchema = z.object({
  reference: z.string().startsWith("TOPUP-"),
});

export async function verifyPendingKorapayTopupAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/wallet");

  const parsed = verifyTopupSchema.safeParse({ reference: formData.get("reference") });
  if (!parsed.success) {
    redirect("/wallet?topup=error&reason=Invalid%20top-up%20reference.");
  }

  const sb = await createClient();
  const { data: pendingTopup, error } = await sb
    .from("wallet_transactions")
    .select("reference, status, type")
    .eq("reference", parsed.data.reference)
    .maybeSingle();

  if (error || !pendingTopup || pendingTopup.type !== "topup") {
    redirect("/wallet?topup=error&reason=We%20couldn't%20find%20that%20pending%20top-up.");
  }
  if (pendingTopup.status === "completed") {
    redirect("/wallet?topup=success");
  }

  const verified = await verifyKorapayTransaction(parsed.data.reference);
  if (!verified.ok) {
    redirect(`/wallet?topup=error&reason=${encodeURIComponent(`Couldn't verify that Korapay payment — ${verified.error}`)}`);
  }
  if (verified.status !== "success" || verified.currency !== "NGN") {
    redirect("/wallet?topup=error&reason=Korapay%20has%20not%20marked%20that%20payment%20as%20successful%20yet.");
  }

  const completed = await completeVerifiedWalletTopup({
    reference: parsed.data.reference,
    amountKobo: verified.amountKobo,
    providerRef: verified.providerRef,
    raw: verified.raw,
  });

  if (!completed.ok) {
    redirect(`/wallet?topup=error&reason=${encodeURIComponent(completed.error)}`);
  }

  redirect("/wallet?topup=success");
}

export async function adminVerifyPendingKorapayTopupAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, error: "Not authorized." };

  const parsed = verifyTopupSchema.safeParse({ reference: formData.get("reference") });
  if (!parsed.success) return { ok: false, error: "Invalid top-up reference." };

  const verified = await verifyKorapayTransaction(parsed.data.reference);
  if (!verified.ok) return { ok: false, error: `Couldn't verify Korapay payment — ${verified.error}` };
  if (verified.status !== "success" || verified.currency !== "NGN") {
    return { ok: false, error: "Korapay has not marked that payment as successful yet." };
  }

  const completed = await completeVerifiedWalletTopup({
    reference: parsed.data.reference,
    amountKobo: verified.amountKobo,
    providerRef: verified.providerRef,
    raw: verified.raw,
  });

  if (!completed.ok) return { ok: false, error: completed.error };

  revalidatePath("/admin");
  revalidatePath("/admin/finance");
  revalidatePath("/", "layout");
  return { ok: true, message: "Payment verified and wallet credited." };
}

/* ------------------------------------------------------------------ host -- */

const hostSchema = z.object({
  slotId: z.string().optional(),
  existingBookingId: z.string().optional(),
  title: z.string().min(4, "Give your game a name"),
  description: z.string().max(600).optional(),
  level: z.enum(["casual", "intermediate", "competitive"]),
  capacity: z.coerce.number().int().min(4).max(30),
  minimumToGuarantee: z.coerce.number().int().min(2),
  pricePerPlayerNaira: z.coerce.number().int().min(0).max(200000),
  bibsProvided: z.coerce.boolean().optional(),
  preconfirmedPlayerCount: z.coerce.number().int().min(1).optional(),
});

export async function createGameAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "AUTH_REQUIRED" };

  const parsed = hostSchema.safeParse({
    slotId: formData.get("slotId"),
    existingBookingId: formData.get("existingBookingId"),
    title: formData.get("title"),
    description: formData.get("description"),
    level: formData.get("level"),
    capacity: formData.get("capacity"),
    minimumToGuarantee: formData.get("minimumToGuarantee"),
    pricePerPlayerNaira: formData.get("pricePerPlayerNaira"),
    bibsProvided: formData.get("bibsProvided") === "on",
    preconfirmedPlayerCount: formData.get("preconfirmedPlayerCount") || undefined,
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form" };
  }
  const v = parsed.data;
  const isExistingSession = Boolean(v.existingBookingId);
  const preconfirmedPlayerCount = v.preconfirmedPlayerCount ?? 0;
  if (!isExistingSession && !v.slotId) return { ok: false, error: "Pick a time slot." };
  if (isExistingSession && !v.preconfirmedPlayerCount) return { ok: false, error: "Enter the players already confirmed." };
  if (isExistingSession && preconfirmedPlayerCount >= v.capacity) {
    return { ok: false, error: "Leave at least one space for Tempo players." };
  }
  if (v.minimumToGuarantee > v.capacity) {
    return { ok: false, error: "The guarantee number can't be higher than capacity." };
  }

  if (isExistingSession && isSupabaseConfigured()) {
    const sb = await createClient();
    const { data, error } = await sb.rpc("publish_existing_session", {
      p_booking_id: v.existingBookingId,
      p_title: v.title,
      p_description: v.description ?? "",
      p_level: v.level,
      p_capacity: v.capacity,
      p_minimum_to_guarantee: v.minimumToGuarantee,
      p_price_per_player_kobo: v.pricePerPlayerNaira * 100,
      p_preconfirmed_player_count: preconfirmedPlayerCount,
      p_bibs_provided: Boolean(v.bibsProvided),
    });
    if (error) return { ok: false, error: error.message };
    revalidatePath("/games");
    revalidatePath("/dashboard");
    redirect(`/games/${(data as { slug: string }).slug}`);
  }

  if (!isSupabaseConfigured()) {
    if (isExistingSession) {
      const booking = (await getBookingsForUser(user.id)).find((item) => item.id === v.existingBookingId);
      if (!booking?.slot || booking.status !== "confirmed") return { ok: false, error: "That booking is not available to publish." };
      const s = store();
      if (s.games.some((game) => game.bookingId === booking.id)) return { ok: false, error: "You have already published this booking." };
      const gameId = `g-${Date.now()}`;
      const slug = `${v.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${Date.now().toString(36).slice(-4)}`;
      s.games.push({
        id: gameId, slug, pitchId: booking.slot.pitchId, hostId: user.id, bookingId: booking.id,
        title: v.title, description: v.description ?? "", level: v.level,
        startsAt: booking.slot.startsAt, endsAt: booking.slot.endsAt, capacity: v.capacity,
        minimumToGuarantee: v.minimumToGuarantee, pricePerPlayerKobo: v.pricePerPlayerNaira * 100,
        status: "open", bibsProvided: Boolean(v.bibsProvided), preconfirmedPlayerCount,
        isExistingSession: true, hostPaidKobo: booking.totalKobo, hostReimbursedKobo: 0,
        minimumDecisionDeadline: new Date(Math.max(Date.now(), new Date(booking.slot.startsAt).getTime() - 6 * 60 * 60 * 1000)).toISOString(),
        minimumDecisionStatus: preconfirmedPlayerCount >= v.minimumToGuarantee ? "not_needed" : "pending",
        createdAt: new Date().toISOString(),
      });
      revalidatePath("/games");
      redirect(`/games/${slug}`);
    }
    const s = store();
    const slot = s.slots.find((x) => x.id === v.slotId);
    if (!slot) return { ok: false, error: "That slot no longer exists." };
    if (slot.status !== "open") return { ok: false, error: "Someone just booked that slot." };

    const hostFeeKobo = Math.round(slot.priceKobo * 0.05);
    const hostTotalKobo = slot.priceKobo + hostFeeKobo;
    const hostBalance = s.wallets[user.id] ?? 0;
    if (hostBalance < hostTotalKobo) {
      return {
        ok: false,
        error: `Add at least ${formatNaira(hostTotalKobo - hostBalance)} in demo credit to reserve this pitch.`,
      };
    }

    slot.status = "booked";
    s.wallets[user.id] = hostBalance - hostTotalKobo;

    const gameId = `g-${Date.now()}`;
    const slug = `${v.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")}-${Date.now().toString(36).slice(-4)}`;

    s.games.push({
      id: gameId,
      slug,
      pitchId: slot.pitchId,
      hostId: user.id,
      title: v.title,
      description: v.description ?? "",
      level: v.level,
      startsAt: slot.startsAt,
      endsAt: slot.endsAt,
      capacity: v.capacity,
      minimumToGuarantee: v.minimumToGuarantee,
      pricePerPlayerKobo: v.pricePerPlayerNaira * 100,
      status: "open",
      bibsProvided: Boolean(v.bibsProvided),
      hostPaidKobo: hostTotalKobo,
      hostReimbursedKobo: 0,
      minimumDecisionDeadline: new Date(
        Math.max(Date.now(), new Date(slot.startsAt).getTime() - 6 * 60 * 60 * 1000),
      ).toISOString(),
      minimumDecisionStatus: v.minimumToGuarantee <= 1 ? "not_needed" : "pending",
      createdAt: new Date().toISOString(),
    });

    s.walletTransactions.push({
      id: `wt-${Date.now()}`,
      userId: user.id,
      type: "host_game_deposit",
      status: "completed",
      amountKobo: -hostTotalKobo,
      balanceAfterKobo: s.wallets[user.id],
      reference: `HST-${Date.now().toString(36).toUpperCase()}`,
      provider: "wallet",
      providerRef: null,
      bookingId: null,
      gameId,
      createdAt: new Date().toISOString(),
    });

    // The host is automatically the first player.
    s.participants.push({
      id: `gp-${slug}-${user.id}`,
      gameId,
      userId: user.id,
      joinedAt: new Date().toISOString(),
      paidKobo: 0,
      status: "confirmed",
      checkInCode: `GME-${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
      attendanceStatus: "booked",
    });

    revalidatePath("/", "layout");
    revalidatePath("/games");
    redirect(`/games/${slug}`);
  }

  const parsedProvider = parsePaymentProvider(formData.get("provider"));
  if (!parsedProvider.ok) return { ok: false, error: parsedProvider.error };
  const provider = parsedProvider.provider;
  const slotId = v.slotId;
  if (!slotId) return { ok: false, error: "Pick a time slot." };
  const slot = await getSlot(slotId);
  if (!slot) return { ok: false, error: "That slot no longer exists." };
  if (slot.status !== "open") return { ok: false, error: "Someone just booked that slot." };
  if (new Date(slot.startsAt).getTime() <= Date.now()) return { ok: false, error: "That time has already passed." };

  const hostTotalKobo = slot.priceKobo + Math.round(slot.priceKobo * 0.05);
  if (provider === "wallet") {
    const sb = await createClient();
    const { data, error } = await sb.rpc("host_game", {
      p_slot_id: slotId,
      p_title: v.title,
      p_description: v.description ?? "",
      p_level: v.level,
      p_capacity: v.capacity,
      p_minimum_to_guarantee: v.minimumToGuarantee,
      p_price_per_player_kobo: v.pricePerPlayerNaira * 100,
      p_bibs_provided: Boolean(v.bibsProvided),
    });

    if (error) {
      return {
        ok: false,
        error: error.message.includes("no longer available")
          ? "Someone just booked that slot."
          : error.message.includes("insufficient wallet balance")
            ? "Not enough Tempo credit to reserve this pitch."
            : error.message,
      };
    }

    revalidatePath("/", "layout");
    revalidatePath("/games");
    redirect(`/games/${(data as { slug: string }).slug}`);
  }

  return startExactPayment({
    kind: "host_game",
    provider,
    amountKobo: hostTotalKobo,
    slotId,
    referencePrefix: "HST",
    title: "Tempo hosted game",
    description: `Reserve ${slot.pitch.venue.name} and publish ${v.title}`,
    payload: {
      slot_id: slotId,
      title: v.title,
      description: v.description ?? "",
      level: v.level,
      capacity: v.capacity,
      minimum_to_guarantee: v.minimumToGuarantee,
      price_per_player_kobo: v.pricePerPlayerNaira * 100,
      bibs_provided: Boolean(v.bibsProvided),
      pitch_name: slot.pitch.name,
      venue_name: slot.pitch.venue.name,
    },
  });
}

/* ------------------------------------------------------------------ auth -- */

const signUpSchema = z
  .object({
    fullName: z.string().min(2, "Enter your full name").max(80),
    email: z.string().email("Enter a valid email"),
    phone: z.string().optional(),
    password: z.string().min(8, "Password must be at least 8 characters"),
    password2: z.string(),
    dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter your date of birth"),
    guardianSupervision: z.string().optional(),
    terms: z.literal("on", { message: "You have to accept the terms to continue" }),
  })
  .refine((v) => v.password === v.password2, {
    message: "Passwords don't match",
    path: ["password2"],
  })
  .refine((v) => v.fullName.trim().split(/\s+/).filter(Boolean).length >= 2, {
    message: "Enter your first and last name",
    path: ["fullName"],
  });

/**
 * Real registration. Deliberately never sends a `role` — every new account
 * is a player; 0002_auth_hardening.sql hardcodes that server-side too, so
 * this isn't the only thing standing between a signup and an elevated role.
 *
 * Supabase still sends the email, but the intended UX is now a typed code:
 * configure the Supabase signup email template to include `{{ .Token }}` and
 * send users to /signup/verify instead of asking them to click a magic link.
 */
export async function signUpAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      error: "This deploy has no database connected yet — use demo sign-in from the login page instead.",
    };
  }

  const parsed = signUpSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    phone: formData.get("phone") || undefined,
    password: formData.get("password"),
    password2: formData.get("password2"),
    dateOfBirth: formData.get("dateOfBirth"),
    guardianSupervision: formData.get("guardianSupervision") || undefined,
    terms: formData.get("terms"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form" };
  }

  const { fullName, password } = parsed.data;
  const birthDate = new Date(`${parsed.data.dateOfBirth}T00:00:00.000Z`);
  if (Number.isNaN(birthDate.getTime())) return { ok: false, error: "Enter a valid date of birth." };
  const today = new Date();
  const age = today.getUTCFullYear() - birthDate.getUTCFullYear() -
    (Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()) < Date.UTC(today.getUTCFullYear(), birthDate.getUTCMonth(), birthDate.getUTCDate()) ? 1 : 0);
  if (age < 16) return { ok: false, error: "Tempo is available from age 16." };
  if (age < 18 && parsed.data.guardianSupervision !== "on") {
    return { ok: false, error: "A parent or guardian must supervise users under 18." };
  }
  const email = parsed.data.email.toLowerCase();
  const phone = parsed.data.phone ? normalisePhone(parsed.data.phone) : null;
  if (parsed.data.phone && !phone) {
    return { ok: false, error: "That doesn't look like a Nigerian phone number." };
  }

  const sb = await createClient();
  const { data, error } = await sb.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName, phone, date_of_birth: parsed.data.dateOfBirth, guardian_supervision: age < 18 } },
  });

  if (error) {
    return {
      ok: false,
      error: error.message.includes("already registered")
        ? "An account already exists with that email — try signing in instead."
        : error.message,
    };
  }

  // Supabase only withholds a session when the project's "Confirm email"
  // setting is on. If it returns a session, no signup OTP was sent, so don't
  // route the user to an impossible code-entry step.
  if (data.session) {
    await sb.auth.signOut();
    redirect("/login?verified=1&next=%2Fdashboard");
  }

  redirect(`/signup/verify?email=${encodeURIComponent(email)}`);
}

const verifySignupOtpSchema = z.object({
  email: z.string().email("Enter a valid email").transform((value) => value.toLowerCase()),
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Enter the 6-digit code from your email"),
  next: z.string().optional(),
});

export async function verifySignupOtpAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      error: "This deploy has no database connected yet — use demo sign-in from the login page instead.",
    };
  }

  const parsed = verifySignupOtpSchema.safeParse({
    email: formData.get("email"),
    code: formData.get("code"),
    next: formData.get("next") || undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the code" };
  }

  const sb = await createClient();
  const { data, error } = await sb.auth.verifyOtp({
    email: parsed.data.email,
    token: parsed.data.code,
    type: "signup",
  });
  if (error) {
    const message = error.message.toLowerCase();
    return {
      ok: false,
      error: message.includes("expired")
        ? "That code has expired. Send a new one and try again."
        : message.includes("rate limit") || message.includes("too many")
          ? "Too many attempts. Wait a bit before trying again."
          : "That code didn't work. Check the email and try again.",
    };
  }

  const profile = data.user ? await getProfileById(data.user.id) : null;
  if (profile) {
    const welcome = welcomeEmail({
      fullName: profile.fullName,
      email: parsed.data.email,
      phone: null,
      handle: profile.handle,
    });
    await sendMail({ to: parsed.data.email, ...welcome });
  }

  // verifyOtp() establishes a session, but the intended flow is
  // signup -> verify -> log in manually -> dashboard, not straight in.
  await sb.auth.signOut();

  const next = safeNext(parsed.data.next || "/dashboard");
  redirect(`/login?verified=1&next=${encodeURIComponent(next)}`);
}

const resendSignupOtpSchema = z.object({
  email: z.string().email("Enter a valid email").transform((value) => value.toLowerCase()),
});

export async function resendSignupOtpAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      error: "This deploy has no database connected yet — use demo sign-in from the login page instead.",
    };
  }

  const parsed = resendSignupOtpSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Enter a valid email" };
  }

  const sb = await createClient();
  const { error } = await sb.auth.resend({ type: "signup", email: parsed.data.email });
  if (error) return { ok: false, error: error.message };

  return { ok: true, message: "A fresh code is on its way." };
}

const signInSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Enter your password"),
  next: z.string().optional(),
});

export async function signInAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      error: "This deploy has no database connected yet — use demo sign-in below instead.",
    };
  }

  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next") || undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form" };
  }

  const sb = await createClient();
  const { error } = await sb.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    return { ok: false, error: "Incorrect email or password." };
  }

  revalidatePath("/", "layout");
  redirect(safeNext(parsed.data.next));
}

/* ----------------------------------------------------------- password reset */

const resetRequestSchema = z.object({
  email: z.string().email("Enter a valid email"),
});

/**
 * Never reveals whether the email is actually registered — same success
 * message either way. Supabase's own resetPasswordForEmail behaves the same
 * way for the same reason: an error here would let someone enumerate emails.
 */
export async function requestPasswordResetAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      error: "This deploy has no database connected yet — use demo sign-in from the login page instead.",
    };
  }

  const parsed = resetRequestSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Enter a valid email" };
  }

  const sb = await createClient();
  const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://playtempo11.com";
  await sb.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${SITE}/auth/confirm?next=/reset/confirm`,
  });

  return {
    ok: true,
    message: "If an account exists for that email, we've sent a link to reset your password.",
  };
}

const newPasswordSchema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters"),
    password2: z.string(),
  })
  .refine((v) => v.password === v.password2, {
    message: "Passwords don't match",
    path: ["password2"],
  });

/**
 * Only reachable with a real session — /reset/confirm's own page guard
 * redirects anyone without one, and the recovery link (verified by
 * /auth/confirm) is what establishes that session in the first place.
 */
export async function updatePasswordAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = newPasswordSchema.safeParse({
    password: formData.get("password"),
    password2: formData.get("password2"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form" };
  }

  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Your reset link has expired — request a new one." };

  const sb = await createClient();
  const { error } = await sb.auth.updateUser({ password: parsed.data.password });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

/**
 * Demo sign-in. With Supabase configured this is replaced by real password
 * auth — see /login. Demo mode lets you inhabit any seeded player so you can
 * see the product as a host, a venue owner or a new player.
 */
export async function demoSignIn(profileId: string) {
  const profiles = await listProfiles();
  if (!profiles.some((p) => p.id === profileId)) return;
  const jar = await cookies();
  jar.set(DEMO_COOKIE, profileId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  revalidatePath("/", "layout");
}

/* ------------------------------------------------------------------ venue -- */

const createVenueSchema = z.object({
  name: z.string().min(2, "Give your venue a name"),
  area: z.string().min(1, "Enter an area"),
  side: z.enum(["island", "mainland"]),
  address: z.string().min(4, "Enter an address"),
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  activityType: z.string().refine((value) => ACTIVITY_VALUES.includes(value), "Choose a valid primary activity"),
  supportedActivities: z
    .array(z.string().refine((value) => ACTIVITY_VALUES.includes(value), "Choose valid supported activities"))
    .min(1),
  amenities: z.array(z.string().refine((value) => AMENITY_VALUES.includes(value), "Choose valid venue features")),
  phone: z.string().optional(),
  description: z.string().max(600).optional(),
});

function uniqueFormStrings(values: FormDataEntryValue[]) {
  return [...new Set(values.map(String).filter(Boolean))];
}

function venuePhotosFromForm(formData: FormData): File[] {
  return formData
    .getAll("photo")
    .filter((file): file is File => file instanceof File && file.size > 0)
    .slice(0, 8);
}

function validateVenuePhoto(file: File): string | null {
  if (!file.type.startsWith("image/")) return "Venue photo must be an image.";
  if (file.size > 6 * 1024 * 1024) return "Venue photo is too large — keep it under 6MB.";
  return null;
}

function validateLagosCoordinates(lat: number, lng: number): string | null {
  return isCoordinateInLagos(lat, lng) ? null : "Venue location must be inside Lagos.";
}

export async function createVenueAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "AUTH_REQUIRED" };
  if (!isVenueOwner(user)) return { ok: false, error: "Venue owner access required." };

  const activityType = String(formData.get("activityType") || "football");
  const parsed = createVenueSchema.safeParse({
    name: formData.get("name"),
    area: formData.get("area"),
    side: formData.get("side"),
    address: formData.get("address"),
    lat: formData.get("lat"),
    lng: formData.get("lng"),
    activityType,
    supportedActivities: uniqueFormStrings([activityType, ...formData.getAll("supportedActivities")]),
    amenities: uniqueFormStrings(formData.getAll("amenities")),
    phone: formData.get("phone") || undefined,
    description: formData.get("description") || undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form" };
  }
  const invalidLocation = validateLagosCoordinates(parsed.data.lat, parsed.data.lng);
  if (invalidLocation) return { ok: false, error: invalidLocation };

  const photos = venuePhotosFromForm(formData);
  for (const photo of photos) {
    const invalid = validateVenuePhoto(photo);
    if (invalid) return { ok: false, error: invalid };
  }

  const result = await createVenue(user.id, parsed.data);
  if (!result.ok) return { ok: false, error: result.error };

  if (photos.length > 0) {
    const uploadedUrls: string[] = [];
    for (const photo of photos) {
      const uploaded = await uploadVenuePhoto(user.id, result.venue.id, photo);
      if (!uploaded.ok) return { ok: false, error: uploaded.error };
      uploadedUrls.push(uploaded.url);
    }
    const photoSaved = await updateVenue(result.venue.id, { photos: uploadedUrls });
    if (!photoSaved.ok) return { ok: false, error: photoSaved.error ?? "Venue created, but the photo could not be saved." };
  }

  revalidatePath("/venue");
  redirect(`/venue/${result.venue.id}`);
}

const updateVenueSchema = z.object({
  name: z.string().min(2).optional(),
  area: z.string().min(1).optional(),
  side: z.enum(["island", "mainland"]).optional(),
  address: z.string().min(4).optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  activityType: z.string().refine((value) => ACTIVITY_VALUES.includes(value), "Choose a valid primary activity").optional(),
  supportedActivities: z
    .array(z.string().refine((value) => ACTIVITY_VALUES.includes(value), "Choose valid supported activities"))
    .min(1)
    .optional(),
  amenities: z.array(z.string().refine((value) => AMENITY_VALUES.includes(value), "Choose valid venue features")).optional(),
  phone: z.string().optional(),
  description: z.string().max(600).optional(),
});

export async function updateVenueAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "AUTH_REQUIRED" };
  if (!isVenueOwner(user)) return { ok: false, error: "Venue owner access required." };

  const venueId = String(formData.get("venueId") ?? "");
  const venue = await getVenueById(venueId);
  if (!venue || venue.ownerId !== user.id) return { ok: false, error: "Not authorized." };

  const nextActivityType = String(formData.get("activityType") || venue.activityType || "football");
  const parsed = updateVenueSchema.safeParse({
    name: formData.get("name") || undefined,
    area: formData.get("area") || undefined,
    side: formData.get("side") || undefined,
    address: formData.get("address") || undefined,
    lat: formData.get("lat") || undefined,
    lng: formData.get("lng") || undefined,
    activityType: nextActivityType,
    supportedActivities: uniqueFormStrings([nextActivityType, ...formData.getAll("supportedActivities")]),
    amenities: uniqueFormStrings(formData.getAll("amenities")),
    phone: formData.get("phone") || undefined,
    description: formData.get("description") || undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form" };
  }
  if (parsed.data.lat !== undefined && parsed.data.lng !== undefined) {
    const invalidLocation = validateLagosCoordinates(parsed.data.lat, parsed.data.lng);
    if (invalidLocation) return { ok: false, error: invalidLocation };
  }

  const patch: Parameters<typeof updateVenue>[1] = { ...parsed.data };
  const photos = venuePhotosFromForm(formData);
  for (const photo of photos) {
    const invalid = validateVenuePhoto(photo);
    if (invalid) return { ok: false, error: invalid };
  }
  if (photos.length > 0) {
    const uploadedUrls: string[] = [];
    for (const photo of photos) {
      const uploaded = await uploadVenuePhoto(user.id, venueId, photo);
      if (!uploaded.ok) return { ok: false, error: uploaded.error };
      uploadedUrls.push(uploaded.url);
    }
    patch.photos = [...uploadedUrls, ...venue.photos].slice(0, 8);
  }

  const result = await updateVenue(venueId, patch);
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath(`/venue/${venueId}`);
  return { ok: true, message: "Venue updated." };
}

/* ------------------------------------------------------------------ pitch -- */

const createPitchSchema = z.object({
  name: z.string().min(2, "Give this bookable space a name"),
  resourceType: z.string().refine((value) => RESOURCE_TYPE_VALUES.includes(value), "Choose a valid resource type"),
  activityType: z.string().refine((value) => ACTIVITY_VALUES.includes(value), "Choose a valid primary activity"),
  supportedActivities: z
    .array(z.string().refine((value) => ACTIVITY_VALUES.includes(value), "Choose valid supported activities"))
    .min(1),
  size: z.enum(["5-a-side", "7-a-side", "11-a-side"]),
  surface: z.enum(["astro", "grass", "indoor", "concrete"]),
  floodlights: z.coerce.boolean().optional(),
  covered: z.coerce.boolean().optional(),
  amenities: z.array(z.string().refine((value) => RESOURCE_FEATURE_VALUES.includes(value), "Choose valid resource features")),
  capacity: z.coerce.number().int().min(1).max(500).optional(),
  recommendedPlayers: z.coerce.number().int().min(1).max(100).optional(),
  description: z.string().max(600).optional(),
  pricePerHourNaira: z.coerce.number().int().min(500).max(500000),
  peakMultiplier: z.coerce.number().min(1).max(3),
});

function resourcePhotosFromForm(formData: FormData): File[] {
  return formData
    .getAll("resourcePhotos")
    .filter((file): file is File => file instanceof File && file.size > 0)
    .slice(0, 8);
}

export async function createPitchAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "AUTH_REQUIRED" };
  if (!isVenueOwner(user)) return { ok: false, error: "Venue owner access required." };

  const venueId = String(formData.get("venueId") ?? "");
  const venue = await getVenueById(venueId);
  if (!venue || venue.ownerId !== user.id) return { ok: false, error: "Not authorized." };

  const activityType = String(formData.get("activityType") || "football");
  const parsed = createPitchSchema.safeParse({
    name: formData.get("name"),
    resourceType: formData.get("resourceType") || "pitch",
    activityType,
    supportedActivities: uniqueFormStrings([activityType, ...formData.getAll("supportedActivities")]),
    size: formData.get("size"),
    surface: formData.get("surface"),
    amenities: uniqueFormStrings(formData.getAll("amenities")),
    capacity: formData.get("capacity") || undefined,
    recommendedPlayers: formData.get("recommendedPlayers") || undefined,
    description: formData.get("description") || undefined,
    pricePerHourNaira: formData.get("pricePerHourNaira"),
    peakMultiplier: formData.get("peakMultiplier"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form" };
  }

  const v = parsed.data;
  const photos = resourcePhotosFromForm(formData);
  for (const photo of photos) {
    const invalid = validateVenuePhoto(photo);
    if (invalid) return { ok: false, error: invalid };
  }

  const result = await createPitch(venueId, {
    name: v.name,
    resourceType: v.resourceType,
    activityType: v.activityType,
    supportedActivities: v.supportedActivities,
    size: v.size as PitchSize,
    surface: v.surface as PitchSurface,
    floodlights: v.amenities.includes("floodlights"),
    covered: v.amenities.includes("covered"),
    amenities: v.amenities,
    capacity: v.capacity ?? null,
    recommendedPlayers: v.recommendedPlayers ?? null,
    description: v.description ?? "",
    pricePerHourKobo: v.pricePerHourNaira * 100,
    peakMultiplier: v.peakMultiplier,
  });
  if (!result.ok) return { ok: false, error: result.error };

  if (photos.length > 0) {
    const uploadedUrls: string[] = [];
    for (const photo of photos) {
      const uploaded = await uploadVenuePhoto(user.id, venueId, photo);
      if (!uploaded.ok) return { ok: false, error: uploaded.error };
      uploadedUrls.push(uploaded.url);
    }
    const saved = await updatePitch(result.pitch.id, { photos: uploadedUrls });
    if (!saved.ok) return { ok: false, error: saved.error ?? "Bookable space created, but the photos could not be saved." };
  }

  revalidatePath(`/venue/${venueId}`);
  return { ok: true, message: `${result.pitch.name} added.` };
}

const updatePitchSchema = z.object({
  name: z.string().min(2).optional(),
  resourceType: z.string().refine((value) => RESOURCE_TYPE_VALUES.includes(value), "Choose a valid resource type").optional(),
  activityType: z.string().refine((value) => ACTIVITY_VALUES.includes(value), "Choose a valid primary activity").optional(),
  supportedActivities: z
    .array(z.string().refine((value) => ACTIVITY_VALUES.includes(value), "Choose valid supported activities"))
    .min(1)
    .optional(),
  size: z.enum(["5-a-side", "7-a-side", "11-a-side"]).optional(),
  surface: z.enum(["astro", "grass", "indoor", "concrete"]).optional(),
  pricePerHourNaira: z.coerce.number().int().min(500).max(500000).optional(),
  peakMultiplier: z.coerce.number().min(1).max(3).optional(),
  floodlights: z.coerce.boolean().optional(),
  covered: z.coerce.boolean().optional(),
  amenities: z.array(z.string().refine((value) => RESOURCE_FEATURE_VALUES.includes(value), "Choose valid resource features")).optional(),
  capacity: z.coerce.number().int().min(1).max(500).optional(),
  recommendedPlayers: z.coerce.number().int().min(1).max(100).optional(),
  description: z.string().max(600).optional(),
  active: z.coerce.boolean().optional(),
});

export async function updatePitchAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "AUTH_REQUIRED" };
  if (!isVenueOwner(user)) return { ok: false, error: "Venue owner access required." };

  const pitchId = String(formData.get("pitchId") ?? "");
  const pitch = await getPitchById(pitchId);
  if (!pitch || pitch.venue.ownerId !== user.id) return { ok: false, error: "Not authorized." };

  const nextActivityType = String(formData.get("activityType") || pitch.activityType || "football");
  const parsed = updatePitchSchema.safeParse({
    name: formData.get("name") || undefined,
    resourceType: formData.get("resourceType") || undefined,
    activityType: nextActivityType,
    supportedActivities: uniqueFormStrings([nextActivityType, ...formData.getAll("supportedActivities")]),
    size: formData.get("size") || undefined,
    surface: formData.get("surface") || undefined,
    pricePerHourNaira: formData.get("pricePerHourNaira") || undefined,
    peakMultiplier: formData.get("peakMultiplier") || undefined,
    amenities: formData.has("amenitiesMarker") ? uniqueFormStrings(formData.getAll("amenities")) : undefined,
    capacity: formData.get("capacity") || undefined,
    recommendedPlayers: formData.get("recommendedPlayers") || undefined,
    description: formData.get("description") || undefined,
    active: formData.has("active") ? formData.get("active") === "true" : undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form" };
  }

  const v = parsed.data;
  const patch: Parameters<typeof updatePitch>[1] = {
    name: v.name,
    resourceType: v.resourceType,
    activityType: v.activityType,
    supportedActivities: v.supportedActivities,
    size: v.size as PitchSize | undefined,
    surface: v.surface as PitchSurface | undefined,
    pricePerHourKobo: v.pricePerHourNaira !== undefined ? v.pricePerHourNaira * 100 : undefined,
    peakMultiplier: v.peakMultiplier,
    floodlights: v.amenities?.includes("floodlights"),
    covered: v.amenities?.includes("covered"),
    amenities: v.amenities,
    capacity: v.capacity ?? undefined,
    recommendedPlayers: v.recommendedPlayers ?? undefined,
    description: v.description,
    active: v.active,
  };

  const photos = resourcePhotosFromForm(formData);
  for (const photo of photos) {
    const invalid = validateVenuePhoto(photo);
    if (invalid) return { ok: false, error: invalid };
  }
  if (photos.length > 0) {
    const uploadedUrls: string[] = [];
    for (const photo of photos) {
      const uploaded = await uploadVenuePhoto(user.id, pitch.venueId, photo);
      if (!uploaded.ok) return { ok: false, error: uploaded.error };
      uploadedUrls.push(uploaded.url);
    }
    patch.photos = [...uploadedUrls, ...(pitch.photos ?? [])].slice(0, 8);
  }

  const result = await updatePitch(pitchId, patch);
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath(`/venue/${pitch.venueId}`);
  return { ok: true, message: "Pitch updated." };
}

/* ------------------------------------------------------------------ slots -- */

const generateSlotsSchema = z.object({
  daysAhead: z.coerce.number().int().min(1).max(60),
  slotDurationMinutes: z.coerce.number().int().min(30).max(240),
  bufferMinutes: z.coerce.number().int().min(0).max(120),
  rules: z
    .array(
      z.object({
        name: z.string().max(40).optional(),
        daysOfWeek: z.array(z.coerce.number().int().min(0).max(6)).min(1),
        openMinutes: z.coerce.number().int().min(0).max(1439),
        closeMinutes: z.coerce.number().int().min(1).max(1440),
        basePriceNaira: z.coerce.number().int().min(500).max(500000),
        peakStartMinutes: z.coerce.number().int().min(0).max(1439).nullable().optional(),
        peakEndMinutes: z.coerce.number().int().min(1).max(1440).nullable().optional(),
        peakPriceNaira: z.coerce.number().int().min(500).max(500000).nullable().optional(),
      }),
    )
    .min(1)
    .max(7),
});

export async function generateSlotsAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "AUTH_REQUIRED" };
  if (!isVenueOwner(user)) return { ok: false, error: "Venue owner access required." };

  const pitchId = String(formData.get("pitchId") ?? "");
  const pitch = await getPitchById(pitchId);
  if (!pitch || pitch.venue.ownerId !== user.id) return { ok: false, error: "Not authorized." };

  const parsedRules = parseSlotRules(formData);
  if (!parsedRules.ok) return { ok: false, error: parsedRules.error };

  const parsed = generateSlotsSchema.safeParse({
    daysAhead: formData.get("daysAhead"),
    slotDurationMinutes: formData.get("slotDurationMinutes"),
    bufferMinutes: formData.get("bufferMinutes"),
    rules: parsedRules.rules,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form" };
  }
  for (const rule of parsed.data.rules) {
    if (rule.openMinutes >= rule.closeMinutes) {
      return { ok: false, error: `${rule.name || "A rule"} closes before it opens.` };
    }
    if (
      rule.peakPriceNaira &&
      (rule.peakStartMinutes === null ||
        rule.peakStartMinutes === undefined ||
        rule.peakEndMinutes === null ||
        rule.peakEndMinutes === undefined ||
        rule.peakStartMinutes >= rule.peakEndMinutes)
    ) {
      return { ok: false, error: `${rule.name || "A rule"} needs a valid peak time window.` };
    }
  }

  const result = await generateSlots(
    pitchId,
    pitch.pricePerHourKobo,
    pitch.peakMultiplier,
    {
      daysAhead: parsed.data.daysAhead,
      slotDurationMinutes: parsed.data.slotDurationMinutes,
      bufferMinutes: parsed.data.bufferMinutes,
      rules: parsed.data.rules.map((rule) => ({
        name: rule.name,
        daysOfWeek: rule.daysOfWeek,
        openMinutes: rule.openMinutes,
        closeMinutes: rule.closeMinutes,
        basePriceKobo: rule.basePriceNaira * 100,
        peakStartMinutes: rule.peakStartMinutes,
        peakEndMinutes: rule.peakEndMinutes,
        peakPriceKobo: rule.peakPriceNaira ? rule.peakPriceNaira * 100 : null,
      })),
    },
  );
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath(`/venue/${pitch.venueId}/pitches/${pitchId}`);
  const skipped = result.skipped ? ` ${result.skipped} conflict${result.skipped === 1 ? "" : "s"} skipped.` : "";
  return { ok: true, message: `${result.created} slot${result.created === 1 ? "" : "s"} added.${skipped}` };
}

function parseSlotRules(formData: FormData):
  | { ok: true; rules: unknown[] }
  | { ok: false; error: string } {
  const ruleIndexes = uniqueFormStrings(formData.getAll("ruleIndex"));
  const rules = ruleIndexes
    .filter((index) => formData.get(`ruleEnabled-${index}`) === "true")
    .map((index) => {
      const peakPriceNaira = String(formData.get(`peakPriceNaira-${index}`) || "").trim();
      return {
        name: String(formData.get(`ruleName-${index}`) || ""),
        daysOfWeek: formData.getAll(`daysOfWeek-${index}`),
        openMinutes: parseTimeToMinutes(String(formData.get(`openTime-${index}`) || "")),
        closeMinutes: parseTimeToMinutes(String(formData.get(`closeTime-${index}`) || "")),
        basePriceNaira: formData.get(`basePriceNaira-${index}`),
        peakStartMinutes: parseOptionalTimeToMinutes(String(formData.get(`peakStartTime-${index}`) || "")),
        peakEndMinutes: parseOptionalTimeToMinutes(String(formData.get(`peakEndTime-${index}`) || "")),
        peakPriceNaira: peakPriceNaira ? peakPriceNaira : null,
      };
    });

  if (rules.length === 0) return { ok: false, error: "Choose at least one operating rule." };
  if (rules.some((rule) => rule.openMinutes === null || rule.closeMinutes === null)) {
    return { ok: false, error: "Enter valid opening and closing times." };
  }
  return { ok: true, rules };
}

function parseTimeToMinutes(value: string): number | null {
  const match = value.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function parseOptionalTimeToMinutes(value: string): number | null {
  return value ? parseTimeToMinutes(value) : null;
}

/**
 * No dedicated getSlotById — slots_write RLS already scopes this correctly
 * via the pitch->venue ownership chain server-side (same "0 rows affected,
 * no thrown error" behavior for an unauthorized id verified during the
 * live-readiness audit), so a stray slotId for a pitch this caller doesn't
 * own simply updates nothing rather than needing an extra fetch here.
 */
export async function setSlotStatusAction(
  slotId: string,
  status: "open" | "blocked",
): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not authorized." };
  if (!isVenueOwner(user)) return { ok: false, error: "Venue owner access required." };

  return setSlotStatus(slotId, status);
}

/* ----------------------------------------------------------------- admin -- */

/**
 * The RLS policies and admin_set_*() functions already reject a non-admin
 * caller regardless — this is what actually keeps the /admin UI itself from
 * doing anything for one, since the page-level redirect in admin/layout.tsx
 * is the only other gate.
 */
async function requireAdmin() {
  const user = await getCurrentUser();
  return user?.role === "admin" ? user : null;
}

export async function verifyVenueAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, error: "Not authorized." };

  const venueId = String(formData.get("venueId") ?? "");
  const verified = formData.get("verified") === "true";
  const note = String(formData.get("note") ?? "");

  const result = await verifyVenue(venueId, admin.id, verified, note);
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath("/admin");
  revalidatePath("/admin/venues");
  return { ok: true, message: verified ? "Venue verified." : "Verification removed." };
}

export async function setUserSuspendedAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, error: "Not authorized." };

  const userId = String(formData.get("userId") ?? "");
  const suspended = formData.get("suspended") === "true";

  const sb = await createClient();
  const { error } = await sb.rpc("admin_set_suspended", { target_id: userId, val: suspended });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin");
  revalidatePath("/admin/users");
  return { ok: true, message: suspended ? "User suspended." : "User unsuspended." };
}

export async function setUserRoleAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, error: "Not authorized." };

  const userId = String(formData.get("userId") ?? "");
  const role = formData.get("role") as UserRole;

  const sb = await createClient();
  const { error } = await sb.rpc("admin_set_role", { target_id: userId, new_role: role });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin");
  revalidatePath("/admin/users");
  return { ok: true, message: "Role updated." };
}

export async function dismissWaitlistLeadAction(id: string): Promise<{ ok: boolean; error?: string }> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, error: "Not authorized." };

  const sb = await createClient();
  const { error } = await sb.from("waitlist").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin");
  revalidatePath("/admin/leads");
  return { ok: true };
}

export async function reviewVenueOwnerApplicationAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, error: "Not authorized." };

  const applicationId = String(formData.get("applicationId") ?? "");
  const approve = formData.get("approve") === "true";
  const note = String(formData.get("note") ?? "");

  const result = await reviewVenueOwnerApplication(applicationId, approve, note);
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath("/admin");
  revalidatePath("/admin/leads");
  revalidatePath("/admin/users");
  return {
    ok: true,
    message: approve ? "Application approved. Venue owner access granted." : "Application rejected.",
  };
}

export async function reviewIdentityVerificationAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, error: "Not authorized." };

  const verificationId = String(formData.get("verificationId") ?? "");
  const approve = formData.get("approve") === "true";
  const note = String(formData.get("note") ?? "");

  const result = await reviewIdentityVerification(verificationId, approve, note);
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath("/admin/identity");
  return { ok: true, message: approve ? "Identity verified." : "Submission rejected." };
}

/* -------------------------------------------------------------- identity -- */

export async function submitIdentityVerificationAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "AUTH_REQUIRED" };

  const file = formData.get("document");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Choose a document to upload." };
  }
  if (file.size > 8 * 1024 * 1024) {
    return { ok: false, error: "File is too large — please keep it under 8MB." };
  }

  const uploaded = await uploadIdentityDocument(user.id, file);
  if (!uploaded.ok) return { ok: false, error: uploaded.error };

  const submitted = await submitIdentityVerification(user.id, uploaded.path);
  if (!submitted.ok) return { ok: false, error: submitted.error };

  revalidatePath("/verify-identity");
  revalidatePath("/dashboard");
  return { ok: true, message: "Submitted — an admin will review it shortly." };
}

export async function signOut() {
  if (isSupabaseConfigured()) {
    const sb = await createClient();
    await sb.auth.signOut();
  }
  const jar = await cookies();
  jar.delete(DEMO_COOKIE);
  revalidatePath("/", "layout");
  redirect("/");
}
