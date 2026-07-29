const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require("discord.js");
const { addPlayerXp } = require("../lib/player-progression");
const { appendTransaction } = require("../storage/transaction-store");
const { ensurePlayer, getPlayer, updatePlayer } = require("../storage/player-store");
const { getRoom, isEnabledRoom } = require("../storage/baucua-room-store");

const sessions = new Map();

const START_KEYWORDS = new Set(["!play", "!batdau", "!baucua"]);
const STOP_KEYWORDS = new Set(["!stop"]);
const HELP_KEYWORDS = new Set(["!help", "!huongdan"]);
const STATUS_KEYWORDS = new Set(["!trangthai", "!status"]);
const CLOSE_KEYWORDS = new Set(["!chot", "!lac"]);

const BETTING_DURATION_MS = 30000;
const MIN_BET = 20;
const MAX_BET = 250000;
const BET_XP_GAIN = 1;
const WIN_XP_GAIN = 4;

const BET_BUTTON_PREFIX = "baucua:bet:";
const ACTION_BUTTON_PREFIX = "baucua:action:";
const MODAL_PREFIX = "baucua:modal:";

const ANIMALS = [
  { key: "bau", label: "Bầu", emoji: "🥒" },
  { key: "cua", label: "Cua", emoji: "🦀" },
  { key: "tom", label: "Tôm", emoji: "🦐" },
  { key: "ca", label: "Cá", emoji: "🐟" },
  { key: "ga", label: "Gà", emoji: "🐓" },
  { key: "nai", label: "Nai", emoji: "🦌" }
];

function normalizeText(input) {
  return (input || "").trim().toLowerCase();
}

function formatNumber(value) {
  return new Intl.NumberFormat("vi-VN").format(Number(value || 0));
}

function formatXu(value) {
  return `🪙 ${formatNumber(value)} Xu`;
}

function getAnimalByKey(key) {
  return ANIMALS.find((entry) => entry.key === key) || null;
}

function createSession({ guildId, channelId, channelName, hostUserId, hostUsername, channel }) {
  return {
    guildId,
    channelId,
    channelName,
    hostUserId,
    hostUsername,
    channel,
    phase: "betting",
    bets: new Map(),
    createdAt: new Date().toISOString(),
    countdownEndsAt: Date.now() + BETTING_DURATION_MS,
    timeoutId: null,
    statusMessageId: null,
    lastRoll: null
  };
}

function countDownSeconds(session) {
  return Math.max(0, Math.ceil((session.countdownEndsAt - Date.now()) / 1000));
}

function buildBetLines(session) {
  return [...session.bets.entries()].map(([userId, userBets]) => {
    const betLine = userBets.bets.map((bet) => {
      const animal = getAnimalByKey(bet.kind);
      return `${animal?.emoji || "🎲"} ${animal?.label || bet.kind}: ${formatXu(bet.amount)}`;
    });
    return `<@${userId}> | ${betLine.join(" | ")}`;
  });
}

function buildComponents(session) {
  if (!session || session.phase !== "betting") {
    return [];
  }

  return [
    new ActionRowBuilder().addComponents(
      ...ANIMALS.slice(0, 5).map((animal) =>
        new ButtonBuilder()
          .setCustomId(`${BET_BUTTON_PREFIX}${session.channelId}:${animal.key}`)
          .setLabel(`${animal.emoji} ${animal.label}`)
          .setStyle(ButtonStyle.Secondary)
      )
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`${BET_BUTTON_PREFIX}${session.channelId}:nai`)
        .setLabel("🦌 Nai")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`${ACTION_BUTTON_PREFIX}${session.channelId}:status`)
        .setLabel("📜 Xem lượt")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`${ACTION_BUTTON_PREFIX}${session.channelId}:close`)
        .setLabel("⏱️ Chốt kèo")
        .setStyle(ButtonStyle.Danger)
    )
  ];
}

function buildStatusEmbed(session, note = "Chờ người chơi đặt cược.") {
  return new EmbedBuilder()
    .setColor(0x2ecc71)
    .setTitle("🎋 Bầu Cua Jianghu")
    .setDescription(
      [
        `**Trạng thái:** ${session.phase === "betting" ? "Đang nhận cược" : "Đã chốt"}`,
        `**Thời gian còn lại:** ${session.phase === "betting" ? `${countDownSeconds(session)} giây` : "Đã lắc xong"}`,
        `**Linh vật:** ${ANIMALS.map((animal) => `${animal.emoji} ${animal.label}`).join(" • ")}`
      ].join("\n")
    )
    .addFields(
      { name: "🎟️ Danh sách cược", value: buildBetLines(session).join("\n") || "Chưa có ai đặt cược.", inline: false },
      { name: "📢 Thông báo", value: note, inline: false }
    )
    .setFooter({ text: "Bấm nút để chọn Bầu/Cua/Tôm/Cá/Gà/Nai. Hết 30 giây bot sẽ tự lắc." });
}

async function sendOrRefreshStatusMessage(channel, session, note) {
  const payload = { embeds: [buildStatusEmbed(session, note)], components: buildComponents(session) };
  if (!session.statusMessageId) {
    const sent = await channel.send(payload);
    session.statusMessageId = sent.id;
    return sent;
  }
  try {
    const message = await channel.messages.fetch(session.statusMessageId);
    await message.edit(payload);
    return message;
  } catch {
    const sent = await channel.send(payload);
    session.statusMessageId = sent.id;
    return sent;
  }
}

function clearSessionTimer(session) {
  if (session?.timeoutId) {
    clearTimeout(session.timeoutId);
    session.timeoutId = null;
  }
}

function buildRoomGuideText() {
  return [
    "**Phòng Bầu Cua đã sẵn sàng.**",
    "Nhắn `!play` để mở kèo mới.",
    "Bấm nút `Bầu/Cua/Tôm/Cá/Gà/Nai` để đặt cược nhanh.",
    "Mỗi người có thể cược nhiều con trong cùng một ván.",
    "Nhắn `!trangthai` để xem bảng cược, `!chot` để lắc sớm, `!stop` để hủy kèo."
  ].join("\n");
}

function getHelpText() {
  return [
    "Luật: bot mở kèo, người chơi cược vào bầu/cua/tôm/cá/gà/nai.",
    `Cược tối thiểu ${MIN_BET} Xu, tối đa ${MAX_BET} Xu mỗi lần.`,
    "Khi mở kèo, bot sẽ lắc ra 3 linh vật.",
    "Mỗi lần linh vật bạn cược xuất hiện, bạn nhận lại đúng số Xu đã cược cho lần xuất hiện đó.",
    "Có thể bấm nút hoặc dùng !chot để lắc sớm."
  ].join("\n");
}

async function ensureWalletPlayer(userId, username) {
  await ensurePlayer(userId, username);
  return getPlayer(userId);
}

async function adjustPlayerXu(userId, username, amount, type, extra = {}) {
  const player = await ensureWalletPlayer(userId, username);
  const xpGain = extra.xpGain || 0;
  const updated = await updatePlayer(userId, {
    username,
    wallet: { ...player.wallet, xu: player.wallet.xu + amount },
    stats: addPlayerXp(
      { ...player.stats, totalXuEarned: player.stats.totalXuEarned + Math.max(0, amount) },
      xpGain
    )
  });

  appendTransaction({
    userId,
    username,
    type,
    changes: {
      xu: amount,
      playerXp: xpGain,
      ...extra
    }
  });

  return updated;
}

async function placeBet(session, userId, username, kind, amount) {
  if (session.phase !== "betting") {
    return { ok: false, reply: "Kèo này đã chốt rồi." };
  }

  if (!Number.isInteger(amount) || amount < MIN_BET || amount > MAX_BET) {
    return { ok: false, reply: `Số cược phải từ ${formatNumber(MIN_BET)} đến ${formatNumber(MAX_BET)} Xu.` };
  }

  const animal = getAnimalByKey(kind);
  if (!animal) {
    return { ok: false, reply: "Linh vật cược không hợp lệ." };
  }

  const player = await ensureWalletPlayer(userId, username);
  if (player.wallet.xu < amount) {
    return { ok: false, reply: `Bạn không đủ Xu để cược. Số dư hiện tại: ${formatXu(player.wallet.xu)}.` };
  }

  const updatedPlayer = await adjustPlayerXu(userId, username, -amount, "baucua_bet", {
    side: animal.label,
    xpGain: BET_XP_GAIN
  });

  const existing = session.bets.get(userId) || { username, bets: [] };
  existing.username = username;
  existing.bets.push({ kind, amount });
  session.bets.set(userId, existing);

  return {
    ok: true,
    reply: `Đã cược ${formatXu(amount)} vào **${animal.emoji} ${animal.label}**. +${BET_XP_GAIN} XP. Số dư còn lại: ${formatXu(updatedPlayer.wallet.xu)}.`
  };
}

function rollAnimals() {
  const result = [];
  for (let index = 0; index < 3; index += 1) {
    result.push(ANIMALS[Math.floor(Math.random() * ANIMALS.length)]);
  }
  return result;
}

async function settleSession(channel, session) {
  if (!session || session.phase !== "betting") {
    return null;
  }

  session.phase = "closed";
  clearSessionTimer(session);
  sessions.delete(session.channelId);

  const roll = rollAnimals();
  session.lastRoll = roll;

  const summaryLines = [];
  for (const [userId, userBets] of session.bets.entries()) {
    const totalStake = userBets.bets.reduce((sum, bet) => sum + bet.amount, 0);
    let totalPayout = 0;
    let totalXp = 0;

    for (const bet of userBets.bets) {
      const matches = roll.filter((animal) => animal.key === bet.kind).length;
      if (matches > 0) {
        totalPayout += bet.amount * matches;
        totalXp += WIN_XP_GAIN * matches;
      }
    }

    let updatedPlayer = null;
    if (totalPayout > 0) {
      updatedPlayer = await adjustPlayerXu(userId, userBets.username, totalPayout, "baucua_win", {
        result: roll.map((animal) => animal.key).join(","),
        xpGain: totalXp
      });
    }

    const net = totalPayout - totalStake;
    const betLabels = userBets.bets.map((bet) => {
      const animal = getAnimalByKey(bet.kind);
      return `${animal?.emoji || "🎲"} ${animal?.label || bet.kind} ${formatNumber(bet.amount)}`;
    });

    summaryLines.push(
      `<@${userId}> đã cược ${betLabels.join(", ")} và ${
        totalPayout > 0 ? `lụm ${formatXu(totalPayout)} (lãi ${formatXu(net)})` : `thua ${formatXu(totalStake)}`
      }${updatedPlayer ? `. Số dư: ${formatXu(updatedPlayer.wallet.xu)}` : ""}.`
    );
  }

  const embed = new EmbedBuilder()
    .setColor(0x27ae60)
    .setTitle("🎋 KẾT QUẢ BẦU CUA")
    .setDescription(
      [
        `${roll.map((animal) => animal.emoji).join(" ")}`,
        `Kết quả: ${roll.map((animal) => animal.label).join(" - ")}`
      ].join("\n")
    )
    .addFields({
      name: "Danh sách tham gia",
      value: summaryLines.join("\n") || "Không có ai tham gia cược ván này.",
      inline: false
    });

  await channel.send({ embeds: [embed] }).catch(() => {});
  return { ok: true };
}

function scheduleCountdown(channel, session) {
  clearSessionTimer(session);
  session.timeoutId = setTimeout(async () => {
    const liveSession = sessions.get(session.channelId);
    if (!liveSession || liveSession.phase !== "betting") {
      return;
    }
    await settleSession(channel, liveSession);
  }, BETTING_DURATION_MS);
}

function buildBetModal(channelId, animalKey) {
  const animal = getAnimalByKey(animalKey);
  return new ModalBuilder()
    .setCustomId(`${MODAL_PREFIX}${channelId}:${animalKey}`)
    .setTitle(`Cược ${animal?.label || animalKey}`)
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("amount")
          .setLabel(`Nhập số Xu (${MIN_BET} - ${MAX_BET})`)
          .setPlaceholder("Ví dụ: 1000")
          .setRequired(true)
          .setStyle(TextInputStyle.Short)
      )
    );
}

function parseButtonCustomId(customId) {
  if (customId?.startsWith(BET_BUTTON_PREFIX)) {
    const rest = customId.slice(BET_BUTTON_PREFIX.length);
    const [channelId, kind] = rest.split(":");
    return channelId && kind ? { type: "bet", channelId, kind } : null;
  }
  if (customId?.startsWith(ACTION_BUTTON_PREFIX)) {
    const rest = customId.slice(ACTION_BUTTON_PREFIX.length);
    const [channelId, action] = rest.split(":");
    return channelId && action ? { type: "action", channelId, action } : null;
  }
  return null;
}

function parseModalCustomId(customId) {
  if (!customId?.startsWith(MODAL_PREFIX)) {
    return null;
  }
  const rest = customId.slice(MODAL_PREFIX.length);
  const [channelId, kind] = rest.split(":");
  return channelId && kind ? { channelId, kind } : null;
}

async function handleButtonInteraction(interaction) {
  const parsed = parseButtonCustomId(interaction.customId);
  if (!parsed) {
    return false;
  }

  const session = sessions.get(parsed.channelId);
  if (!session) {
    await interaction.reply({ content: "Kèo Bầu Cua này không còn hoạt động.", ephemeral: true });
    return true;
  }

  if (parsed.type === "action") {
    if (parsed.action === "status") {
      await interaction.reply({ content: getHelpText(), ephemeral: true });
      return true;
    }
    if (parsed.action === "close") {
      await interaction.deferReply({ ephemeral: true });
      await settleSession(interaction.channel, session);
      await interaction.editReply("Đã chốt kèo Bầu Cua.");
      return true;
    }
  }

  await interaction.showModal(buildBetModal(parsed.channelId, parsed.kind));
  return true;
}

async function handleModalInteraction(interaction) {
  const parsed = parseModalCustomId(interaction.customId);
  if (!parsed) {
    return false;
  }

  const session = sessions.get(parsed.channelId);
  if (!session) {
    await interaction.reply({ content: "Kèo Bầu Cua này đã đóng.", ephemeral: true });
    return true;
  }

  const amount = Number(interaction.fields.getTextInputValue("amount"));
  const result = await placeBet(session, interaction.user.id, interaction.user.username, parsed.kind, amount);

  if (result.ok && interaction.channel) {
    const animal = getAnimalByKey(parsed.kind);
    await sendOrRefreshStatusMessage(interaction.channel, session, `<@${interaction.user.id}> vừa cược ${formatXu(amount)} vào ${animal?.emoji || "🎲"} ${animal?.label || parsed.kind}.`).catch(() => {});
  }

  await interaction.reply({ content: result.reply, ephemeral: true });
  return true;
}

function startSession({ guildId, channelId, channelName, hostUserId, hostUsername, channel }) {
  if (!isEnabledRoom(channelId)) {
    throw new Error("Phòng này chưa được bật cho Bầu Cua. Hãy dùng `/baucua-tao-phong` trước.");
  }

  const session = createSession({ guildId, channelId, channelName, hostUserId, hostUsername, channel });
  sessions.set(channelId, session);
  if (channel) {
    scheduleCountdown(channel, session);
  }
  return session;
}

function stopSession(channelId) {
  const session = sessions.get(channelId);
  if (!session) {
    return null;
  }
  clearSessionTimer(session);
  sessions.delete(channelId);
  return session;
}

function getSessionStatus(channelId) {
  return sessions.get(channelId) || null;
}

function getRoomConfig(channelId) {
  return getRoom(channelId);
}

async function refundAllBets(session) {
  const refundLines = [];
  for (const [userId, userBets] of session.bets.entries()) {
    const totalRefund = userBets.bets.reduce((sum, bet) => sum + bet.amount, 0);
    const updatedPlayer = await adjustPlayerXu(userId, userBets.username, totalRefund, "baucua_refund");
    refundLines.push(`<@${userId}> được hoàn ${formatXu(totalRefund)}. Số dư hiện tại: ${formatXu(updatedPlayer.wallet.xu)}.`);
  }
  return refundLines;
}

async function handleMessage(message) {
  if (!isEnabledRoom(message.channel.id)) {
    return null;
  }

  const raw = (message.content || "").trim();
  const lowered = normalizeText(raw);
  let session = sessions.get(message.channel.id);

  if (!session) {
    if (HELP_KEYWORDS.has(lowered)) {
      return { ok: true, skipReaction: true, reply: getHelpText() };
    }
    if (STATUS_KEYWORDS.has(lowered)) {
      return { ok: true, skipReaction: true, reply: "Hiện chưa có kèo Bầu Cua nào đang mở." };
    }
    if (STOP_KEYWORDS.has(lowered)) {
      return { ok: true, skipReaction: true, reply: "Hiện chưa có kèo Bầu Cua nào để hủy." };
    }
    if (!START_KEYWORDS.has(lowered)) {
      return null;
    }

    session = startSession({
      guildId: message.guild.id,
      channelId: message.channel.id,
      channelName: message.channel.name || "unknown",
      hostUserId: message.author.id,
      hostUsername: message.author.username,
      channel: message.channel
    });

    await sendOrRefreshStatusMessage(message.channel, session, `Kèo Bầu Cua mới đã được mở bởi <@${message.author.id}>.`);
    return {
      ok: true,
      skipReaction: true,
      reply: "Bầu Cua Jianghu đã mở kèo mới. Bấm nút để chọn linh vật và nhập tiền cược."
    };
  }

  if (HELP_KEYWORDS.has(lowered)) {
    return { ok: true, skipReaction: true, reply: getHelpText() };
  }
  if (STATUS_KEYWORDS.has(lowered)) {
    await sendOrRefreshStatusMessage(message.channel, session, "Đây là trạng thái hiện tại của kèo Bầu Cua.");
    return { ok: true, skipReaction: true, reply: "Đã cập nhật bảng trạng thái Bầu Cua." };
  }
  if (STOP_KEYWORDS.has(lowered)) {
    const stoppedSession = stopSession(message.channel.id);
    const refunds = await refundAllBets(stoppedSession);
    return { ok: true, skipReaction: true, reply: `Đã hủy kèo Bầu Cua. ${refunds.join(" ")}` };
  }
  if (CLOSE_KEYWORDS.has(lowered)) {
    await settleSession(message.channel, session);
    return { ok: true, skipReaction: true, silent: true };
  }
  if (START_KEYWORDS.has(lowered)) {
    return { ok: true, skipReaction: true, reply: "Kèo Bầu Cua hiện tại đang mở rồi. Hãy đặt cược tiếp hoặc đợi bot tự lắc." };
  }

  return null;
}

module.exports = {
  handleMessage,
  handleButtonInteraction,
  handleModalInteraction,
  startSession,
  stopSession,
  getSessionStatus,
  getRoomConfig,
  buildRoomGuideText,
  buildStatusEmbed
};
