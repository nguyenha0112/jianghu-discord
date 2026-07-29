const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require("discord.js");
const { addPlayerXp } = require("../lib/player-progression");
const { emojiToTwemojiUrl } = require("../lib/ui-theme");
const { appendTransaction } = require("../storage/transaction-store");
const { ensurePlayer, getPlayer, updatePlayer } = require("../storage/player-store");
const { getRoom, isEnabledRoom } = require("../storage/xidach-room-store");

const sessions = new Map();

const START_RE = /^!(play|batdau|xidach)\s+(\d+)$/u;
const STOP_KEYWORDS = new Set(["!stop", "!out"]);
const HELP_KEYWORDS = new Set(["!help", "!huongdan"]);
const STATUS_KEYWORDS = new Set(["!trangthai", "!status"]);

const MIN_BET = 20;
const MAX_BET = 250000;
const WIN_XP_GAIN = 4;
const BET_XP_GAIN = 1;

const ACTION_PREFIX = "xidach:action:";

const SUITS = ["♠", "♥", "♦", "♣"];
const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

function normalizeText(input) {
  return (input || "").trim().toLowerCase();
}

function formatNumber(value) {
  return new Intl.NumberFormat("vi-VN").format(Number(value || 0));
}

function formatXu(value) {
  return `🪙 ${formatNumber(value)} Xu`;
}

function buildDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank });
    }
  }
  for (let index = deck.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [deck[index], deck[swapIndex]] = [deck[swapIndex], deck[index]];
  }
  return deck;
}

function drawCard(deck) {
  return deck.pop();
}

function getCardValue(rank) {
  if (rank === "A") {
    return 11;
  }
  if (["J", "Q", "K"].includes(rank)) {
    return 10;
  }
  return Number(rank);
}

function getHandScore(cards) {
  let score = cards.reduce((sum, card) => sum + getCardValue(card.rank), 0);
  let aces = cards.filter((card) => card.rank === "A").length;
  while (score > 21 && aces > 0) {
    score -= 10;
    aces -= 1;
  }
  return score;
}

function formatCards(cards) {
  return cards.map((card) => `\`${card.rank}${card.suit}\``).join(" ");
}

function createSession({ guildId, channelId, channelName, hostUserId, hostUsername, betAmount }) {
  const deck = buildDeck();
  const playerCards = [drawCard(deck), drawCard(deck)];
  const dealerCards = [drawCard(deck), drawCard(deck)];

  return {
    guildId,
    channelId,
    channelName,
    hostUserId,
    hostUsername,
    betAmount,
    deck,
    playerCards,
    dealerCards,
    phase: "playing",
    createdAt: new Date().toISOString()
  };
}

function buildActionComponents(session) {
  if (!session || session.phase !== "playing") {
    return [];
  }

  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`${ACTION_PREFIX}${session.channelId}:hit`)
        .setLabel("🃏 Rút")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`${ACTION_PREFIX}${session.channelId}:stand`)
        .setLabel("✋ Dừng")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`${ACTION_PREFIX}${session.channelId}:status`)
        .setLabel("📜 Xem lượt")
        .setStyle(ButtonStyle.Secondary)
    )
  ];
}

function buildStatusEmbed(session, note = "Đến lượt người chơi quyết định.") {
  const playerScore = getHandScore(session.playerCards);
  const dealerVisible = `${session.dealerCards[0].rank}${session.dealerCards[0].suit} ??`;

  return new EmbedBuilder()
    .setColor(0x9b59b6)
    .setTitle("🃏 Xì Dách Jianghu")
    .setThumbnail(emojiToTwemojiUrl("🃏"))
    .setDescription(
      [
        `**Người chơi:** <@${session.hostUserId}>`,
        `**Cược:** ${formatXu(session.betAmount)}`,
        `**Điểm bạn:** ${playerScore}`,
        `**Bài bạn:** ${formatCards(session.playerCards)}`,
        `**Bài nhà cái:** ${dealerVisible}`
      ].join("\n")
    )
    .addFields({ name: "📢 Thông báo", value: note, inline: false })
    .setFooter({ text: "Bấm Rút để bốc thêm bài, bấm Dừng để chốt điểm với nhà cái." });
}

function buildSettlementEmbed(session, resultText) {
  const playerScore = getHandScore(session.playerCards);
  const dealerScore = getHandScore(session.dealerCards);

  return new EmbedBuilder()
    .setColor(0x8e44ad)
    .setTitle("🃏 Kết Quả Xì Dách")
    .setThumbnail(emojiToTwemojiUrl("🃏"))
    .setDescription(
      [
        resultText,
        "",
        `**Bạn - ${playerScore}**`,
        formatCards(session.playerCards),
        "",
        `**Nhà cái - ${dealerScore}**`,
        formatCards(session.dealerCards)
      ].join("\n")
    );
}

function getHelpText() {
  return [
    "Luật: nhắn `!play 1000` để bắt đầu một ván Xì Dách với mức cược 1000 Xu.",
    "Sau đó bấm `Rút` để lấy thêm bài hoặc `Dừng` để so điểm với nhà cái.",
    "A có thể tính là 1 hoặc 11. Quá 21 là quắc ngay.",
    "Nhắn `!stop` hoặc `!out` để thoát ván đang treo."
  ].join("\n");
}

function buildRoomGuideText() {
  return [
    "**Phòng Xì Dách đã sẵn sàng.**",
    "Nhắn `!play 1000` để vào một ván mới với mức cược mong muốn.",
    "Bấm `Rút` hoặc `Dừng` để chơi.",
    "`!trangthai` để xem lại bàn hiện tại, `!stop` để hủy ván."
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

async function startRound({ guildId, channelId, channelName, userId, username, betAmount }) {
  if (!isEnabledRoom(channelId)) {
    throw new Error("Phòng này chưa được bật cho Xì Dách. Hãy dùng `/xidach-tao-phong` trước.");
  }

  if (sessions.has(channelId)) {
    throw new Error("Phòng này đang có một ván Xì Dách rồi. Hãy chơi xong hoặc `!stop` trước.");
  }

  if (!Number.isInteger(betAmount) || betAmount < MIN_BET || betAmount > MAX_BET) {
    throw new Error(`Cược phải từ ${formatNumber(MIN_BET)} đến ${formatNumber(MAX_BET)} Xu.`);
  }

  const player = await ensureWalletPlayer(userId, username);
  if (player.wallet.xu < betAmount) {
    throw new Error(`Bạn không đủ Xu để cược. Số dư hiện tại: ${formatXu(player.wallet.xu)}.`);
  }

  await adjustPlayerXu(userId, username, -betAmount, "xidach_bet", { xpGain: BET_XP_GAIN });
  const session = createSession({ guildId, channelId, channelName, hostUserId: userId, hostUsername: username, betAmount });
  sessions.set(channelId, session);
  return session;
}

function stopSession(channelId) {
  const session = sessions.get(channelId);
  if (!session) {
    return null;
  }
  sessions.delete(channelId);
  return session;
}

function getSessionStatus(channelId) {
  return sessions.get(channelId) || null;
}

function getRoomConfig(channelId) {
  return getRoom(channelId);
}

async function refundSession(session) {
  if (!session) {
    return null;
  }
  const updated = await adjustPlayerXu(session.hostUserId, session.hostUsername, session.betAmount, "xidach_refund");
  return `Đã hoàn ${formatXu(session.betAmount)} cho <@${session.hostUserId}>. Số dư hiện tại: ${formatXu(updated.wallet.xu)}.`;
}

async function settleSession(channel, session) {
  while (getHandScore(session.dealerCards) < 17) {
    session.dealerCards.push(drawCard(session.deck));
  }

  const playerScore = getHandScore(session.playerCards);
  const dealerScore = getHandScore(session.dealerCards);
  let resultText = "";
  let payout = 0;
  let xpGain = 0;

  if (playerScore > 21) {
    resultText = `Bạn đã vượt quá 21 điểm. Bạn thua ${formatXu(session.betAmount)}.`;
  } else if (dealerScore > 21 || playerScore > dealerScore) {
    payout = session.betAmount * 2;
    xpGain = WIN_XP_GAIN;
    const updated = await adjustPlayerXu(session.hostUserId, session.hostUsername, payout, "xidach_win", {
      xpGain,
      dealerScore,
      playerScore
    });
    resultText = `Bạn thắng và nhận ${formatXu(payout)}. Lãi ${formatXu(session.betAmount)}. Số dư: ${formatXu(updated.wallet.xu)}.`;
  } else if (playerScore === dealerScore) {
    payout = session.betAmount;
    const updated = await adjustPlayerXu(session.hostUserId, session.hostUsername, payout, "xidach_push", {
      dealerScore,
      playerScore
    });
    resultText = `Hai bên hòa điểm. Bạn được hoàn ${formatXu(session.betAmount)}. Số dư: ${formatXu(updated.wallet.xu)}.`;
  } else {
    resultText = `Nhà cái cao điểm hơn. Bạn thua ${formatXu(session.betAmount)}.`;
  }

  sessions.delete(session.channelId);
  await channel.send({ embeds: [buildSettlementEmbed(session, resultText)] }).catch(() => {});
}

function parseActionCustomId(customId) {
  if (!customId?.startsWith(ACTION_PREFIX)) {
    return null;
  }
  const rest = customId.slice(ACTION_PREFIX.length);
  const [channelId, action] = rest.split(":");
  return channelId && action ? { channelId, action } : null;
}

async function handleButtonInteraction(interaction) {
  const parsed = parseActionCustomId(interaction.customId);
  if (!parsed) {
    return false;
  }

  const session = sessions.get(parsed.channelId);
  if (!session) {
    await interaction.reply({ content: "Ván Xì Dách này không còn hoạt động.", ephemeral: true });
    return true;
  }

  if (interaction.user.id !== session.hostUserId) {
    await interaction.reply({ content: "Chỉ người mở ván mới được bấm nút trong ván này.", ephemeral: true });
    return true;
  }

  if (parsed.action === "status") {
    await interaction.reply({ embeds: [buildStatusEmbed(session, "Đây là trạng thái hiện tại của ván.")], ephemeral: true });
    return true;
  }

  if (parsed.action === "hit") {
    session.playerCards.push(drawCard(session.deck));
    const playerScore = getHandScore(session.playerCards);
    if (playerScore > 21) {
      await interaction.deferReply();
      await settleSession(interaction.channel, session);
      await interaction.deleteReply().catch(() => {});
      return true;
    }

    await interaction.reply({ embeds: [buildStatusEmbed(session, `Bạn vừa rút thêm bài. Điểm hiện tại: ${playerScore}.`)], ephemeral: true });
    return true;
  }

  if (parsed.action === "stand") {
    await interaction.deferReply();
    await settleSession(interaction.channel, session);
    await interaction.deleteReply().catch(() => {});
    return true;
  }

  return false;
}

async function handleMessage(message) {
  if (!isEnabledRoom(message.channel.id)) {
    return null;
  }

  const raw = (message.content || "").trim();
  const lowered = normalizeText(raw);
  const session = sessions.get(message.channel.id);

  if (HELP_KEYWORDS.has(lowered)) {
    return { ok: true, skipReaction: true, reply: getHelpText() };
  }

  if (STATUS_KEYWORDS.has(lowered)) {
    if (!session) {
      return { ok: true, skipReaction: true, reply: "Hiện chưa có ván Xì Dách nào đang chạy." };
    }
    return { ok: true, skipReaction: true, reply: "Đây là trạng thái hiện tại của ván.", silent: false };
  }

  if (STOP_KEYWORDS.has(lowered)) {
    if (!session) {
      return { ok: true, skipReaction: true, reply: "Hiện chưa có ván Xì Dách nào để hủy." };
    }
    const stoppedSession = stopSession(message.channel.id);
    const refundText = await refundSession(stoppedSession);
    return { ok: true, skipReaction: true, reply: refundText };
  }

  const startMatch = raw.match(START_RE);
  if (startMatch) {
    try {
      const betAmount = Number(startMatch[2]);
      const nextSession = await startRound({
        guildId: message.guild.id,
        channelId: message.channel.id,
        channelName: message.channel.name || "unknown",
        userId: message.author.id,
        username: message.author.username,
        betAmount
      });

      await message.channel.send({
        embeds: [buildStatusEmbed(nextSession, `Ván mới đã bắt đầu với mức cược ${formatXu(betAmount)}. Bấm **Rút** hoặc **Dừng** để chơi.`)],
        components: buildActionComponents(nextSession)
      });
      return { ok: true, skipReaction: true, silent: true };
    } catch (error) {
      return { ok: false, skipReaction: true, reply: error.message };
    }
  }

  return null;
}

module.exports = {
  handleMessage,
  handleButtonInteraction,
  startRound,
  stopSession,
  getSessionStatus,
  getRoomConfig,
  buildRoomGuideText,
  buildStatusEmbed
};
