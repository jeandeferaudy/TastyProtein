import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  global: {
    fetch: (url, options = {}) => {
      const headers = new Headers(options.headers || {});
      // We set x-session-id dynamically elsewhere (cart/page) using supabase.functions? No:
      // We'll set it via a simple global variable.
      const sid = (globalThis as any).__TP_SESSION_ID;
      if (sid) headers.set("x-session-id", String(sid));

      return fetch(url, { ...options, headers });
    },
  },
});