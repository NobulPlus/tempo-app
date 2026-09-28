import "server-only";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createUserNotification } from "@/lib/notifications";
import { sendMail } from "@/lib/mail/transport";
import { actionPaymentConfirmationEmail } from "@/lib/mail/templates";

export type ActionPaymentKind = "booking" | "host_game" | "join_game" | "game_balance";

interface CompleteActionPaymentInput {
  reference: string;
  amountKobo: number;
  providerRef: string;
  raw: unknown;
}

type CompleteActionPaymentResult =
  | {
      ok: true;
      kind: ActionPaymentKind;
      redirectPath: string;
    }
  | { ok: false; error: string };

const paymentSetupMissingMessage =
  "Payment setup is not active on the database yet. Run the latest migrations, then try again.";

function friendlyPaymentSetupError(message: string) {
  return message.includes("action_payment_intents") ||
    message.includes("complete_action_payment") ||
    message.includes("schema cache")
    ? paymentSetupMissingMessage
    : message;
}

export async function completeVerifiedActionPayment(
  input: CompleteActionPaymentInput,
): Promise<CompleteActionPaymentResult> {
  const admin = createAdminClient();
  const expected = await getExpectedIntent(admin, input.reference);
  if (!expected.ok) return expected;

  if (expected.completed) {
    revalidatePaymentViews(expected.kind);
    return { ok: true, kind: expected.kind, redirectPath: redirectPathFor(expected) };
  }

  if (expected.amountKobo !== input.amountKobo) {
    return { ok: false, error: "Payment amount mismatch. Nothing was applied." };
  }

  const { data, error } = await admin.rpc("complete_action_payment", {
    p_reference: input.reference,
    p_amount_kobo: input.amountKobo,
    p_provider_ref: input.providerRef,
    p_raw: input.raw as object,
  });

  if (error) return { ok: false, error: friendlyPaymentSetupError(error.message) };

  const row = data as ActionIntentRow;
  await createUserNotification({
    userId: expected.userId,
    kind: "payment",
    title: "Payment confirmed",
    body: "Your Tempo payment was confirmed successfully.",
    href: redirectPathFor(row),
  });
  await sendActionPaymentReceipt({
    admin,
    userId: expected.userId,
    amountKobo: input.amountKobo,
    reference: input.reference,
    kind: row.kind as ActionPaymentKind,
    redirectPath: redirectPathFor(row),
  });
  const kind = row.kind as ActionPaymentKind;
  revalidatePaymentViews(kind);
  return { ok: true, kind, redirectPath: redirectPathFor(row) };
}

async function sendActionPaymentReceipt(input: {
  admin: ReturnType<typeof createAdminClient>;
  userId: string;
  amountKobo: number;
  reference: string;
  kind: ActionPaymentKind;
  redirectPath: string;
}) {
  try {
    const [{ data: auth }, { data: profile }] = await Promise.all([
      input.admin.auth.admin.getUserById(input.userId),
      input.admin.from("profiles").select("full_name").eq("id", input.userId).maybeSingle(),
    ]);
    const email = auth.user?.email;
    if (!email || !profile?.full_name) return;

    const labels: Record<ActionPaymentKind, string> = {
      booking: "your pitch booking",
      host_game: "publishing your game",
      join_game: "your game spot",
      game_balance: "your game balance",
    };
    const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
    const content = actionPaymentConfirmationEmail({
      fullName: profile.full_name,
      amountKobo: input.amountKobo,
      reference: input.reference,
      action: labels[input.kind],
      viewUrl: `${site}${input.redirectPath}`,
    });
    await sendMail({ to: email, ...content });
  } catch (error) {
    console.error("[payments] action receipt email failed:", error);
  }
}

function revalidatePaymentViews(kind: ActionPaymentKind) {
  revalidatePath("/", "layout");
  revalidatePath("/dashboard");
  revalidatePath("/wallet");
  if (kind === "booking") revalidatePath("/pitches");
  if (kind === "host_game") {
    revalidatePath("/games");
    revalidatePath("/host/manage");
  }
  if (kind === "join_game" || kind === "game_balance") revalidatePath("/games");
}

function redirectPathFor(row: Pick<ActionIntentRow, "kind" | "payload">) {
  const payload = row.payload ?? {};
  if (row.kind === "booking" && typeof payload.booking_reference === "string") {
    return `/bookings/${payload.booking_reference}?payment=success`;
  }
  if ((row.kind === "host_game" || row.kind === "join_game" || row.kind === "game_balance") && typeof payload.game_slug === "string") {
    return `/games/${payload.game_slug}?payment=success`;
  }
  return "/dashboard?payment=success";
}

async function getExpectedIntent(
  admin: ReturnType<typeof createAdminClient>,
  reference: string,
): Promise<
  | {
      ok: true;
      amountKobo: number;
      completed: boolean;
      kind: ActionPaymentKind;
      payload: Record<string, unknown>;
      userId: string;
    }
  | { ok: false; error: string }
> {
  const { data, error } = await admin
    .from("action_payment_intents")
    .select("amount_kobo, status, kind, payload, user_id")
    .eq("reference", reference)
    .maybeSingle();

  if (error) return { ok: false, error: friendlyPaymentSetupError(error.message) };
  if (!data) return { ok: false, error: "Unknown Tempo payment reference." };

  return {
    ok: true,
    amountKobo: Number(data.amount_kobo),
    completed: data.status === "completed",
    kind: data.kind as ActionPaymentKind,
    payload: (data.payload ?? {}) as Record<string, unknown>,
    userId: data.user_id,
  };
}

type ActionIntentRow = {
  kind: ActionPaymentKind;
  payload: Record<string, unknown> | null;
};
