const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require("discord.js");
const bank = require("../../data/quick-quiz-questions.json");
const { addPlayerXp } = require("../lib/player-progression");
const { canManageGameRoom } = require("../lib/room-admin");
const { appendTransaction } = require("../storage/transaction-store");
const { ensurePlayer, getPlayer, updatePlayer } = require("../storage/player-store");
const { enableRoom, getRoom, isEnabledRoom, listRooms } = require("../storage/quick-quiz-room-store");

const sessions = new Map();
const timers = new Map();
const locks = new Set();
const STARTS = new Set(["!play", "!batdau", "!quiz"]);
const STOPS = new Set(["!stop"]);
const HELPS = new Set(["!help", "!huongdan"]);
const PREFIX = "quiz:";
const ROUND_MS = 20000;
const REWARD_XU = 15;
const REWARD_XP = 4;
const DAILY_REWARD_LIMIT = 15;
const RECENT_LIMIT = 20;

function today() { return new Date().toISOString().slice(0, 10); }
function shuffled(items) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function pickQuestion(room) {
  const recent = new Set(room?.recentQuestionIds || []);
  const available = bank.questions.filter((item) => !recent.has(item.id));
  const pool = available.length ? available : bank.questions;
  return pool[Math.floor(Math.random() * pool.length)];
}

function createSession(channelId, guildId, question, starter) {
  const options = shuffled(question.options.map((label, originalIndex) => ({ label, originalIndex })));
  return {
    channelId, guildId, questionId: question.id, category: question.category,
    question: question.question, explanation: question.explanation,
    options: options.map((item) => item.label),
    correctIndex: options.findIndex((item) => item.originalIndex === question.correctIndex),
    startedByUserId: starter.id,
    startedByUsername: starter.username,
    answeredUserIds: [], phase: "active", endsAt: Date.now() + ROUND_MS,
    messageId: null, createdAt: Date.now()
  };
}

function persist(channelId, session, recentQuestionIds) {
  const room = getRoom(channelId);
  if (!room) return;
  enableRoom(channelId, {
    ...room,
    activeSession: session ? { ...session } : null,
    recentQuestionIds: recentQuestionIds || room.recentQuestionIds || []
  });
}

function getSession(channelId) {
  if (sessions.has(channelId)) return sessions.get(channelId);
  const saved = getRoom(channelId)?.activeSession;
  if (!saved || saved.phase !== "active") return null;
  sessions.set(channelId, saved);
  return saved;
}

function clearTimer(channelId) {
  if (timers.has(channelId)) clearTimeout(timers.get(channelId));
  timers.delete(channelId);
}

function clearSession(channelId) {
  clearTimer(channelId);
  sessions.delete(channelId);
  persist(channelId, null);
}

function remainingSeconds(session) { return Math.max(0, Math.ceil((session.endsAt - Date.now()) / 1000)); }

function components(session) {
  if (session.phase !== "active") return [];
  return [new ActionRowBuilder().addComponents(...session.options.map((label, index) =>
    new ButtonBuilder().setCustomId(`${PREFIX}${session.channelId}:${session.questionId}:${index}`)
      .setLabel(`${String.fromCharCode(65 + index)}. ${label}`.slice(0, 80)).setStyle(ButtonStyle.Primary)
  ))];
}

function embed(session, note = "Chọn một đáp án. Mỗi người chỉ được trả lời một lần.") {
  return new EmbedBuilder().setColor(0x3498db).setTitle("🧠 Quiz Nhanh")
    .setDescription(`**${session.question}**`)
    .addFields(
      { name: "Chủ đề", value: session.category, inline: true },
      { name: "Thời gian", value: `${remainingSeconds(session)} giây`, inline: true },
      { name: "Trạng thái", value: note }
    )
    .setFooter({ text: `Đúng đầu tiên: ${REWARD_XU} Xu + ${REWARD_XP} XP. Tối đa ${DAILY_REWARD_LIMIT} thưởng/ngày.` });
}

async function refresh(channel, session, note) {
  const payload = { embeds: [embed(session, note)], components: components(session) };
  if (session.messageId) {
    try { const msg = await channel.messages.fetch(session.messageId); await msg.edit(payload); return; } catch {}
  }
  const sent = await channel.send(payload);
  session.messageId = sent.id;
  persist(session.channelId, session);
}

async function finish(channel, session, note) {
  session.phase = "finished";
  clearTimer(session.channelId);
  const payload = { embeds: [embed(session, note)], components: [] };
  if (session.messageId) {
    try { const msg = await channel.messages.fetch(session.messageId); await msg.edit(payload); } catch { await channel.send(payload); }
  } else await channel.send(payload);
  clearSession(session.channelId);
}

function schedule(channel, session) {
  clearTimer(session.channelId);
  const delay = Math.max(0, session.endsAt - Date.now());
  const timer = setTimeout(() => {
    if (getSession(session.channelId) !== session) return;
    finish(channel, session, `Hết giờ. Đáp án đúng là **${session.options[session.correctIndex]}**.\n${session.explanation}`).catch(console.error);
  }, delay);
  timer.unref?.();
  timers.set(session.channelId, timer);
}

async function reward(user) {
  await ensurePlayer(user.id, user.username);
  const player = await getPlayer(user.id);
  const currentDay = today();
  const count = player.stats?.quizRewardDay === currentDay ? player.stats.quizRewardCount || 0 : 0;
  if (count >= DAILY_REWARD_LIMIT) return { capped: true, balance: player.wallet.xu };
  const wallet = { ...player.wallet, xu: (player.wallet.xu || 0) + REWARD_XU };
  const stats = addPlayerXp({ ...player.stats }, REWARD_XP);
  stats.totalXuEarned = (stats.totalXuEarned || 0) + REWARD_XU;
  stats.quizRewardDay = currentDay;
  stats.quizRewardCount = count + 1;
  await updatePlayer(user.id, { username: user.username, wallet, stats });
  appendTransaction({ userId: user.id, username: user.username, type: "quick_quiz_win", changes: { xu: REWARD_XU, xpGain: REWARD_XP } });
  return { capped: false, balance: wallet.xu };
}

async function handleMessage(message) {
  if (!isEnabledRoom(message.channel.id)) return null;
  const text = String(message.content || "").trim().toLowerCase();
  if (HELPS.has(text)) return { ok: true, reply: "Nhắn `!play` để mở câu hỏi. Bấm một trong bốn đáp án trong 20 giây; người trả lời đúng đầu tiên thắng." };
  if (STOPS.has(text)) {
    const session = getSession(message.channel.id);
    if (!session) return { ok: false, reply: "Hiện không có câu Quiz nào đang mở." };
    if (message.author.id !== session.startedByUserId && !canManageGameRoom({ user: message.author, member: message.member })) {
      return { ok: false, reply: "Chỉ người mở câu hoặc quản trị viên mới có thể dừng Quiz." };
    }
    await finish(message.channel, session, `Đã dừng câu hỏi. Đáp án là **${session.options[session.correctIndex]}**.\n${session.explanation}`);
    return { ok: true, silent: true, skipReaction: true };
  }
  if (!STARTS.has(text)) return text.startsWith("!") ? { ok: false, reply: "Lệnh Quiz Nhanh: `!play`, `!stop`, `!huongdan`." } : null;
  const active = getSession(message.channel.id);
  if (active) {
    if (active.endsAt <= Date.now()) await finish(message.channel, active, `Hết giờ. Đáp án là **${active.options[active.correctIndex]}**.`);
    else return { ok: false, reply: `Câu hiện tại còn ${remainingSeconds(active)} giây.` };
  }
  const room = getRoom(message.channel.id);
  const question = pickQuestion(room);
  const session = createSession(message.channel.id, message.guild.id, question, message.author);
  const recent = [question.id, ...(room.recentQuestionIds || []).filter((id) => id !== question.id)].slice(0, RECENT_LIMIT);
  sessions.set(message.channel.id, session);
  persist(message.channel.id, session, recent);
  await refresh(message.channel, session);
  schedule(message.channel, session);
  return { ok: true, silent: true, skipReaction: true };
}

async function handleButtonInteraction(interaction) {
  if (!interaction.customId.startsWith(PREFIX)) return false;
  await interaction.deferReply({ ephemeral: true });
  const [, channelId, questionId, rawIndex] = interaction.customId.split(":");
  if (interaction.channelId !== channelId) { await interaction.editReply("Nút này không thuộc phòng hiện tại."); return true; }
  const started = Date.now();
  while (locks.has(channelId) && Date.now() - started < 2000) await new Promise((resolve) => setTimeout(resolve, 10));
  if (locks.has(channelId)) { await interaction.editReply("Hệ thống đang chấm đáp án, thử lại sau một chút."); return true; }
  locks.add(channelId);
  try {
    const session = getSession(channelId);
    if (!session || session.questionId !== questionId || session.phase !== "active") { await interaction.editReply("Câu hỏi này đã kết thúc."); return true; }
    if (session.endsAt <= Date.now()) {
      await finish(interaction.channel, session, `Hết giờ. Đáp án là **${session.options[session.correctIndex]}**.\n${session.explanation}`);
      await interaction.editReply("Bạn bấm sau khi đã hết giờ.");
      return true;
    }
    if (session.answeredUserIds.includes(interaction.user.id)) { await interaction.editReply("Bạn đã trả lời câu này rồi."); return true; }
    const index = Number(rawIndex);
    session.answeredUserIds.push(interaction.user.id);
    persist(channelId, session);
    if (index !== session.correctIndex) { await interaction.editReply("Chưa đúng. Bạn đã dùng lượt trả lời của câu này."); return true; }
    const result = await reward(interaction.user);
    await interaction.editReply(result.capped ? "Chính xác! Bạn đã đạt giới hạn thưởng Quiz hôm nay." : `Chính xác! Bạn nhận ${REWARD_XU} Xu + ${REWARD_XP} XP.`);
    const note = result.capped
      ? `🏆 <@${interaction.user.id}> trả lời đúng. Đáp án: **${session.options[index]}**. Người chơi đã đạt giới hạn thưởng hôm nay.\n${session.explanation}`
      : `🏆 <@${interaction.user.id}> trả lời đúng **${session.options[index]}** và nhận **${REWARD_XU} Xu + ${REWARD_XP} XP**. Số dư: **${result.balance} Xu**.\n${session.explanation}`;
    await finish(interaction.channel, session, note);
    return true;
  } finally { locks.delete(channelId); }
}

async function resumeSessions(client) {
  for (const [channelId, room] of Object.entries(listRooms())) {
    if (!room.activeSession || room.activeSession.phase !== "active") continue;
    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel) continue;
    const session = getSession(channelId);
    if (!session) continue;
    if (session.endsAt <= Date.now()) await finish(channel, session, `Bot vừa khởi động lại. Câu đã hết giờ; đáp án là **${session.options[session.correctIndex]}**.`);
    else schedule(channel, session);
  }
}

function dropSessionCacheForTest(channelId) { sessions.delete(channelId); clearTimer(channelId); }
function getSessionForTest(channelId) { return getSession(channelId); }

module.exports = { handleMessage, handleButtonInteraction, resumeSessions, dropSessionCacheForTest, getSessionForTest, getSessionStatus: getSession, clearSession, REWARD_XU, ROUND_MS };
