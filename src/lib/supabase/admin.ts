import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "./server";

/**
 * Service-role client. Bypasses RLS entirely — this is the trust boundary
 * complete_wallet_topup() relies on (it's granted to `service_role` only,
 * never `authenticated`, so a user session can never credit its own
 * wallet). Only ever call this from server code that has independently
 * verified a payment with Flutterwave first: the wallet callback page and
 * the Flutterwave webhook route.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !key) {
    throw new Error(
      "Supabase admin client requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }
  return createSupabaseClient(SUPABASE_URL, key, { auth: { persistSession: false } });
}
