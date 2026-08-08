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
const fs = require("node:fs");
const path = require("node:path");
const { addPlayerXp } = require("../lib/player-progression");
const { canManageGameRoom } = require("../lib/room-admin");
const { buildProgressBar } = require("../lib/ui-theme");
const { buildCurrencyPairAttachment } = require("../lib/currency-assets");
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

const START_RE = /^!(play|batdau|xidach)\s+(.+)$/u;
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

const CARD_DIR = path.join(__dirname, "..", "..", "assets", "cards");
const STALE_SESSION_MS = 5 * 60 * 1000;

function normalizeText(input) {
  return (input || "").trim().toLowerCase();
}

function formatNumber(value) {
  return new Intl.NumberFormat("vi-VN").format(Number(value || 0));
}

function formatXu(value) {
  return `Xu ${formatNumber(value)}`;
}

function parseBetAmount(input) {
  const normalized = String(input || "").replace(/[^\d]/g, "");
  if (!normalized) {
    return NaN;
  }
  return Number(normalized);
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

function escapeXml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function cardAssetName(card) {
  return `${card.rank}${card.suitCode || card.assetCode}.png`;
}

function cardDataUri(card, hidden = false) {
  const filePath = path.join(CARD_DIR, hidden ? "BACK.png" : cardAssetName(card));
  const data = fs.readFileSync(filePath).toString("base64");
  return `data:image/png;base64,${data}`;
}

function buildCardImages(cards, { x, y, hiddenAfterFirst = false } = {}) {
  return cards
    .map((card, index) => {
      const hidden = hiddenAfterFirst && index > 0;
      const href = cardDataUri(card, hidden);
      const cardX = x + index * 54;
      return `<image href="${href}" x="${cardX}" y="${y}" width="70" height="98" preserveAspectRatio="xMidYMid meet"/>`;
    })
    .join("");
}

function buildXuIconAttachment(attachmentName = "xu.svg") {
  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">',
    '<defs><radialGradient id="g" cx="36%" cy="30%"><stop offset="0" stop-color="#fff3bd"/><stop offset="0.45" stop-color="#d2a152"/><stop offset="1" stop-color="#6d4526"/></radialGradient></defs>',
    '<circle cx="64" cy="64" r="50" fill="url(#g)" stroke="#f7d78a" stroke-width="6"/>',
    '<circle cx="64" cy="64" r="33" fill="none" stroke="#8b5a2e" stroke-width="5" opacity="0.85"/>',
    '<path d="M42 55h44M42 73h44M64 37v54" stroke="#fff0b5" stroke-width="7" stroke-linecap="round"/>',
    '<path d="M50 45c12-10 34-4 35 15 1 21-24 28-41 16" fill="none" stroke="#5b351e" stroke-width="5" stroke-linecap="round"/>',
    '</svg>'
  ].join("");
  return new AttachmentBuilder(Buffer.from(svg, "utf8"), { name: attachmentName });
}

function buildBoardAttachment(session, options = {}) {
  const payload = buildBoardPayload(session, options);
  const dealerHidden = !payload.revealDealer;
  const safeNote = escapeXml(payload.note);
  const safePlayerName = escapeXml(payload.playerName);
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="900" height="420" viewBox="0 0 900 420">
  <defs>
    <linearGradient id="felt" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0" stop-color="#123f32"/>
      <stop offset="1" stop-color="#071f19"/>
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="8" stdDeviation="9" flood-color="#000" flood-opacity="0.35"/>
    </filter>
  </defs>
  <rect width="900" height="420" rx="28" fill="url(#felt)"/>
  <rect x="18" y="18" width="864" height="384" rx="24" fill="none" stroke="#d8b66f" stroke-width="4"/>
  <text x="42" y="58" fill="#fff2d2" font-family="Arial, sans-serif" font-size="30" font-weight="700">${escapeXml(payload.title)}</text>
  <text x="42" y="88" fill="#a7d3bd" font-family="Arial, sans-serif" font-size="16">Xì Dách Jianghu</text>

  <g filter="url(#shadow)">
    <rect x="42" y="116" width="540" height="126" rx="20" fill="#145540" stroke="#4fa27d"/>
    <text x="66" y="150" fill="#fff2d2" font-family="Arial, sans-serif" font-size="20" font-weight="700">Người chơi: ${safePlayerName}</text>
    <text x="66" y="178" fill="#e6f1e9" font-family="Arial, sans-serif" font-size="17">Điểm: ${payload.playerScore} • Cược: ${escapeXml(payload.betText)}</text>
    ${buildCardImages(payload.playerCards, { x: 328, y: 132 })}
  </g>

  <g filter="url(#shadow)">
    <rect x="42" y="266" width="540" height="112" rx="20" fill="#0f4335" stroke="#3f8b6e"/>
    <text x="66" y="300" fill="#fff2d2" font-family="Arial, sans-serif" font-size="20" font-weight="700">Nhà cái</text>
    <text x="66" y="328" fill="#e6f1e9" font-family="Arial, sans-serif" font-size="17">Điểm: ${escapeXml(payload.dealerScoreText)}</text>
    ${buildCardImages(payload.dealerCards, { x: 328, y: 273, hiddenAfterFirst: dealerHidden })}
  </g>

  <g filter="url(#shadow)">
    <rect x="614" y="116" width="244" height="262" rx="20" fill="#0a362b" stroke="#4f9d7c"/>
    <text x="638" y="152" fill="#fff2d2" font-family="Arial, sans-serif" font-size="20" font-weight="700">Thông tin ván</text>
    <text x="638" y="190" fill="#e6f1e9" font-family="Arial, sans-serif" font-size="16">${safeNote}</text>
    <text x="638" y="232" fill="#b9dccb" font-family="Arial, sans-serif" font-size="15">Bài bạn: ${payload.playerCards.length} lá</text>
    <text x="638" y="260" fill="#b9dccb" font-family="Arial, sans-serif" font-size="15">Bài nhà cái: ${payload.dealerCards.length} lá</text>
    <text x="638" y="304" fill="#f4d58d" font-family="Arial, sans-serif" font-size="15">Rút tối đa 5 lá.</text>
    <text x="638" y="330" fill="#f4d58d" font-family="Arial, sans-serif" font-size="15">5 lá không quá 21 là Ngũ Linh.</text>
  </g>
</svg>`;

  return new AttachmentBuilder(Buffer.from(svg, "utf8"), { name: "xidach-board.svg" });
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
    createdAt: new Date().toISOString(),
    updatedAt: Date.now()
  };
}

function touchSession(session) {
  if (session) {
    session.updatedAt = Date.now();
  }
}

function isStaleSession(session) {
  return !session?.updatedAt || Date.now() - session.updatedAt > STALE_SESSION_MS;
}

function canStopSession(user, member, session) {
  return user?.id === session.hostUserId || canManageGameRoom({ user, member }) || isStaleSession(session);
}

function getActiveSessionText(session) {
  const staleHint = isStaleSession(session)
    ? "Ván đã treo quá 5 phút, người khác có thể dùng `!stop` để dọn."
    : "Chỉ chủ ván hoặc admin có thể dùng `!stop` để hủy.";
  return `Phòng đang có ván Xì Dách của <@${session.hostUserId}> với cược ${formatXu(session.betAmount)}. ${staleHint}`;
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
    .setTitle("Mở ván Xì Dách")
    .setThumbnail("attachment://xu.svg")
    .setDescription(
      [
        "Chọn nhanh một mức cược bên dưới để vào ván.",
        `Cược tối thiểu: **${formatXu(MIN_BET)}**`,
        `Cược tối đa: **${formatXu(MAX_BET)}**`,
        "Bạn cũng có thể bấm **Nhập cược** để điền số tiền bất kỳ.",
        "Hoặc gõ tay: `!play 1000`."
      ].join("\n")
    )
    .setFooter({ text: "Sau khi vào ván, bấm Rút hoặc Dừng để chơi." });
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
    .setImage("attachment://xidach-board.svg")
    .setFooter({ text: "Bàn bài dùng icon nhỏ để dễ nhìn hơn trên Discord mobile." });
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
    .setImage("attachment://xidach-board.svg")
    .setFooter({ text: "Bàn bài cuối đã được render thành một khung tổng hợp." });
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
      const betAmount = parseBetAmount(parsed.value);
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
    await interaction.reply({ content: `${getActiveSessionText(session)} Bạn không phải chủ ván nên không bấm nút được.`, ephemeral: true });
    return true;
  }

  if (parsed.action === "status") {
    await interaction.deferUpdate();
    touchSession(session);
    await sendOrRefreshStatusMessage(interaction.channel, session, "Day la trang thai hien tai cua van.");
    return true;
  }

  if (parsed.action === "hit") {
    await interaction.deferUpdate();
    touchSession(session);
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
    touchSession(session);
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
    const betAmount = parseBetAmount(interaction.fields.getTextInputValue("amount"));
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
    if (!canStopSession(message.author, message.member, session)) {
      return { ok: false, reply: getActiveSessionText(session) };
    }
    stopSession(message.channel.id);
    const refundText = await refundSession(session);
    await closeStatusMessage(message.channel, session);
    return { ok: true, skipReaction: true, reply: `Da huy van Xi Dach. ${refundText}` };
  }

  if (lowered === "!play" || lowered === "!batdau" || lowered === "!xidach") {
    if (session) {
      return { ok: false, skipReaction: true, reply: getActiveSessionText(session) };
    }

    return {
      ok: true,
      skipReaction: true,
      embeds: [buildLobbyEmbed()],
      components: buildLobbyComponents(message.channel.id),
      files: [buildXuIconAttachment("xu.svg")]
    };
  }

  const match = raw.match(START_RE);
  if (match) {
    try {
      const betAmount = parseBetAmount(match[2]);
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
  stopSession,
  handleButtonInteraction,
  handleModalInteraction,
  handleMessage
};
