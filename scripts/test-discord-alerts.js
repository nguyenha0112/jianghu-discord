const assert = require("node:assert/strict");
const { createDiscordAdminNotifier, parseAdminUserIds } = require("./discord-alerts");

assert.deepEqual(parseAdminUserIds("757257684616609802, bad,757257684616609802"), ["757257684616609802"]);
const calls = [];
const fakeFetch = async (url, options) => {
  calls.push({ url, options });
  if (url.endsWith("/users/@me/channels")) return { ok: true, json: async () => ({ id: "999999999999999999" }) };
  return { ok: true, json: async () => ({}) };
};

createDiscordAdminNotifier({
  token: "test-token",
  adminUserIds: "757257684616609802",
  fetchImpl: fakeFetch
})("Supabase mất kết nối.").then((result) => {
  assert.deepEqual(result, { sent: 1, failed: 0 });
  assert.equal(calls.length, 2);
  assert.ok(calls[1].url.includes("999999999999999999/messages"));
  assert.ok(JSON.parse(calls[1].options.body).content.includes("Supabase mất kết nối"));
  console.log("PASS: system alerts are sent by DM to ADMIN_USER_IDS");
}).catch((error) => { console.error(error); process.exitCode = 1; });
