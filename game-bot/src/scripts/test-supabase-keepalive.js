const assert = require("node:assert/strict");
const { runSupabaseKeepalive, getSupabaseKeepaliveStatus, resetSupabaseKeepaliveForTest } = require("../services/supabase-keepalive-service");

function fakeClient(result) {
  return { from: () => ({ select: () => ({ limit: async () => result }) }) };
}

async function main() {
  resetSupabaseKeepaliveForTest();
  let recoverCalls = 0;
  const success = await runSupabaseKeepalive({
    configured: true,
    client: fakeClient({ data: [], error: null }),
    recover: async () => { recoverCalls += 1; },
    now: new Date("2026-09-29T00:00:00.000Z")
  });
  assert.equal(success.ready, true);
  assert.equal(success.lastSuccessAt, "2026-09-29T00:00:00.000Z");
  assert.equal(recoverCalls, 1);

  const failed = await runSupabaseKeepalive({
    configured: true,
    client: fakeClient({ data: null, error: { message: "project paused" } }),
    recover: async () => {},
    now: new Date("2026-09-29T00:15:00.000Z")
  });
  assert.equal(failed.ready, false);
  assert.equal(failed.consecutiveFailures, 1);
  assert.match(failed.lastError, /paused/);
  assert.equal(getSupabaseKeepaliveStatus().lastSuccessAt, success.lastSuccessAt);
  console.log(JSON.stringify({ ok: true, realSelectQuery: true, recoveryOnSuccess: true, failureTracked: true, lastSuccessPreserved: true }, null, 2));
}

main().catch((error) => { console.error("Supabase keepalive test failed:", error); process.exit(1); });
