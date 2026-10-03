import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ots/core/db";

let client: SupabaseClient<Database> | undefined;

/**
 * The Supabase client for server components, with the publishable key.
 * Reads go through row-level security; the site never uses the secret key.
 */
export function supabase(): SupabaseClient<Database> {
  if (!client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) {
      throw new Error(
        "Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in apps/web/.env.local; see .env.example",
      );
    }
    client = createClient<Database>(url, key, {
      auth: { persistSession: false },
    });
  }
  return client;
}
