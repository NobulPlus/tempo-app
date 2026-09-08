"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { DEMO_COOKIE } from "@/lib/session";
import { getCurrentUser } from "@/lib/session";
import {
  joinGame,
  leaveGame,
  payGameBalance,
  cancelGame,
  decideGameMinimum,
  settleGameHostReimbursement,
  getGameBySlug,
  createBooking,
  cancelBooking,
  getBookingByReference,
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
  uploadIdentityDocument,
  submitIdentityVerification,
  reviewIdentityVerification,
} from "@/lib/data/repo";
import type { UserRole, PitchSize, PitchSurface } from "@/lib/types";
import { normalisePhone, formatNaira, generateReference, formatDayShort, formatTime } from "@/lib/format";
import { isSupabaseConfigured, createClient } from "@/lib/supabase/server";
import { store } from "@/lib/data/store";
import { redirect } from "next/navigation";
import { safeNext } from "@/lib/url";
import { initializeFlutterwavePayment } from "@/lib/payments/flutterwave";
import { sendMail } from "@/lib/mail/transport";
import { bookingConfirmationEmail, bookingCancelledEmail, welcomeEmail, gameCancelledEmail } from "@/lib/mail/templates";
import { createAdminClient } from "@/lib/supabase/admin";

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

/* ----------------------------------------------------------------- games -- */

export async function joinGameAction(
  gameId: string,
  slug: string,
  priceKobo: number = 0,
): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "AUTH_REQUIRED" };

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
          ? `You're in — wallet covered ${formatNaira(result.paidKobo)} of ${formatNaira(priceKobo)}. Top up ${formatNaira(dueKobo)} by ${deadline} to keep your spot.`
          : `You're in, on hold — top up ${formatNaira(dueKobo)} by ${deadline} to keep your spot.`,
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

export async function payGameBalanceAction(gameId: string, slug: string): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "AUTH_REQUIRED" };

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
});

export async function initiateWalletTopupAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "AUTH_REQUIRED" };

  const parsed = topupSchema.safeParse({ amountNaira: formData.get("amountNaira") });
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

  const {
    data: { user: authUser },
  } = await sb.auth.getUser();
  if (!authUser?.email) return { ok: false, error: "Your account has no email on file." };

  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const result = await initializeFlutterwavePayment({
    reference,
    amountKobo,
    email: authUser.email,
    name: user.fullName,
    redirectUrl: `${site}/wallet/callback`,
  });
  if (!result.ok) return { ok: false, error: result.error };

  redirect(result.link);
}

/* ------------------------------------------------------------------ host -- */

const hostSchema = z.object({
  slotId: z.string().min(1, "Pick a time slot"),
  title: z.string().min(4, "Give your game a name"),
  description: z.string().max(600).optional(),
  level: z.enum(["casual", "intermediate", "competitive"]),
  capacity: z.coerce.number().int().min(4).max(30),
  minimumToGuarantee: z.coerce.number().int().min(2),
  pricePerPlayerNaira: z.coerce.number().int().min(0).max(200000),
  bibsProvided: z.coerce.boolean().optional(),
});

export async function createGameAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "AUTH_REQUIRED" };

  const parsed = hostSchema.safeParse({
    slotId: formData.get("slotId"),
    title: formData.get("title"),
    description: formData.get("description"),
    level: formData.get("level"),
    capacity: formData.get("capacity"),
    minimumToGuarantee: formData.get("minimumToGuarantee"),
    pricePerPlayerNaira: formData.get("pricePerPlayerNaira"),
    bibsProvided: formData.get("bibsProvided") === "on",
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form" };
  }
  const v = parsed.data;
  if (v.minimumToGuarantee > v.capacity) {
    return { ok: false, error: "The guarantee number can't be higher than capacity." };
  }

  if (!isSupabaseConfigured()) {
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
        error: `Top up your wallet with at least ${formatNaira(hostTotalKobo - hostBalance)} to reserve this pitch.`,
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
    });

    revalidatePath("/", "layout");
    revalidatePath("/games");
    redirect(`/games/${slug}`);
  }

  const sb = await createClient();
  const { data, error } = await sb.rpc("host_game", {
    p_slot_id: v.slotId,
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
          ? "Top up your wallet to reserve this pitch before hosting."
        : error.message,
    };
  }

  revalidatePath("/", "layout");
  revalidatePath("/games");
  redirect(`/games/${(data as { slug: string }).slug}`);
}

/* ------------------------------------------------------------------ auth -- */

const signUpSchema = z
  .object({
    fullName: z.string().min(2, "Enter your full name").max(80),
    email: z.string().email("Enter a valid email"),
    phone: z.string().optional(),
    password: z.string().min(8, "Password must be at least 8 characters"),
    password2: z.string(),
    terms: z.literal("on", { message: "You have to accept the terms to continue" }),
  })
  .refine((v) => v.password === v.password2, {
    message: "Passwords don't match",
    path: ["password2"],
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
    terms: formData.get("terms"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form" };
  }

  const { fullName, password } = parsed.data;
  const email = parsed.data.email.toLowerCase();
  const phone = parsed.data.phone ? normalisePhone(parsed.data.phone) : null;
  if (parsed.data.phone && !phone) {
    return { ok: false, error: "That doesn't look like a Nigerian phone number." };
  }

  const sb = await createClient();
  const { data, error } = await sb.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName, phone } },
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
  // setting is on. Signing out here makes OTP verification mandatory
  // regardless of that dashboard toggle, instead of silently skipping it.
  if (data.session) {
    await sb.auth.signOut();
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
  phone: z.string().optional(),
  description: z.string().max(600).optional(),
});

export async function createVenueAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "AUTH_REQUIRED" };

  const parsed = createVenueSchema.safeParse({
    name: formData.get("name"),
    area: formData.get("area"),
    side: formData.get("side"),
    address: formData.get("address"),
    lat: formData.get("lat"),
    lng: formData.get("lng"),
    phone: formData.get("phone") || undefined,
    description: formData.get("description") || undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form" };
  }

  const result = await createVenue(user.id, parsed.data);
  if (!result.ok) return { ok: false, error: result.error };

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
  phone: z.string().optional(),
  description: z.string().max(600).optional(),
});

export async function updateVenueAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "AUTH_REQUIRED" };

  const venueId = String(formData.get("venueId") ?? "");
  const venue = await getVenueById(venueId);
  if (!venue || venue.ownerId !== user.id) return { ok: false, error: "Not authorized." };

  const parsed = updateVenueSchema.safeParse({
    name: formData.get("name") || undefined,
    area: formData.get("area") || undefined,
    side: formData.get("side") || undefined,
    address: formData.get("address") || undefined,
    lat: formData.get("lat") || undefined,
    lng: formData.get("lng") || undefined,
    phone: formData.get("phone") || undefined,
    description: formData.get("description") || undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form" };
  }

  const result = await updateVenue(venueId, parsed.data);
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath(`/venue/${venueId}`);
  return { ok: true, message: "Venue updated." };
}

/* ------------------------------------------------------------------ pitch -- */

const createPitchSchema = z.object({
  name: z.string().min(2, "Give this pitch a name"),
  size: z.enum(["5-a-side", "7-a-side", "11-a-side"]),
  surface: z.enum(["astro", "grass", "indoor", "concrete"]),
  floodlights: z.coerce.boolean().optional(),
  covered: z.coerce.boolean().optional(),
  pricePerHourNaira: z.coerce.number().int().min(500).max(500000),
  peakMultiplier: z.coerce.number().min(1).max(3),
});

export async function createPitchAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "AUTH_REQUIRED" };

  const venueId = String(formData.get("venueId") ?? "");
  const venue = await getVenueById(venueId);
  if (!venue || venue.ownerId !== user.id) return { ok: false, error: "Not authorized." };

  const parsed = createPitchSchema.safeParse({
    name: formData.get("name"),
    size: formData.get("size"),
    surface: formData.get("surface"),
    floodlights: formData.get("floodlights") === "on",
    covered: formData.get("covered") === "on",
    pricePerHourNaira: formData.get("pricePerHourNaira"),
    peakMultiplier: formData.get("peakMultiplier"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form" };
  }

  const v = parsed.data;
  const result = await createPitch(venueId, {
    name: v.name,
    size: v.size as PitchSize,
    surface: v.surface as PitchSurface,
    floodlights: Boolean(v.floodlights),
    covered: Boolean(v.covered),
    pricePerHourKobo: v.pricePerHourNaira * 100,
    peakMultiplier: v.peakMultiplier,
  });
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath(`/venue/${venueId}`);
  return { ok: true, message: `${result.pitch.name} added.` };
}

const updatePitchSchema = z.object({
  name: z.string().min(2).optional(),
  pricePerHourNaira: z.coerce.number().int().min(500).max(500000).optional(),
  peakMultiplier: z.coerce.number().min(1).max(3).optional(),
  floodlights: z.coerce.boolean().optional(),
  covered: z.coerce.boolean().optional(),
  active: z.coerce.boolean().optional(),
});

export async function updatePitchAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "AUTH_REQUIRED" };

  const pitchId = String(formData.get("pitchId") ?? "");
  const pitch = await getPitchById(pitchId);
  if (!pitch || pitch.venue.ownerId !== user.id) return { ok: false, error: "Not authorized." };

  const parsed = updatePitchSchema.safeParse({
    name: formData.get("name") || undefined,
    pricePerHourNaira: formData.get("pricePerHourNaira") || undefined,
    peakMultiplier: formData.get("peakMultiplier") || undefined,
    floodlights: formData.has("floodlights") ? formData.get("floodlights") === "on" : undefined,
    covered: formData.has("covered") ? formData.get("covered") === "on" : undefined,
    active: formData.has("active") ? formData.get("active") === "true" : undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form" };
  }

  const v = parsed.data;
  const result = await updatePitch(pitchId, {
    name: v.name,
    pricePerHourKobo: v.pricePerHourNaira !== undefined ? v.pricePerHourNaira * 100 : undefined,
    peakMultiplier: v.peakMultiplier,
    floodlights: v.floodlights,
    covered: v.covered,
    active: v.active,
  });
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath(`/venue/${pitch.venueId}`);
  return { ok: true, message: "Pitch updated." };
}

/* ------------------------------------------------------------------ slots -- */

const generateSlotsSchema = z.object({
  openHour: z.coerce.number().int().min(0).max(23),
  closeHour: z.coerce.number().int().min(0).max(23),
  daysAhead: z.coerce.number().int().min(1).max(60),
  peakStartHour: z.coerce.number().int().min(0).max(23),
  peakEndHour: z.coerce.number().int().min(0).max(23),
});

export async function generateSlotsAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "AUTH_REQUIRED" };

  const pitchId = String(formData.get("pitchId") ?? "");
  const pitch = await getPitchById(pitchId);
  if (!pitch || pitch.venue.ownerId !== user.id) return { ok: false, error: "Not authorized." };

  const parsed = generateSlotsSchema.safeParse({
    openHour: formData.get("openHour"),
    closeHour: formData.get("closeHour"),
    daysAhead: formData.get("daysAhead"),
    peakStartHour: formData.get("peakStartHour"),
    peakEndHour: formData.get("peakEndHour"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form" };
  }
  if (parsed.data.openHour >= parsed.data.closeHour) {
    return { ok: false, error: "Closing hour must be after opening hour." };
  }

  const result = await generateSlots(
    pitchId,
    pitch.pricePerHourKobo,
    pitch.peakMultiplier,
    parsed.data,
  );
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath(`/venue/${pitch.venueId}/pitches/${pitchId}`);
  return { ok: true, message: `${result.created} slot${result.created === 1 ? "" : "s"} added.` };
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
