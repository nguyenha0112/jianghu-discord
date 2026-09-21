const { enableRoom, disableRoom, getRoom } = require("../storage/rps-room-store");
const { ensurePlayer, getPlayer, updatePlayer } = require("../storage/player-store");
const { handleMessage, handleButtonInteraction, dropSessionCacheForTest, getSessionForTest, clearSession, REWARD_XU } = require("../services/rps-service");

class FakeMessage {
  constructor(id, payload) { this.id = id; this.payload = payload; }
  async edit(payload) { this.payload = payload; return this; }
}
class FakeChannel {
  constructor(id) { this.id = id; this.sent = []; this.map = new Map(); this.messages = { fetch: async (id) => { if (!this.map.has(id)) throw new Error("missing"); return this.map.get(id); } }; }
  async send(payload) { const msg = new FakeMessage(`${this.id}-${this.sent.length + 1}`, payload); this.sent.push(msg); this.map.set(msg.id, msg); return msg; }
}
function message(channel, content, id, name) { return { content, channel, guild: { id: "rps-guild" }, author: { id, username: name }, member: {} }; }
function button(channel, customId, id, name) {
  return { customId, channel, channelId: channel.id, user: { id, username: name }, replies: [], async deferReply() {}, async editReply(value) { this.replies.push(value); } };
}
async function seed(id, name) { await ensurePlayer(id, name); const p = await getPlayer(id); await updatePlayer(id, { username: name, wallet: { ...p.wallet, xu: 100 }, stats: { ...p.stats, rpsRewardDay: "old", rpsRewardCount: 0 } }); }

async function main() {
  const channel = new FakeChannel("rps-test-channel");
  const host = "rps-host";
  const guest = "rps-guest";
  disableRoom(channel.id);
  enableRoom(channel.id, { guildId: "rps-guild", channelName: "oantuti" });
  clearSession(channel.id);
  await seed(host, "Host"); await seed(guest, "Guest");
  const opened = await handleMessage(message(channel, "!play", host, "Host"));
  if (!opened?.ok || getSessionForTest(channel.id)?.phase !== "lobby") throw new Error("Lobby did not open");
  dropSessionCacheForTest(channel.id);
  if (getSessionForTest(channel.id)?.hostId !== host) throw new Error("Lobby did not recover after restart");
  await handleButtonInteraction(button(channel, `rps:${channel.id}:join`, guest, "Guest"));
  if (getSessionForTest(channel.id)?.phase !== "choosing") throw new Error("Guest did not join");
  const outsider = button(channel, `rps:${channel.id}:pick:rock`, "outsider", "Outsider");
  await handleButtonInteraction(outsider);
  if (!JSON.stringify(outsider.replies).includes("không thuộc")) throw new Error("Outsider was not rejected");
  const before = (await getPlayer(host)).wallet.xu;
  await Promise.all([
    handleButtonInteraction(button(channel, `rps:${channel.id}:pick:rock`, host, "Host")),
    handleButtonInteraction(button(channel, `rps:${channel.id}:pick:scissors`, guest, "Guest"))
  ]);
  if (getSessionForTest(channel.id)) throw new Error("Finished session was not cleared");
  const after = (await getPlayer(host)).wallet.xu;
  if (after - before !== REWARD_XU) throw new Error("Winner reward is incorrect");
  if (getRoom(channel.id)?.activeSession) throw new Error("Persisted session was not cleared");

  await handleMessage(message(channel, "!play", host, "Host"));
  await handleButtonInteraction(button(channel, `rps:${channel.id}:join`, guest, "Guest"));
  await handleButtonInteraction(button(channel, `rps:${channel.id}:pick:paper`, host, "Host"));
  await handleButtonInteraction(button(channel, `rps:${channel.id}:pick:paper`, guest, "Guest"));
  if (getSessionForTest(channel.id)) throw new Error("Draw session was not cleared");
  console.log(JSON.stringify({ ok: true, join: true, privateChoice: true, outsiderRejected: true, restartRecovery: true, concurrentChoices: true, winReward: REWARD_XU, draw: true }, null, 2));
}
main().catch((error) => { console.error("RPS flow test failed:", error); process.exit(1); });
