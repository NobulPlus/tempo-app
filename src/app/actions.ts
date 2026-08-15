"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { DEMO_COOKIE } from "@/lib/session";
import { getCurrentUser } from "@/lib/session";
import { joinGame, leaveGame, createBooking, listProfiles } from "@/lib/data/repo";
import { normalisePhone } from "@/lib/format";
import { isSupabaseConfigured, createClient } from "@/lib/supabase/server";
import { store } from "@/lib/data/store";
import { redirect } from "next/navigation";

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

/* ----------------------------------------------------------------- games -- */

export async function joinGameAction(gameId: string, slug: string): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "AUTH_REQUIRED" };

  const result = await joinGame(gameId, user.id);
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath(`/games/${slug}`);
  revalidatePath("/games");
  revalidatePath("/dashboard");

  return {
    ok: true,
    message:
      result.status === "waitlist"
        ? "Game is full — you're on the waitlist. We'll message you the moment a spot opens."
        : "You're in. See you on the pitch.",
  };
}

export async function leaveGameAction(gameId: string, slug: string): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "AUTH_REQUIRED" };

  await leaveGame(gameId, user.id);
  revalidatePath(`/games/${slug}`);
  revalidatePath("/games");
  revalidatePath("/dashboard");
  return { ok: true, message: "You've left the game. Your spot went to the next person waiting." };
}

/* -------------------------------------------------------------- bookings -- */

export async function createBookingAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "AUTH_REQUIRED" };

  const slotId = String(formData.get("slotId") ?? "");
  const method = String(formData.get("method") ?? "transfer") as
    | "card"
    | "transfer"
    | "ussd";

  const result = await createBooking(slotId, user.id, method);
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath("/dashboard");
  redirect(`/bookings/${result.booking.reference}`);
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

  const s = store();
  const slot = s.slots.find((x) => x.id === v.slotId);
  if (!slot) return { ok: false, error: "That slot no longer exists." };
  if (slot.status !== "open") return { ok: false, error: "Someone just booked that slot." };

  slot.status = "booked";

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

  revalidatePath("/games");
  redirect(`/games/${slug}`);
}

/* ------------------------------------------------------------------ auth -- */

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
