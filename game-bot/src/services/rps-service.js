const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require("discord.js");
const { addPlayerXp } = require("../lib/player-progression");
const { appendTransaction } = require("../storage/transaction-store");
const { ensurePlayer, getPlayer, updatePlayer } = require("../storage/player-store");
const { enableRoom, getRoom, isEnabledRoom } = require("../storage/rps-room-store");

const sessions = new Map();
const locks = new Set();
const STARTS = new Set(["!play", "!batdau", "!oantuti"]);
const STOPS = new Set(["!stop"]);
const HELPS = new Set(["!help", "!huongdan"]);
const CHOICES = {
  rock: { label: "Búa", emoji: "✊", beats: "scissors" },
  paper: { label: "Bao", emoji: "✋", beats: "rock" },
  scissors: { label: "Kéo", emoji: "✌️", beats: "paper" }
};
const REWARD_XU = 20;
const REWARD_XP = 3;
const DAILY_REWARD_LIMIT = 10;
const PREFIX = "rps:";

function dayKey(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

function publicSession(session) {
  return {
    channelId: session.channelId,
    guildId: session.guildId,
    hostId: session.hostId,
    hostName: session.hostName,
    guestId: session.guestId || null,
    guestName: session.guestName || null,
    choices: session.choices || {},
    phase: session.phase,
    messageId: session.messageId || null,
    createdAt: session.createdAt
  };
}

function persistSession(channelId, session) {
  const room = getRoom(channelId);
  if (room) enableRoom(channelId, { ...room, activeSession: session ? publicSession(session) : null });
}

function getSession(channelId) {
  if (sessions.has(channelId)) return sessions.get(channelId);
  const saved = getRoom(channelId)?.activeSession;
  if (!saved || saved.phase === "finished") return null;
  const session = { ...saved, choices: saved.choices || {} };
  sessions.set(channelId, session);
  return session;
}

function clearSession(channelId) {
  sessions.delete(channelId);
  persistSession(channelId, null);
}

function components(session) {
  if (session.phase === "lobby") {
    return [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`${PREFIX}${session.channelId}:join`).setLabel("Tham gia").setEmoji("⚔️").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`${PREFIX}${session.channelId}:cancel`).setLabel("Hủy phòng").setStyle(ButtonStyle.Danger)
    )];
  }
  if (session.phase === "choosing") {
    return [new ActionRowBuilder().addComponents(
      ...Object.entries(CHOICES).map(([key, choice]) => new ButtonBuilder()
        .setCustomId(`${PREFIX}${session.channelId}:pick:${key}`)
        .setLabel(choice.label).setEmoji(choice.emoji).setStyle(ButtonStyle.Primary))
    )];
  }
  return [];
}

function embed(session, note) {
  const players = session.guestId
    ? `<@${session.hostId}> đấu với <@${session.guestId}>`
    : `<@${session.hostId}> đang chờ đối thủ.`;
  const picked = session.phase === "choosing"
    ? `Đã chọn kín: ${Object.keys(session.choices).length}/2`
    : "Bấm **Tham gia** để vào trận.";
  return new EmbedBuilder().setColor(0xe67e22).setTitle("⚔️ Oẳn Tù Tì đối kháng")
    .setDescription(`${players}\n${picked}\n\n${note}`)
    .setFooter({ text: `Thắng nhận ${REWARD_XU} Xu + ${REWARD_XP} XP, tối đa ${DAILY_REWARD_LIMIT} lượt thưởng/ngày.` });
}

async function refresh(channel, session, note) {
  const payload = { embeds: [embed(session, note)], components: components(session) };
  if (session.messageId) {
    try {
      const message = await channel.messages.fetch(session.messageId);
      await message.edit(payload);
      return;
    } catch {}
  }
  const sent = await channel.send(payload);
  session.messageId = sent.id;
  persistSession(session.channelId, session);
}

function winnerId(session) {
  const host = session.choices[session.hostId];
  const guest = session.choices[session.guestId];
  if (host === guest) return null;
  return CHOICES[host].beats === guest ? session.hostId : session.guestId;
}

async function rewardWinner(session, userId) {
  const username = userId === session.hostId ? session.hostName : session.guestName;
  await ensurePlayer(userId, username);
  const player = await getPlayer(userId);
  const today = dayKey();
  const rewardState = player.stats?.rpsRewardDay === today
    ? { day: today, count: player.stats.rpsRewardCount || 0 }
    : { day: today, count: 0 };
  if (rewardState.count >= DAILY_REWARD_LIMIT) return { xu: 0, capped: true, balance: player.wallet.xu };
  const wallet = { ...player.wallet, xu: (player.wallet.xu || 0) + REWARD_XU };
  const stats = addPlayerXp({ ...player.stats, rpsRewardDay: today, rpsRewardCount: rewardState.count + 1 }, REWARD_XP);
  stats.totalXuEarned = (stats.totalXuEarned || 0) + REWARD_XU;
  stats.rpsRewardDay = today;
  stats.rpsRewardCount = rewardState.count + 1;
  await updatePlayer(userId, { username, wallet, stats });
  appendTransaction({ userId, username, type: "rps_win", changes: { xu: REWARD_XU, xpGain: REWARD_XP, opponentId: userId === session.hostId ? session.guestId : session.hostId } });
  return { xu: REWARD_XU, capped: false, balance: wallet.xu };
}

async function settle(channel, session) {
  session.phase = "settling";
  persistSession(session.channelId, session);
  const winner = winnerId(session);
  const hostChoice = CHOICES[session.choices[session.hostId]];
  const guestChoice = CHOICES[session.choices[session.guestId]];
  let result;
  if (!winner) {
    result = `Hòa! Cả hai cùng chọn ${hostChoice.emoji} **${hostChoice.label}**.`;
  } else {
    const reward = await rewardWinner(session, winner);
    result = `<@${session.hostId}>: ${hostChoice.emoji} **${hostChoice.label}**\n<@${session.guestId}>: ${guestChoice.emoji} **${guestChoice.label}**\n\n🏆 <@${winner}> thắng.`;
    result += reward.capped
      ? " Bạn đã đạt giới hạn thưởng hôm nay nên ván này không cộng thêm Xu."
      : ` Nhận **${reward.xu} Xu + ${REWARD_XP} XP**. Số dư: **${reward.balance} Xu**.`;
  }
  session.phase = "finished";
  await refresh(channel, session, result);
  clearSession(session.channelId);
}

async function handleMessage(message) {
  if (!isEnabledRoom(message.channel.id)) return null;
  const text = String(message.content || "").trim().toLowerCase();
  if (HELPS.has(text)) return { ok: true, reply: "Nhắn `!play`, người thứ hai bấm **Tham gia**, sau đó mỗi người chọn kín Búa/Kéo/Bao. Người thắng nhận thưởng nhỏ." };
  if (STOPS.has(text)) {
    const session = getSession(message.channel.id);
    if (!session) return { ok: false, reply: "Hiện không có trận Oẳn Tù Tì nào." };
    if (![session.hostId, session.guestId].includes(message.author.id) && !message.member?.permissions?.has?.("ManageGuild")) return { ok: false, reply: "Chỉ người trong trận hoặc quản trị viên mới có thể hủy." };
    clearSession(message.channel.id);
    return { ok: true, reply: "Đã hủy trận Oẳn Tù Tì. Nhắn `!play` để mở trận mới." };
  }
  if (!STARTS.has(text)) return text.startsWith("!") ? { ok: false, reply: "Lệnh phòng Oẳn Tù Tì: `!play`, `!stop`, `!huongdan`." } : null;
  if (getSession(message.channel.id)) return { ok: false, reply: "Phòng đã có trận đang chờ hoặc đang chơi." };
  const session = { channelId: message.channel.id, guildId: message.guild.id, hostId: message.author.id, hostName: message.author.username, guestId: null, choices: {}, phase: "lobby", createdAt: Date.now() };
  sessions.set(message.channel.id, session);
  persistSession(message.channel.id, session);
  await refresh(message.channel, session, "Người thứ hai bấm **Tham gia** để bắt đầu.");
  return { ok: true, silent: true, skipReaction: true };
}

async function handleButtonInteraction(interaction) {
  if (!interaction.customId.startsWith(PREFIX)) return false;
  await interaction.deferReply({ ephemeral: true });
  const parts = interaction.customId.split(":");
  const channelId = parts[1];
  if (interaction.channelId !== channelId) return interaction.editReply("Nút này không thuộc phòng hiện tại.").then(() => true);
  const waitStartedAt = Date.now();
  while (locks.has(channelId) && Date.now() - waitStartedAt < 2000) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  if (locks.has(channelId)) return interaction.editReply("Ván đang xử lý, vui lòng bấm lại sau một chút.").then(() => true);
  locks.add(channelId);
  try {
    const session = getSession(channelId);
    if (!session) { await interaction.editReply("Ván này đã kết thúc. Nhắn `!play` để mở ván mới."); return true; }
    const action = parts[2];
    if (action === "cancel") {
      if (interaction.user.id !== session.hostId) { await interaction.editReply("Chỉ chủ phòng mới có thể hủy."); return true; }
      clearSession(channelId);
      await interaction.editReply("Đã hủy phòng Oẳn Tù Tì.");
      return true;
    }
    if (action === "join") {
      if (session.phase !== "lobby") { await interaction.editReply("Trận đã đủ người."); return true; }
      if (interaction.user.id === session.hostId) { await interaction.editReply("Bạn là chủ phòng, hãy chờ một người khác tham gia."); return true; }
      session.guestId = interaction.user.id;
      session.guestName = interaction.user.username;
      session.phase = "choosing";
      persistSession(channelId, session);
      await refresh(interaction.channel, session, "Hai người hãy chọn kín. Đối thủ không thấy lựa chọn của bạn.");
      await interaction.editReply("Đã tham gia. Hãy chọn Búa, Kéo hoặc Bao ở bảng trận.");
      return true;
    }
    if (action === "pick") {
      if (session.phase !== "choosing") { await interaction.editReply("Trận chưa sẵn sàng hoặc đã kết thúc."); return true; }
      if (![session.hostId, session.guestId].includes(interaction.user.id)) { await interaction.editReply("Bạn không thuộc trận này."); return true; }
      const choice = parts[3];
      if (!CHOICES[choice]) { await interaction.editReply("Lựa chọn không hợp lệ."); return true; }
      if (session.choices[interaction.user.id]) { await interaction.editReply("Bạn đã chọn rồi, không thể đổi lựa chọn."); return true; }
      session.choices[interaction.user.id] = choice;
      persistSession(channelId, session);
      await interaction.editReply(`Đã khóa lựa chọn ${CHOICES[choice].emoji} **${CHOICES[choice].label}**.`);
      if (Object.keys(session.choices).length === 2) await settle(interaction.channel, session);
      else await refresh(interaction.channel, session, "Đã có một người chọn. Đang chờ người còn lại.");
      return true;
    }
    await interaction.editReply("Nút không hợp lệ hoặc đã hết hạn.");
    return true;
  } finally {
    locks.delete(channelId);
  }
}

function dropSessionCacheForTest(channelId) { sessions.delete(channelId); }
function getSessionForTest(channelId) { return getSession(channelId); }

module.exports = { handleMessage, handleButtonInteraction, dropSessionCacheForTest, getSessionForTest, getSessionStatus: getSession, clearSession, REWARD_XU, DAILY_REWARD_LIMIT };
