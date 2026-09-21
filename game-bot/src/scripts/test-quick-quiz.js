const questions = require("../../data/quick-quiz-questions.json");
const { enableRoom, disableRoom, getRoom } = require("../storage/quick-quiz-room-store");
const { ensurePlayer, getPlayer, updatePlayer } = require("../storage/player-store");
const { handleMessage, handleButtonInteraction, dropSessionCacheForTest, getSessionForTest, clearSession, REWARD_XU } = require("../services/quick-quiz-service");

class FakeMessage { constructor(id, payload) { this.id = id; this.payload = payload; } async edit(payload) { this.payload = payload; return this; } }
class FakeChannel {
  constructor(id) { this.id = id; this.sent = []; this.map = new Map(); this.messages = { fetch: async (id) => { if (!this.map.has(id)) throw new Error("missing"); return this.map.get(id); } }; }
  async send(payload) { const msg = new FakeMessage(`${this.id}-${this.sent.length + 1}`, payload); this.sent.push(msg); this.map.set(msg.id, msg); return msg; }
}
function message(channel, content, id = "host") { return { content, channel, guild: { id: "quiz-guild" }, author: { id, username: id }, member: {} }; }
function button(channel, session, index, id) {
  return { customId: `quiz:${channel.id}:${session.questionId}:${index}`, channel, channelId: channel.id, user: { id, username: id }, replies: [], async deferReply() {}, async editReply(value) { this.replies.push(value); } };
}
async function seed(id) { await ensurePlayer(id, id); const p = await getPlayer(id); await updatePlayer(id, { username: id, wallet: { ...p.wallet, xu: 100 }, stats: { ...p.stats, quizRewardDay: "old", quizRewardCount: 0 } }); }

async function main() {
  if (questions.questions.length < 20) throw new Error("Quiz bank needs at least 20 reviewed questions");
  const ids = questions.questions.map((item) => item.id);
  if (new Set(ids).size !== ids.length) throw new Error("Question IDs must be unique");
  for (const item of questions.questions) {
    if (item.options.length !== 4 || item.correctIndex < 0 || item.correctIndex > 3) throw new Error(`Invalid question ${item.id}`);
  }
  const channel = new FakeChannel("quiz-test-channel");
  disableRoom(channel.id); enableRoom(channel.id, { guildId: "quiz-guild", channelName: "quiz" }); clearSession(channel.id);
  await seed("winner"); await seed("wrong");
  const opened = await handleMessage(message(channel, "!play"));
  if (!opened?.ok || !getSessionForTest(channel.id)) throw new Error("Quiz did not open");
  const blockedStop = await handleMessage(message(channel, "!stop", "outsider"));
  if (blockedStop?.ok || !getSessionForTest(channel.id)) throw new Error("Outsider was allowed to stop Quiz");
  const original = getSessionForTest(channel.id);
  dropSessionCacheForTest(channel.id);
  const restored = getSessionForTest(channel.id);
  if (restored?.questionId !== original.questionId || restored.endsAt !== original.endsAt) throw new Error("Quiz did not recover after restart");
  const wrongIndex = (restored.correctIndex + 1) % 4;
  const wrong = button(channel, restored, wrongIndex, "wrong");
  await handleButtonInteraction(wrong);
  await handleButtonInteraction(wrong);
  if (!JSON.stringify(wrong.replies).includes("đã trả lời")) throw new Error("Duplicate answer was not blocked");
  const before = (await getPlayer("winner")).wallet.xu;
  const correct = button(channel, restored, restored.correctIndex, "winner");
  await handleButtonInteraction(correct);
  const after = (await getPlayer("winner")).wallet.xu;
  if (after - before !== REWARD_XU || getSessionForTest(channel.id)) throw new Error("Correct answer did not settle exactly once");
  if (getRoom(channel.id).activeSession) throw new Error("Finished quiz remained persisted");
  const seen = new Set(getRoom(channel.id).recentQuestionIds || []);
  for (let i = 0; i < 5; i += 1) {
    await handleMessage(message(channel, "!play"));
    const current = getSessionForTest(channel.id);
    if (seen.has(current.questionId)) throw new Error("Quiz repeated inside recent window");
    seen.add(current.questionId);
    clearSession(channel.id);
  }
  await handleMessage(message(channel, "!play"));
  const expired = getSessionForTest(channel.id);
  expired.endsAt = Date.now() - 1;
  const late = button(channel, expired, expired.correctIndex, "late-user");
  await handleButtonInteraction(late);
  if (getSessionForTest(channel.id) || !JSON.stringify(late.replies).includes("hết giờ")) throw new Error("Expired answer was not rejected and settled");
  console.log(JSON.stringify({ ok: true, questions: questions.questions.length, fourButtons: true, restartRecovery: true, duplicateBlocked: true, stopPermission: true, timeout: true, reward: REWARD_XU, recentRotation: true }, null, 2));
}
main().catch((error) => { console.error("Quick Quiz flow test failed:", error); process.exit(1); });
