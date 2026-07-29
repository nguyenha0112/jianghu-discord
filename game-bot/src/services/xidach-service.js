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
const { buildProgressBar, emojiToTwemojiUrl } = require("../lib/ui-theme");
const { appendTransaction } = require("../storage/transaction-store");
const { ensurePlayer, getPlayer, updatePlayer } = require("../storage/player-store");
const { getRoom, isEnabledRoom } = require("../storage/xidach-room-store");
const {
  updateXiDachRanking,
  getXiDachRanking,
  addXiDachHistoryEntry,
  getXiDachHistory
} = require("../storage/xidach-ranking-store");

const sessions = new Map();

const START_RE = /^!(play|batdau|xidach)\s+(\d+)$/u;
const STOP_KEYWORDS = new Set(["!stop", "!out"]);
const HELP_KEYWORDS = new Set(["!help", "!huongdan"]);
const STATUS_KEYWORDS = new Set(["!trangthai", "!status"]);
const RANKING_KEYWORDS = new Set(["!bxh", "!rank", "!top"]);
const HISTORY_KEYWORDS = new Set(["!lichsu", "!history"]);
const PROFILE_KEYWORDS = new Set(["!me", "!toi", "!thongke"]);
const TEXT_COMMAND_ALIASES = new Map([
  ["!play", "Mở bảng chọn mức cược"],
  ["!play 1000", "Vào ván ngay với mức cược cụ thể"],
  ["!xidach 5000", "Vào ván ngay với alias Xì Dách"],
  ["!trangthai", "Xem trạng thái ván hiện tại"],
  ["!stop", "Hủy ván đang chơi và hoàn cược"],
  ["!bxh", "Xem bảng xếp hạng"],
  ["!lichsu", "Xem các ván gần đây"],
  ["!help", "Xem hướng dẫn nhanh"]
]);

const MIN_BET = 20;
const MAX_BET = 250000;
const WIN_XP_GAIN = 4;
const BET_XP_GAIN = 1;

const ACTION_PREFIX = "xidach:action:";
const MODAL_PREFIX = "xidach:modal:";
const QUICK_BET_VALUES = [1000, 5000, 10000, 25000, 50000, 100000];

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

function buildLobbyComponents(channelId) {
  return [
    new ActionRowBuilder().addComponents(
      ...QUICK_BET_VALUES.slice(0, 3).map((amount) =>
        new ButtonBuilder()
          .setCustomId(`${ACTION_PREFIX}${channelId}:start:${amount}`)
          .setLabel(`🪙 ${formatNumber(amount)}`)
          .setStyle(ButtonStyle.Primary)
      )
    ),
    new ActionRowBuilder().addComponents(
      ...QUICK_BET_VALUES.slice(3).map((amount) =>
        new ButtonBuilder()
          .setCustomId(`${ACTION_PREFIX}${channelId}:start:${amount}`)
          .setLabel(`🪙 ${formatNumber(amount)}`)
          .setStyle(ButtonStyle.Secondary)
      ),
      new ButtonBuilder()
        .setCustomId(`${ACTION_PREFIX}${channelId}:custom`)
        .setLabel("✍️ Nhập cược")
        .setStyle(ButtonStyle.Success)
    )
  ];
}

function buildLobbyEmbed(channelId) {
  return new EmbedBuilder()
    .setColor(0x8e44ad)
    .setTitle("🃏 Mở Ván Xì Dách")
    .setThumbnail(emojiToTwemojiUrl("🃏"))
    .setDescription(
      [
        "Chọn nhanh một mức cược bên dưới để vào ván.",
        `Cược tối thiểu: **${formatXu(MIN_BET)}**`,
        `Cược tối đa: **${formatXu(MAX_BET)}**`,
        "Có thể bấm **Nhập cược** để điền số tiền bất kỳ.",
        "Bạn cũng có thể gõ tay như `!play 1000`."
      ].join("\n")
    )
    .setFooter({ text: "Sau khi vào ván, bấm Rút hoặc Dừng để chơi." });
}

function buildBetModal(channelId) {
  return new ModalBuilder()
    .setCustomId(`${MODAL_PREFIX}${channelId}`)
    .setTitle("Nhập mức cược Xì Dách")
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("amount")
          .setLabel(`Nhập số Xu (${MIN_BET} - ${MAX_BET})`)
          .setPlaceholder("Ví dụ: 12000")
          .setRequired(true)
          .setStyle(TextInputStyle.Short)
      )
    );
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
    "Luật: nhắn `!play` để mở bảng chọn mức cược, hoặc `!play 1000` để vào ván luôn.",
    "Sau đó bấm `Rút` để lấy thêm bài hoặc `Dừng` để so điểm với nhà cái.",
    "A có thể tính là 1 hoặc 11. Quá 21 là quắc ngay.",
    "Nhắn `!stop` hoặc `!out` để thoát ván đang treo.",
    "Nhắn `!bxh` để xem bảng xếp hạng, `!lichsu` để xem các ván gần đây."
  ].join("\n");
}

function getRankingText() {
  const ranking = getXiDachRanking(10);
  if (ranking.length === 0) {
    return "Xì Dách chưa có dữ liệu xếp hạng.";
  }

  return [
    "**🏆 Bảng xếp hạng Xì Dách**",
    ...ranking.map(
      (entry, index) =>
        `${index + 1}. <@${entry.userId}> - Thắng: ${entry.wins}, Hòa: ${entry.pushes}, Lãi: ${formatXu(entry.profitXu)}, Ván: ${entry.games}, Ăn đậm nhất: ${formatXu(entry.bestWinXu)}`
    )
  ].join("\n");
}

function getHistoryText() {
  const history = getXiDachHistory(8);
  if (history.length === 0) {
    return "Xì Dách chưa có lịch sử ván nào.";
  }

  return [
    "**🧾 Lịch sử Xì Dách gần đây**",
    ...history.map(
      (entry, index) =>
        `${index + 1}. <@${entry.userId}> | Kết quả: ${entry.resultLabel} | Cược: ${formatXu(entry.betAmount)} | Lãi: ${formatXu(entry.netXu)} | Điểm: ${entry.playerScore}-${entry.dealerScore}`
    )
  ].join("\n");
}

function buildRankingEmbed() {
  const ranking = getXiDachRanking(10);
  return new EmbedBuilder()
    .setColor(0xf1c40f)
    .setTitle("🏆 Bảng Xếp Hạng Xì Dách")
    .setThumbnail(emojiToTwemojiUrl("🃏"))
    .setDescription(
      ranking.length > 0
        ? ranking
            .map(
              (entry, index) =>
                `**${index + 1}.** <@${entry.userId}>\nThắng: **${entry.wins}** | Hòa: **${entry.pushes}** | Lãi: **${formatXu(entry.profitXu)}** | Ván: **${entry.games}**`
            )
            .join("\n\n")
        : "Xì Dách chưa có dữ liệu xếp hạng."
    )
    .setFooter({ text: "Dùng !me để xem thống kê cá nhân." });
}

function buildHistoryEmbed() {
  const history = getXiDachHistory(8);
  return new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle("🧾 Lịch Sử Xì Dách Gần Đây")
    .setThumbnail(emojiToTwemojiUrl("🧾"))
    .setDescription(
      history.length > 0
        ? history
            .map(
              (entry, index) =>
                `**${index + 1}.** <@${entry.userId}>\nKết quả: **${entry.resultLabel}** | Cược: **${formatXu(entry.betAmount)}**\nLãi: **${formatXu(entry.netXu)}** | Điểm: **${entry.playerScore}-${entry.dealerScore}**`
            )
            .join("\n\n")
        : "Xì Dách chưa có lịch sử ván nào."
    );
}

function buildProfileEmbed(player, username, rankingEntry) {
  const totalGames = rankingEntry?.games || 0;
  const wins = rankingEntry?.wins || 0;
  const pushes = rankingEntry?.pushes || 0;
  const profitXu = rankingEntry?.profitXu || 0;
  const bestWinXu = rankingEntry?.bestWinXu || 0;
  const winRate = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0;

  return new EmbedBuilder()
    .setColor(0x9b59b6)
    .setTitle("🃏 Hồ Sơ Xì Dách")
    .setThumbnail(emojiToTwemojiUrl("🃏"))
    .setDescription(`<@${player.userId}> - **${username}**`)
    .addFields(
      {
        name: "🪙 Ví hiện tại",
        value: `Xu: **${formatXu(player.wallet.xu)}**\nNgọc: **${formatNumber(player.wallet.ngoc)}**`,
        inline: true
      },
      {
        name: "🎮 Thành tích Xì Dách",
        value: `Ván: **${totalGames}**\nThắng: **${wins}**\nHòa: **${pushes}**\nTỉ lệ thắng: **${winRate}%**`,
        inline: true
      },
      {
        name: "📈 Hiệu suất",
        value: `Lãi ròng: **${formatXu(profitXu)}**\nĂn đậm nhất: **${formatXu(bestWinXu)}**`,
        inline: false
      },
      {
        name: "✨ Tu vi tổng",
        value: `Cấp: **${player.stats.playerLevel}**\nXP: **${player.stats.playerXp}/100**\n${buildProgressBar(player.stats.playerXp, 100, 12)}`,
        inline: false
      }
    );
}

function buildRoomGuideText() {
  return [
    "**Phòng Xì Dách đã sẵn sàng.**",
    "Nhắn `!play` để mở bảng chọn mức cược, hoặc `!play 1000` để vào thẳng ván.",
    "Bấm `Rút` hoặc `Dừng` để chơi.",
    "`!trangthai` để xem lại bàn hiện tại, `!stop` để hủy ván."
  ].join("\n");
}

function isTextCommand(raw) {
  return typeof raw === "string" && raw.trim().startsWith("!");
}

function getAvailableTextCommandMessage() {
  return [
    "Lệnh chưa đúng. Bạn có thể dùng:",
    ...[...TEXT_COMMAND_ALIASES.entries()].map(([command, description]) => `- \`${command}\`: ${description}`)
  ].join("\n");
}

async function ensureWalletPlayer(userId, username) {
  await ensurePlayer(userId, username);
  return getPlayer(userId);
}

async function getProfilePayload(userId, username) {
  const player = await ensureWalletPlayer(userId, username);
  const rankingEntry = getXiDachRanking(200).find((entry) => entry.userId === userId) || null;
  return {
    ok: true,
    skipReaction: true,
    embeds: [buildProfileEmbed(player, username, rankingEntry)]
  };
}

async function adjustPlayerXu(userId, username, amount, type, extra = {}) {
  const player = await ensureWalletPlayer(userId, username);
  const xpGain = extra.xpGain || 0;
  const safeWallet = player?.wallet || { xu: 0, ngoc: 0 };
  const safeStats = player?.stats || {
    playerLevel: 1,
    playerXp: 0,
    totalXuEarned: 0,
    totalNgocEarned: 0,
    totalWorkActions: 0,
    totalItemsSold: 0
  };
  const updated = await updatePlayer(userId, {
    username,
    wallet: { ...safeWallet, xu: safeWallet.xu + amount },
    stats: addPlayerXp(
      { ...safeStats, totalXuEarned: (safeStats.totalXuEarned || 0) + Math.max(0, amount) },
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
    updateXiDachRanking(session.hostUserId, session.hostUsername, {
      games: 1,
      profitXu: -session.betAmount
    });
    addXiDachHistoryEntry({
      guildId: session.guildId,
      channelId: session.channelId,
      userId: session.hostUserId,
      username: session.hostUsername,
      resultLabel: "Thua quắc",
      betAmount: session.betAmount,
      netXu: -session.betAmount,
      playerScore,
      dealerScore
    });
  } else if (dealerScore > 21 || playerScore > dealerScore) {
    payout = session.betAmount * 2;
    xpGain = WIN_XP_GAIN;
    const updated = await adjustPlayerXu(session.hostUserId, session.hostUsername, payout, "xidach_win", {
      xpGain,
      dealerScore,
      playerScore
    });
    resultText = `Bạn thắng và nhận ${formatXu(payout)}. Lãi ${formatXu(session.betAmount)}. Số dư: ${formatXu(updated.wallet.xu)}.`;
    updateXiDachRanking(session.hostUserId, session.hostUsername, {
      wins: 1,
      games: 1,
      profitXu: session.betAmount,
      bestWinXu: session.betAmount
    });
    addXiDachHistoryEntry({
      guildId: session.guildId,
      channelId: session.channelId,
      userId: session.hostUserId,
      username: session.hostUsername,
      resultLabel: "Thắng",
      betAmount: session.betAmount,
      netXu: session.betAmount,
      playerScore,
      dealerScore
    });
  } else if (playerScore === dealerScore) {
    payout = session.betAmount;
    const updated = await adjustPlayerXu(session.hostUserId, session.hostUsername, payout, "xidach_push", {
      dealerScore,
      playerScore
    });
    resultText = `Hai bên hòa điểm. Bạn được hoàn ${formatXu(session.betAmount)}. Số dư: ${formatXu(updated.wallet.xu)}.`;
    updateXiDachRanking(session.hostUserId, session.hostUsername, {
      pushes: 1,
      games: 1,
      profitXu: 0
    });
    addXiDachHistoryEntry({
      guildId: session.guildId,
      channelId: session.channelId,
      userId: session.hostUserId,
      username: session.hostUsername,
      resultLabel: "Hòa",
      betAmount: session.betAmount,
      netXu: 0,
      playerScore,
      dealerScore
    });
  } else {
    resultText = `Nhà cái cao điểm hơn. Bạn thua ${formatXu(session.betAmount)}.`;
    updateXiDachRanking(session.hostUserId, session.hostUsername, {
      games: 1,
      profitXu: -session.betAmount
    });
    addXiDachHistoryEntry({
      guildId: session.guildId,
      channelId: session.channelId,
      userId: session.hostUserId,
      username: session.hostUsername,
      resultLabel: "Thua",
      betAmount: session.betAmount,
      netXu: -session.betAmount,
      playerScore,
      dealerScore
    });
  }

  sessions.delete(session.channelId);
  await channel.send({ embeds: [buildSettlementEmbed(session, resultText)] }).catch(() => {});
}

function parseActionCustomId(customId) {
  if (!customId?.startsWith(ACTION_PREFIX)) {
    return null;
  }
  const rest = customId.slice(ACTION_PREFIX.length);
  const [channelId, action, value] = rest.split(":");
  return channelId && action ? { channelId, action, value } : null;
}

function parseModalCustomId(customId) {
  if (!customId?.startsWith(MODAL_PREFIX)) {
    return null;
  }
  const channelId = customId.slice(MODAL_PREFIX.length);
  return channelId ? { channelId } : null;
}

async function sendStartedRound(interaction, nextSession, betAmount) {
  await interaction.channel.send({
    embeds: [buildStatusEmbed(nextSession, `Ván mới đã bắt đầu với mức cược ${formatXu(betAmount)}. Bấm **Rút** hoặc **Dừng** để chơi.`)],
    components: buildActionComponents(nextSession)
  });
}

async function handleButtonInteraction(interaction) {
  const parsed = parseActionCustomId(interaction.customId);
  if (!parsed) {
    return false;
  }

  const session = sessions.get(parsed.channelId);
  if (!session && parsed.action === "custom") {
    await interaction.showModal(buildBetModal(parsed.channelId));
    return true;
  }

  if (!session && parsed.action === "start") {
    try {
      await interaction.deferReply({ ephemeral: true });
      const betAmount = Number(parsed.value);
      const nextSession = await startRound({
        guildId: interaction.guildId,
        channelId: interaction.channelId,
        channelName: interaction.channel?.name || "unknown",
        userId: interaction.user.id,
        username: interaction.user.username,
        betAmount
      });

      await sendStartedRound(interaction, nextSession, betAmount);
      await interaction.editReply(`Đã mở ván Xì Dách với mức cược ${formatXu(betAmount)}.`);
      return true;
    } catch (error) {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ content: error.message });
      } else {
        await interaction.reply({ content: error.message, ephemeral: true });
      }
      return true;
    }
  }

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
    await interaction.deferReply({ ephemeral: true });
    session.playerCards.push(drawCard(session.deck));
    const playerScore = getHandScore(session.playerCards);
    if (playerScore > 21) {
      await settleSession(interaction.channel, session);
      await interaction.editReply("Bạn đã quắc. Bot đã chốt ván và gửi kết quả trong phòng.");
      return true;
    }

    await interaction.editReply({ embeds: [buildStatusEmbed(session, `Bạn vừa rút thêm bài. Điểm hiện tại: ${playerScore}.`)] });
    return true;
  }

  if (parsed.action === "stand") {
    await interaction.deferReply({ ephemeral: true });
    await settleSession(interaction.channel, session);
    await interaction.editReply("Đã dừng rút bài và chốt ván. Kết quả đã gửi vào phòng.");
    return true;
  }

  return false;
}

async function handleModalInteraction(interaction) {
  const parsed = parseModalCustomId(interaction.customId);
  if (!parsed) {
    return false;
  }

  try {
    await interaction.deferReply({ ephemeral: true });
    const betAmount = Number(interaction.fields.getTextInputValue("amount"));
    const nextSession = await startRound({
      guildId: interaction.guildId,
      channelId: interaction.channelId,
      channelName: interaction.channel?.name || "unknown",
      userId: interaction.user.id,
      username: interaction.user.username,
      betAmount
    });

    await sendStartedRound(interaction, nextSession, betAmount);
    await interaction.editReply(`Đã mở ván Xì Dách với mức cược ${formatXu(betAmount)}.`);
  } catch (error) {
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content: error.message });
    } else {
      await interaction.reply({ content: error.message, ephemeral: true });
    }
  }

  return true;
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
  if (RANKING_KEYWORDS.has(lowered)) {
    return { ok: true, skipReaction: true, embeds: [buildRankingEmbed()] };
  }
  if (HISTORY_KEYWORDS.has(lowered)) {
    return { ok: true, skipReaction: true, embeds: [buildHistoryEmbed()] };
  }
  if (PROFILE_KEYWORDS.has(lowered)) {
    return getProfilePayload(message.author.id, message.author.username);
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

  if (lowered === "!play" || lowered === "!batdau" || lowered === "!xidach") {
    return {
      ok: true,
      skipReaction: true,
      embeds: [buildLobbyEmbed(message.channel.id)],
      components: buildLobbyComponents(message.channel.id)
    };
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

  if (isTextCommand(raw)) {
    return { ok: false, skipReaction: true, reply: getAvailableTextCommandMessage() };
  }

  return null;
}

module.exports = {
  handleMessage,
  handleButtonInteraction,
  handleModalInteraction,
  startRound,
  stopSession,
  getSessionStatus,
  getRoomConfig,
  buildRoomGuideText,
  buildStatusEmbed
};
