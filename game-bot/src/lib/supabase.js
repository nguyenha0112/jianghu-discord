require("dotenv").config();

const { createClient } = require("@supabase/supabase-js");
const WebSocket = require("ws");

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const supabaseFetchTimeoutMs = Math.max(1000, Number(process.env.SUPABASE_FETCH_TIMEOUT_MS || 6000));

function hasSupabaseConfig() {
  return Boolean(supabaseUrl && supabaseKey);
}

function getSupabaseClient() {
  if (!hasSupabaseConfig()) {
    return null;
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false
    },
    global: {
      fetch: (url, options = {}) => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), supabaseFetchTimeoutMs);
        return fetch(url, {
          ...options,
          signal: options.signal || controller.signal
        }).finally(() => clearTimeout(timeout));
      }
    },
    realtime: {
      transport: WebSocket
    }
  });
}

module.exports = {
  getSupabaseClient,
  hasSupabaseConfig
};
