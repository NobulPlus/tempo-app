import { type EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { type NextRequest } from "next/server";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { safeNext } from "@/lib/url";

/**
 * Where a signup confirmation email link lands. Supabase's confirmation
 * URL carries `token_hash` + `type`; verifying it here is what actually
 * turns "unconfirmed" into a signed-in session.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = safeNext(searchParams.get("next"));

  if (token_hash && type && isSupabaseConfigured()) {
    const sb = await createClient();
    const { error } = await sb.auth.verifyOtp({ type, token_hash });
    if (!error) {
      redirect(next);
    }
  }

  redirect("/login?error=confirmation-failed");
}
