const {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require("discord.js");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { addPlayerXp } = require("../lib/player-progression");
const { buildProgressBar } = require("../lib/ui-theme");
const { buildCurrencyPairAttachment, buildXuAttachment } = require("../lib/currency-assets");
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
  ["!play", "Mo bang chon muc cuoc"],
  ["!play 1000", "Vao van ngay voi muc cuoc cu the"],
  ["!xidach 5000", "Alias mo van Xi Dach"],
  ["!trangthai", "Xem trang thai van hien tai"],
  ["!stop", "Huy van dang choi va hoan cuoc"],
  ["!bxh", "Xem bang xep hang"],
  ["!lichsu", "Xem cac van gan day"],
  ["!help", "Xem huong dan nhanh"]
]);

const MIN_BET = 20;
const MAX_BET = 250000;
const WIN_XP_GAIN = 4;
const BET_XP_GAIN = 1;

const ACTION_PREFIX = "xidach:action:";
const MODAL_PREFIX = "xidach:modal:";
const QUICK_BET_VALUES = [40, 100, 200, 400, 1000];
const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const SUITS = [
  { code: "S", symbol: "♠" },
  { code: "H", symbol: "♥" },
  { code: "D", symbol: "♦" },
  { code: "C", symbol: "♣" }
];

const renderScriptPath = path.join(__dirname, "..", "lib", "render_xidach_board.py");

function normalizeText(input) {
  return (input || "").trim().toLowerCase();
}

function formatNumber(value) {
  return new Intl.NumberFormat("vi-VN").format(Number(value || 0));
}

function formatXu(value) {
  return `Xu ${formatNumber(value)}`;
}

function buildDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ rank, suitCode: suit.code, suitSymbol: suit.symbol });
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

function isNguLinh(cards) {
  return cards.length === 5 && getHandScore(cards) <= 21;
}

function cardLabel(card) {
  return `${card.rank}${card.suitSymbol}`;
}

function cardTextLabel(card) {
  const suitNames = {
    S: "bich",
    H: "co",
    D: "ro",
    C: "chuon"
  };
  return `${card.rank} ${suitNames[card.suitCode] || "bich"}`;
}

function formatCardList(cards) {
  if (!cards?.length) {
    return "Chua co bai";
  }
  return cards.map(cardLabel).join(" • ");
}

function buildBoardPayload(session, options = {}) {
  const revealDealer = options.revealDealer || false;
  return {
    title: revealDealer ? "Ket qua Xi Dach" : "Ban Xi Dach",
    playerName: session.hostUsername,
    playerScore: getHandScore(session.playerCards),
    dealerScoreText: revealDealer ? String(getHandScore(session.dealerCards)) : "?",
    betText: formatXu(session.betAmount),
    revealDealer,
    note: options.note || "Den luot nguoi choi quyet dinh.",
    playerCardsText: session.playerCards.map(cardTextLabel).join(", "),
    dealerCardsText: revealDealer
      ? session.dealerCards.map(cardTextLabel).join(", ")
      : session.dealerCards.length > 0
        ? `${cardTextLabel(session.dealerCards[0])}, la up`
        : "Chua co bai",
    playerCards: session.playerCards.map((card) => ({
      rank: card.rank,
      assetCode: card.suitCode
    })),
    dealerCards: session.dealerCards.map((card) => ({
      rank: card.rank,
      assetCode: card.suitCode
    }))
  };
}

function buildBoardAttachment(session, options = {}) {
  const outputPath = path.join(
    os.tmpdir(),
    `xidach-board-${session.channelId}-${options.revealDealer ? "reveal" : "live"}.png`
  );

  const result = spawnSync("python", [renderScriptPath, outputPath], {
    input: JSON.stringify(buildBoardPayload(session, options)),
    encoding: "utf8"
  });

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || "Khong render duoc anh ban Xi Dach.");
  }

  return new AttachmentBuilder(outputPath, { name: "xidach-board.png" });
}

function buildVisualAttachments(session, options = {}) {
  return [buildBoardAttachment(session, options)];
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
    statusMessageId: null,
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
        .setLabel("Rut")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`${ACTION_PREFIX}${session.channelId}:stand`)
        .setLabel("Dung")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`${ACTION_PREFIX}${session.channelId}:status`)
        .setLabel("Xem luot")
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
          .setLabel(`${formatNumber(amount)} Xu`)
          .setStyle(ButtonStyle.Primary)
      )
    ),
    new ActionRowBuilder().addComponents(
      ...QUICK_BET_VALUES.slice(3).map((amount) =>
        new ButtonBuilder()
          .setCustomId(`${ACTION_PREFIX}${channelId}:start:${amount}`)
          .setLabel(`${formatNumber(amount)} Xu`)
          .setStyle(ButtonStyle.Secondary)
      ),
      new ButtonBuilder()
        .setCustomId(`${ACTION_PREFIX}${channelId}:custom`)
        .setLabel("Nhap cuoc")
        .setStyle(ButtonStyle.Success)
    )
  ];
}

function buildLobbyEmbed() {
  return new EmbedBuilder()
    .setColor(0x8e44ad)
    .setTitle("Mo van Xi Dach")
    .setThumbnail("attachment://xu.png")
    .setDescription(
      [
        "Chon nhanh mot muc cuoc ben duoi de vao van.",
        `Cuoc toi thieu: **${formatXu(MIN_BET)}**`,
        `Cuoc toi da: **${formatXu(MAX_BET)}**`,
        "Ban cung co the bam **Nhap cuoc** de dien so tien bat ky.",
        "Hoac go tay: `!play 1000`."
      ].join("\n")
    )
    .setFooter({ text: "Sau khi vao van, bam Rut hoac Dung de choi." });
}

function buildBetModal(channelId) {
  return new ModalBuilder()
    .setCustomId(`${MODAL_PREFIX}${channelId}`)
    .setTitle("Nhap muc cuoc Xi Dach")
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("amount")
          .setLabel(`Nhap so Xu (${MIN_BET} - ${MAX_BET})`)
          .setPlaceholder("Vi du: 12000")
          .setRequired(true)
          .setStyle(TextInputStyle.Short)
      )
    );
}

function buildStatusEmbed(session, note = "Den luot nguoi choi quyet dinh.") {
  const playerScore = getHandScore(session.playerCards);
  const dealerOpenCards = session.dealerCards.length > 0 ? `${cardLabel(session.dealerCards[0])} • Bai up` : "Chua co bai";

  return new EmbedBuilder()
    .setColor(0x9b59b6)
    .setTitle("Xi Dach Jianghu")
    .setDescription(
      [
        `**Nguoi choi:** <@${session.hostUserId}>`,
        `**Cuoc:** ${formatXu(session.betAmount)}`,
        `**Diem ban:** ${playerScore}`,
        `**Bai ban:** ${formatCardList(session.playerCards)}`,
        `**Bai nha cai:** ${dealerOpenCards}`,
        "",
        "Ban bai da duoc render thanh mot anh tong hop ben duoi."
      ].join("\n")
    )
    .addFields({ name: "Thong bao", value: note, inline: false })
    .setImage("attachment://xidach-board.png")
    .setFooter({ text: "Ban bai duoc canh lai de de nhin hon tren Discord." });
}

function buildSettlementEmbed(session, resultText) {
  const playerScore = getHandScore(session.playerCards);
  const dealerScore = getHandScore(session.dealerCards);

  return new EmbedBuilder()
    .setColor(0x8e44ad)
    .setTitle("Ket qua Xi Dach")
    .setDescription(
      [
        resultText,
        "",
        `**Ban - ${playerScore}:** ${formatCardList(session.playerCards)}`,
        `**Nha cai - ${dealerScore}:** ${formatCardList(session.dealerCards)}`
      ].join("\n")
    )
    .setImage("attachment://xidach-board.png")
    .setFooter({ text: "Ban bai cuoi da duoc render thanh mot khung tong hop." });
}

async function sendOrRefreshStatusMessage(channel, session, note) {
  const payload = {
    embeds: [buildStatusEmbed(session, note)],
    components: buildActionComponents(session),
    files: buildVisualAttachments(session, { note, revealDealer: false })
  };

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

async function closeStatusMessage(channel, session) {
  if (!session?.statusMessageId) {
    return;
  }

  try {
    const message = await channel.messages.fetch(session.statusMessageId);
    await message.edit({
      embeds: [buildStatusEmbed(session, "Van da ket thuc.")],
      components: [],
      files: buildVisualAttachments(session, { note: "Van da ket thuc.", revealDealer: false })
    });
  } catch {
    // Bo qua neu khong edit duoc tin nhan ban cu.
  }
}

function getHelpText() {
  return [
    "Luat: nhan `!play` de mo bang chon muc cuoc, hoac `!play 1000` de vao van luon.",
    "Sau do bam `Rut` de lay them bai hoac `Dung` de so diem voi nha cai.",
    "A co the tinh la 1 hoac 11. Qua 21 la quac ngay.",
    "Nha cai rut toi thieu den 17 diem, toi da 5 la.",
    "Nhieu nhat 5 la ma khong qua 21 la ngu linh.",
    "Nhan `!stop` hoac `!out` de thoat van dang treo.",
    "Nhan `!bxh` de xem bang xep hang, `!lichsu` de xem cac van gan day."
  ].join("\n");
}

function buildRankingEmbed() {
  const ranking = getXiDachRanking(10);
  return new EmbedBuilder()
    .setColor(0xf1c40f)
    .setTitle("Bang xep hang Xi Dach")
    .setDescription(
      ranking.length > 0
        ? ranking
            .map(
              (entry, index) =>
                `**${index + 1}.** <@${entry.userId}>\nThang: **${entry.wins}** | Hoa: **${entry.pushes}** | Lai: **${formatXu(entry.profitXu)}** | Van: **${entry.games}**`
            )
            .join("\n\n")
        : "Xi Dach chua co du lieu xep hang."
    )
    .setFooter({ text: "Dung !me de xem thong ke ca nhan." });
}

function buildHistoryEmbed() {
  const history = getXiDachHistory(8);
  return new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle("Lich su Xi Dach gan day")
    .setDescription(
      history.length > 0
        ? history
            .map(
              (entry, index) =>
                `**${index + 1}.** <@${entry.userId}>\nKet qua: **${entry.resultLabel}** | Cuoc: **${formatXu(entry.betAmount)}**\nLai: **${formatXu(entry.netXu)}** | Diem: **${entry.playerScore}-${entry.dealerScore}**`
            )
            .join("\n\n")
        : "Xi Dach chua co lich su van nao."
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
    .setTitle("Ho so Xi Dach")
    .setThumbnail("attachment://currencies.png")
    .setDescription(`<@${player.userId}> - **${username}**`)
    .addFields(
      {
        name: "Vi hien tai",
        value: `Xu: **${formatXu(player.wallet.xu)}**\nNgoc: **${formatNumber(player.wallet.ngoc)}**`,
        inline: true
      },
      {
        name: "Thanh tich Xi Dach",
        value: `Van: **${totalGames}**\nThang: **${wins}**\nHoa: **${pushes}**\nTi le thang: **${winRate}%**`,
        inline: true
      },
      {
        name: "Hieu suat",
        value: `Lai rong: **${formatXu(profitXu)}**\nAn dam nhat: **${formatXu(bestWinXu)}**`,
        inline: false
      },
      {
        name: "Tu vi tong",
        value: `Cap: **${player.stats.playerLevel}**\nXP: **${player.stats.playerXp}/100**\n${buildProgressBar(player.stats.playerXp, 100, 12)}`,
        inline: false
      }
    );
}

function buildRoomGuideText() {
  return [
    "**Phong Xi Dach da san sang.**",
    "Nhan `!play` de mo bang chon muc cuoc, hoac `!play 1000` de vao thang van.",
    "Bam `Rut` hoac `Dung` de choi.",
    "`!trangthai` de xem lai ban hien tai, `!stop` de huy van."
  ].join("\n");
}

function isTextCommand(raw) {
  return typeof raw === "string" && raw.trim().startsWith("!");
}

function getAvailableTextCommandMessage() {
  return [
    "Lenh chua dung. Ban co the dung:",
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
    embeds: [buildProfileEmbed(player, username, rankingEntry)],
    files: [buildCurrencyPairAttachment()]
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
    throw new Error("Phong nay chua duoc bat cho Xi Dach. Hay dung `/xidach-tao-phong` truoc.");
  }

  if (sessions.has(channelId)) {
    throw new Error("Phong nay dang co mot van Xi Dach roi. Hay choi xong hoac `!stop` truoc.");
  }

  if (!Number.isInteger(betAmount) || betAmount < MIN_BET || betAmount > MAX_BET) {
    throw new Error(`Cuoc phai tu ${formatNumber(MIN_BET)} den ${formatNumber(MAX_BET)} Xu.`);
  }

  const player = await ensureWalletPlayer(userId, username);
  if (player.wallet.xu < betAmount) {
    throw new Error(`Ban khong du Xu de cuoc. So du hien tai: ${formatXu(player.wallet.xu)}.`);
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
  return `Da hoan ${formatXu(session.betAmount)} cho <@${session.hostUserId}>. So du hien tai: ${formatXu(updated.wallet.xu)}.`;
}

async function settleSession(channel, session) {
  while (getHandScore(session.dealerCards) < 17 && session.dealerCards.length < 5) {
    session.dealerCards.push(drawCard(session.deck));
  }

  const playerScore = getHandScore(session.playerCards);
  const dealerScore = getHandScore(session.dealerCards);
  const playerNguLinh = isNguLinh(session.playerCards);
  const dealerNguLinh = isNguLinh(session.dealerCards);
  let resultText = "";
  let payout = 0;
  let xpGain = 0;

  if (playerNguLinh && dealerNguLinh) {
    payout = session.betAmount;
    const updated = await adjustPlayerXu(session.hostUserId, session.hostUsername, payout, "xidach_push", {
      dealerScore,
      playerScore
    });
    resultText = `Ca hai deu dat ngu linh nen van nay hoa. Ban duoc hoan ${formatXu(session.betAmount)}. So du: ${formatXu(updated.wallet.xu)}.`;
    updateXiDachRanking(session.hostUserId, session.hostUsername, { pushes: 1, games: 1, profitXu: 0 });
    addXiDachHistoryEntry({
      guildId: session.guildId,
      channelId: session.channelId,
      userId: session.hostUserId,
      username: session.hostUsername,
      resultLabel: "Hoa ngu linh",
      betAmount: session.betAmount,
      netXu: 0,
      playerScore,
      dealerScore
    });
  } else if (playerNguLinh) {
    payout = session.betAmount * 2;
    xpGain = WIN_XP_GAIN;
    const updated = await adjustPlayerXu(session.hostUserId, session.hostUsername, payout, "xidach_win", {
      xpGain,
      dealerScore,
      playerScore
    });
    resultText = `Ban dat ngu linh va thang ${formatXu(payout)}. Lai ${formatXu(session.betAmount)}. So du: ${formatXu(updated.wallet.xu)}.`;
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
      resultLabel: "Thang ngu linh",
      betAmount: session.betAmount,
      netXu: session.betAmount,
      playerScore,
      dealerScore
    });
  } else if (dealerNguLinh) {
    resultText = `Nha cai dat ngu linh. Ban thua ${formatXu(session.betAmount)}.`;
    updateXiDachRanking(session.hostUserId, session.hostUsername, { games: 1, profitXu: -session.betAmount });
    addXiDachHistoryEntry({
      guildId: session.guildId,
      channelId: session.channelId,
      userId: session.hostUserId,
      username: session.hostUsername,
      resultLabel: "Thua nha cai ngu linh",
      betAmount: session.betAmount,
      netXu: -session.betAmount,
      playerScore,
      dealerScore
    });
  } else if (playerScore > 21 && dealerScore > 21) {
    payout = session.betAmount;
    const updated = await adjustPlayerXu(session.hostUserId, session.hostUsername, payout, "xidach_push", {
      dealerScore,
      playerScore
    });
    resultText = `Ca hai cung vuot 21 diem nen van nay hoa. Ban duoc hoan ${formatXu(session.betAmount)}. So du: ${formatXu(updated.wallet.xu)}.`;
    updateXiDachRanking(session.hostUserId, session.hostUsername, { pushes: 1, games: 1, profitXu: 0 });
    addXiDachHistoryEntry({
      guildId: session.guildId,
      channelId: session.channelId,
      userId: session.hostUserId,
      username: session.hostUsername,
      resultLabel: "Hoa cung quac",
      betAmount: session.betAmount,
      netXu: 0,
      playerScore,
      dealerScore
    });
  } else if (playerScore > 21) {
    resultText = `Ban da vuot qua 21 diem. Ban thua ${formatXu(session.betAmount)}.`;
    updateXiDachRanking(session.hostUserId, session.hostUsername, { games: 1, profitXu: -session.betAmount });
    addXiDachHistoryEntry({
      guildId: session.guildId,
      channelId: session.channelId,
      userId: session.hostUserId,
      username: session.hostUsername,
      resultLabel: "Thua quac",
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
    resultText = `Ban thang va nhan ${formatXu(payout)}. Lai ${formatXu(session.betAmount)}. So du: ${formatXu(updated.wallet.xu)}.`;
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
      resultLabel: "Thang",
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
    resultText = `Hai ben hoa diem. Ban duoc hoan ${formatXu(session.betAmount)}. So du: ${formatXu(updated.wallet.xu)}.`;
    updateXiDachRanking(session.hostUserId, session.hostUsername, { pushes: 1, games: 1, profitXu: 0 });
    addXiDachHistoryEntry({
      guildId: session.guildId,
      channelId: session.channelId,
      userId: session.hostUserId,
      username: session.hostUsername,
      resultLabel: "Hoa",
      betAmount: session.betAmount,
      netXu: 0,
      playerScore,
      dealerScore
    });
  } else {
    resultText = `Nha cai cao diem hon. Ban thua ${formatXu(session.betAmount)}.`;
    updateXiDachRanking(session.hostUserId, session.hostUsername, { games: 1, profitXu: -session.betAmount });
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
  await closeStatusMessage(channel, session);
  await channel.send({
    embeds: [buildSettlementEmbed(session, resultText)],
    files: buildVisualAttachments(session, { note: resultText, revealDealer: true })
  }).catch(() => {});
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

async function sendStartedRound(channel, nextSession, betAmount) {
  await sendOrRefreshStatusMessage(
    channel,
    nextSession,
    `Van moi da bat dau voi muc cuoc ${formatXu(betAmount)}. Bam **Rut** hoac **Dung** de choi.`
  );
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

      await sendStartedRound(interaction.channel, nextSession, betAmount);
      await interaction.editReply(`Da mo van Xi Dach voi muc cuoc ${formatXu(betAmount)}.`);
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
    await interaction.reply({ content: "Van Xi Dach nay khong con hoat dong.", ephemeral: true });
    return true;
  }

  if (interaction.user.id !== session.hostUserId) {
    await interaction.reply({ content: "Chi nguoi mo van moi duoc bam nut trong van nay.", ephemeral: true });
    return true;
  }

  if (parsed.action === "status") {
    await interaction.deferUpdate();
    await sendOrRefreshStatusMessage(interaction.channel, session, "Day la trang thai hien tai cua van.");
    return true;
  }

  if (parsed.action === "hit") {
    await interaction.deferUpdate();
    if (session.playerCards.length >= 5) {
      await settleSession(interaction.channel, session);
      return true;
    }
    session.playerCards.push(drawCard(session.deck));
    const playerScore = getHandScore(session.playerCards);
    const playerNguLinh = isNguLinh(session.playerCards);
    if (playerScore > 21 || playerNguLinh || session.playerCards.length >= 5) {
      await settleSession(interaction.channel, session);
      return true;
    }

    await sendOrRefreshStatusMessage(interaction.channel, session, `Ban vua rut them bai. Diem hien tai: ${playerScore}.`);
    return true;
  }

  if (parsed.action === "stand") {
    await interaction.deferUpdate();
    await settleSession(interaction.channel, session);
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

    await sendStartedRound(interaction.channel, nextSession, betAmount);
    await interaction.editReply(`Da mo van Xi Dach voi muc cuoc ${formatXu(betAmount)}.`);
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
      return { ok: true, skipReaction: true, reply: "Hien chua co van Xi Dach nao dang chay." };
    }
    return {
      ok: true,
      skipReaction: true,
      embeds: [buildStatusEmbed(session, "Day la trang thai hien tai cua van.")],
      files: buildVisualAttachments(session, { note: "Day la trang thai hien tai cua van.", revealDealer: false })
    };
  }

  if (STOP_KEYWORDS.has(lowered)) {
    if (!session) {
      return { ok: false, reply: "Khong co van Xi Dach nao de huy." };
    }
    if (message.author.id !== session.hostUserId) {
      return { ok: false, reply: "Chi nguoi mo van moi co the huy van Xi Dach nay." };
    }
    stopSession(message.channel.id);
    const refundText = await refundSession(session);
    await closeStatusMessage(message.channel, session);
    return { ok: true, skipReaction: true, reply: `Da huy van Xi Dach. ${refundText}` };
  }

  if (lowered === "!play" || lowered === "!batdau" || lowered === "!xidach") {
    if (session) {
      return { ok: false, reply: "Phong nay dang co van Xi Dach roi. Hay choi xong hoac `!stop` truoc." };
    }

    return {
      ok: true,
      skipReaction: true,
      embeds: [buildLobbyEmbed()],
      components: buildLobbyComponents(message.channel.id),
      files: [buildXuAttachment("xu.png")]
    };
  }

  const match = raw.match(START_RE);
  if (match) {
    try {
      const betAmount = Number(match[2]);
      const nextSession = await startRound({
        guildId: message.guild.id,
        channelId: message.channel.id,
        channelName: message.channel.name || "unknown",
        userId: message.author.id,
        username: message.author.username,
        betAmount
      });

      await sendStartedRound(message.channel, nextSession, betAmount);
      return { ok: true, skipReaction: true, reply: `Da mo van moi o che do Xi Dach. Muc cuoc hien tai la ${formatXu(betAmount)}.` };
    } catch (error) {
      return { ok: false, reply: error.message };
    }
  }

  if (isTextCommand(raw)) {
    return { ok: false, skipReaction: true, reply: getAvailableTextCommandMessage() };
  }

  return null;
}

module.exports = {
  buildStatusEmbed,
  buildVisualAttachments,
  buildRoomGuideText,
  getRoomConfig,
  getSessionStatus,
  handleButtonInteraction,
  handleModalInteraction,
  handleMessage
};
