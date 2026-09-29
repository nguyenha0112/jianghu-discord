const { getSupabaseClient, hasSupabaseConfig } = require("../lib/supabase");
const { recoverPendingData } = require("./data-recovery-service");

const state = {
  configured: hasSupabaseConfig(),
  ready: false,
  lastAttemptAt: null,
  lastSuccessAt: null,
  consecutiveFailures: 0,
  lastError: null
};

function describeError(error) {
  if (!error) return "Lỗi không xác định";
  return error.message || error.details || error.hint || String(error);
}

async function runSupabaseKeepalive(options = {}) {
  const configured = options.configured ?? hasSupabaseConfig();
  const client = options.client || (configured ? getSupabaseClient() : null);
  const recover = options.recover || recoverPendingData;
  const now = options.now || new Date();
  state.configured = configured;
  state.lastAttemptAt = now.toISOString();

  if (!configured || !client) {
    state.ready = false;
    state.lastError = "Supabase chưa được cấu hình.";
    return getSupabaseKeepaliveStatus();
  }

  try {
    // A real row query counts as database activity without creating fake records.
    const { error } = await client.from("players").select("user_id").limit(1);
    if (error) throw error;
    state.ready = true;
    state.lastSuccessAt = state.lastAttemptAt;
    state.consecutiveFailures = 0;
    state.lastError = null;
    await recover();
  } catch (error) {
    state.ready = false;
    state.consecutiveFailures += 1;
    state.lastError = describeError(error);
  }
  return getSupabaseKeepaliveStatus();
}

function getSupabaseKeepaliveStatus() {
  return { ...state };
}

function resetSupabaseKeepaliveForTest() {
  Object.assign(state, {
    configured: false,
    ready: false,
    lastAttemptAt: null,
    lastSuccessAt: null,
    consecutiveFailures: 0,
    lastError: null
  });
}

module.exports = { runSupabaseKeepalive, getSupabaseKeepaliveStatus, resetSupabaseKeepaliveForTest };
