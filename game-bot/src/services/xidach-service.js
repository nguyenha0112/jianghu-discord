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
  ["!play", "Má»Ÿ báº£ng chá»n má»©c cÆ°á»£c"],
  ["!play 1000", "VÃ o vÃ¡n ngay vá»›i má»©c cÆ°á»£c cá»¥ thá»ƒ"],
  ["!xidach 5000", "VÃ o vÃ¡n ngay vá»›i alias XÃ¬ DÃ¡ch"],
  ["!trangthai", "Xem tráº¡ng thÃ¡i vÃ¡n hiá»‡n táº¡i"],
  ["!stop", "Há»§y vÃ¡n Ä‘ang chÆ¡i vÃ  hoÃ n cÆ°á»£c"],
  ["!bxh", "Xem báº£ng xáº¿p háº¡ng"],
  ["!lichsu", "Xem cÃ¡c vÃ¡n gáº§n Ä‘Ã¢y"],
  ["!help", "Xem hÆ°á»›ng dáº«n nhanh"]
]);

const MIN_BET = 20;
const MAX_BET = 250000;
const WIN_XP_GAIN = 4;
const BET_XP_GAIN = 1;

const ACTION_PREFIX = "xidach:action:";
const MODAL_PREFIX = "xidach:modal:";
const QUICK_BET_VALUES = [40, 100, 200, 400, 1000];

const SUITS = ["â™ ", "â™¥", "â™¦", "â™£"];
const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

function normalizeText(input) {
  return (input || "").trim().toLowerCase();
}

function formatNumber(value) {
  return new Intl.NumberFormat("vi-VN").format(Number(value || 0));
}

function formatXu(value) {
  return `ðŸª™ ${formatNumber(value)} Xu`;
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

function isNguLinh(cards) {
  return cards.length === 5 && getHandScore(cards) <= 21;
}

function getSuitColor(suit) {
  return suit === "â™¥" || suit === "â™¦" ? "ðŸŸ¥" : "â¬›";
}

function padCardRank(rank) {
  return String(rank).padEnd(2, " ");
}

function buildCardAscii(card, hidden = false) {
  if (hidden) {
    return ["â”Œâ”€â”€â”€â”€â”€â”", "â”‚â–‘â–‘â–‘â–‘â–‘â”‚", "â”‚â–‘â–‘â–‘â–‘â–‘â”‚", "â”‚â–‘â–‘â–‘â–‘â–‘â”‚", "â””â”€â”€â”€â”€â”€â”˜"];
  }

  const rank = padCardRank(card.rank);
  const suit = card.suit;
  return [`â”Œâ”€â”€â”€â”€â”€â”`, `â”‚${rank}   â”‚`, `â”‚  ${suit}  â”‚`, `â”‚   ${rank.trim().padStart(2, " ")}â”‚`, `â””â”€â”€â”€â”€â”€â”˜`];
}

function mergeCardAscii(cards, options = {}) {
  const includeHiddenDealerCard = options.includeHiddenDealerCard || false;
  const asciiCards = cards.map((card) => buildCardAscii(card));

  if (includeHiddenDealerCard) {
    asciiCards.push(buildCardAscii(null, true));
  }

  if (asciiCards.length === 0) {
    return "`ChÆ°a cÃ³ bÃ i`";
  }

  const lines = [];
  for (let index = 0; index < asciiCards[0].length; index += 1) {
    lines.push(asciiCards.map((cardLines) => cardLines[index]).join(" "));
  }

  const suitLegend = asciiCards
    .map((_, idx) => {
      if (includeHiddenDealerCard && idx === asciiCards.length - 1) {
        return "ðŸ‚ ";
      }
      return getSuitColor(cards[idx]?.suit || "â™ ");
    })
    .join(" ");

  return ["```text", ...lines, "```", suitLegend].join("\n");
}

function formatCards(cards) {
  return mergeCardAscii(cards);
}

function formatDealerPreview(cards) {
  if (!cards.length) {
    return "`ChÆ°a cÃ³ bÃ i`";
  }
  return mergeCardAscii([cards[0]], { includeHiddenDealerCard: true });
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
        .setLabel("ðŸƒ RÃºt")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`${ACTION_PREFIX}${session.channelId}:stand`)
        .setLabel("âœ‹ Dá»«ng")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`${ACTION_PREFIX}${session.channelId}:status`)
        .setLabel("ðŸ“œ Xem lÆ°á»£t")
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
          .setLabel(`ðŸª™ ${formatNumber(amount)}`)
          .setStyle(ButtonStyle.Primary)
      )
    ),
    new ActionRowBuilder().addComponents(
      ...QUICK_BET_VALUES.slice(3).map((amount) =>
        new ButtonBuilder()
          .setCustomId(`${ACTION_PREFIX}${channelId}:start:${amount}`)
          .setLabel(`ðŸª™ ${formatNumber(amount)}`)
          .setStyle(ButtonStyle.Secondary)
      ),
      new ButtonBuilder()
        .setCustomId(`${ACTION_PREFIX}${channelId}:custom`)
        .setLabel("âœï¸ Nháº­p cÆ°á»£c")
        .setStyle(ButtonStyle.Success)
    )
  ];
}

function buildLobbyEmbed(channelId) {
  return new EmbedBuilder()
    .setColor(0x8e44ad)
    .setTitle("ðŸƒ Má»Ÿ VÃ¡n XÃ¬ DÃ¡ch")
    .setThumbnail(emojiToTwemojiUrl("ðŸƒ"))
    .setDescription(
      [
        "Chá»n nhanh má»™t má»©c cÆ°á»£c bÃªn dÆ°á»›i Ä‘á»ƒ vÃ o vÃ¡n.",
        `CÆ°á»£c tá»‘i thiá»ƒu: **${formatXu(MIN_BET)}**`,
        `CÆ°á»£c tá»‘i Ä‘a: **${formatXu(MAX_BET)}**`,
        "CÃ³ thá»ƒ báº¥m **Nháº­p cÆ°á»£c** Ä‘á»ƒ Ä‘iá»n sá»‘ tiá»n báº¥t ká»³.",
        "Báº¡n cÅ©ng cÃ³ thá»ƒ gÃµ tay nhÆ° `!play 1000`."
      ].join("\n")
    )
    .setFooter({ text: "Sau khi vÃ o vÃ¡n, báº¥m RÃºt hoáº·c Dá»«ng Ä‘á»ƒ chÆ¡i." });
}

function buildBetModal(channelId) {
  return new ModalBuilder()
    .setCustomId(`${MODAL_PREFIX}${channelId}`)
    .setTitle("Nháº­p má»©c cÆ°á»£c XÃ¬ DÃ¡ch")
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("amount")
          .setLabel(`Nháº­p sá»‘ Xu (${MIN_BET} - ${MAX_BET})`)
          .setPlaceholder("VÃ­ dá»¥: 12000")
          .setRequired(true)
          .setStyle(TextInputStyle.Short)
      )
    );
}

function buildStatusEmbed(session, note = "Äáº¿n lÆ°á»£t ngÆ°á»i chÆ¡i quyáº¿t Ä‘á»‹nh.") {
  const playerScore = getHandScore(session.playerCards);
  const dealerVisible = formatDealerPreview(session.dealerCards);

  return new EmbedBuilder()
    .setColor(0x9b59b6)
    .setTitle("ðŸƒ XÃ¬ DÃ¡ch Jianghu")
    .setThumbnail(emojiToTwemojiUrl("ðŸƒ"))
    .setDescription(
      [
        `**NgÆ°á»i chÆ¡i:** <@${session.hostUserId}>`,
        `**CÆ°á»£c:** ${formatXu(session.betAmount)}`,
        `**Äiá»ƒm báº¡n:** ${playerScore}`,
        `**BÃ i báº¡n:** ${formatCards(session.playerCards)}`,
        `**BÃ i nhÃ  cÃ¡i:** ${dealerVisible}`
      ].join("\n")
    )
    .addFields({ name: "ðŸ“¢ ThÃ´ng bÃ¡o", value: note, inline: false })
    .setFooter({ text: "Báº¥m RÃºt Ä‘á»ƒ bá»‘c thÃªm bÃ i, báº¥m Dá»«ng Ä‘á»ƒ chá»‘t Ä‘iá»ƒm vá»›i nhÃ  cÃ¡i." });
}

function buildSettlementEmbed(session, resultText) {
  const playerScore = getHandScore(session.playerCards);
  const dealerScore = getHandScore(session.dealerCards);

  return new EmbedBuilder()
    .setColor(0x8e44ad)
    .setTitle("ðŸƒ Káº¿t Quáº£ XÃ¬ DÃ¡ch")
    .setThumbnail(emojiToTwemojiUrl("ðŸƒ"))
    .setDescription(
      [
        resultText,
        "",
        `**Báº¡n - ${playerScore}**`,
        formatCards(session.playerCards),
        "",
        `**NhÃ  cÃ¡i - ${dealerScore}**`,
        formatCards(session.dealerCards)
      ].join("\n")
    );
}

async function sendOrRefreshStatusMessage(channel, session, note) {
  const payload = {
    embeds: [buildStatusEmbed(session, note)],
    components: buildActionComponents(session)
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
      embeds: [buildStatusEmbed(session, "VÃ¡n Ä‘Ã£ káº¿t thÃºc.")],
      components: []
    });
  } catch {
    // Bo qua neu khong fetch/edit duoc tin nhan ban choi cu.
  }
}

function getHelpText() {
  return [
    "Luáº­t: nháº¯n `!play` Ä‘á»ƒ má»Ÿ báº£ng chá»n má»©c cÆ°á»£c, hoáº·c `!play 1000` Ä‘á»ƒ vÃ o vÃ¡n luÃ´n.",
    "Sau Ä‘Ã³ báº¥m `RÃºt` Ä‘á»ƒ láº¥y thÃªm bÃ i hoáº·c `Dá»«ng` Ä‘á»ƒ so Ä‘iá»ƒm vá»›i nhÃ  cÃ¡i.",
    "A cÃ³ thá»ƒ tÃ­nh lÃ  1 hoáº·c 11. QuÃ¡ 21 lÃ  quáº¯c ngay.",
    "Nháº¯n `!stop` hoáº·c `!out` Ä‘á»ƒ thoÃ¡t vÃ¡n Ä‘ang treo.",
    "Nháº¯n `!bxh` Ä‘á»ƒ xem báº£ng xáº¿p háº¡ng, `!lichsu` Ä‘á»ƒ xem cÃ¡c vÃ¡n gáº§n Ä‘Ã¢y."
  ].join("\n");
}

function getRankingText() {
  const ranking = getXiDachRanking(10);
  if (ranking.length === 0) {
    return "XÃ¬ DÃ¡ch chÆ°a cÃ³ dá»¯ liá»‡u xáº¿p háº¡ng.";
  }

  return [
    "**ðŸ† Báº£ng xáº¿p háº¡ng XÃ¬ DÃ¡ch**",
    ...ranking.map(
      (entry, index) =>
        `${index + 1}. <@${entry.userId}> - Tháº¯ng: ${entry.wins}, HÃ²a: ${entry.pushes}, LÃ£i: ${formatXu(entry.profitXu)}, VÃ¡n: ${entry.games}, Ä‚n Ä‘áº­m nháº¥t: ${formatXu(entry.bestWinXu)}`
    )
  ].join("\n");
}

function getHistoryText() {
  const history = getXiDachHistory(8);
  if (history.length === 0) {
    return "XÃ¬ DÃ¡ch chÆ°a cÃ³ lá»‹ch sá»­ vÃ¡n nÃ o.";
  }

  return [
    "**ðŸ§¾ Lá»‹ch sá»­ XÃ¬ DÃ¡ch gáº§n Ä‘Ã¢y**",
    ...history.map(
      (entry, index) =>
        `${index + 1}. <@${entry.userId}> | Káº¿t quáº£: ${entry.resultLabel} | CÆ°á»£c: ${formatXu(entry.betAmount)} | LÃ£i: ${formatXu(entry.netXu)} | Äiá»ƒm: ${entry.playerScore}-${entry.dealerScore}`
    )
  ].join("\n");
}

function buildRankingEmbed() {
  const ranking = getXiDachRanking(10);
  return new EmbedBuilder()
    .setColor(0xf1c40f)
    .setTitle("ðŸ† Báº£ng Xáº¿p Háº¡ng XÃ¬ DÃ¡ch")
    .setThumbnail(emojiToTwemojiUrl("ðŸƒ"))
    .setDescription(
      ranking.length > 0
        ? ranking
            .map(
              (entry, index) =>
                `**${index + 1}.** <@${entry.userId}>\nTháº¯ng: **${entry.wins}** | HÃ²a: **${entry.pushes}** | LÃ£i: **${formatXu(entry.profitXu)}** | VÃ¡n: **${entry.games}**`
            )
            .join("\n\n")
        : "XÃ¬ DÃ¡ch chÆ°a cÃ³ dá»¯ liá»‡u xáº¿p háº¡ng."
    )
    .setFooter({ text: "DÃ¹ng !me Ä‘á»ƒ xem thá»‘ng kÃª cÃ¡ nhÃ¢n." });
}

function buildHistoryEmbed() {
  const history = getXiDachHistory(8);
  return new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle("ðŸ§¾ Lá»‹ch Sá»­ XÃ¬ DÃ¡ch Gáº§n ÄÃ¢y")
    .setThumbnail(emojiToTwemojiUrl("ðŸ§¾"))
    .setDescription(
      history.length > 0
        ? history
            .map(
              (entry, index) =>
                `**${index + 1}.** <@${entry.userId}>\nKáº¿t quáº£: **${entry.resultLabel}** | CÆ°á»£c: **${formatXu(entry.betAmount)}**\nLÃ£i: **${formatXu(entry.netXu)}** | Äiá»ƒm: **${entry.playerScore}-${entry.dealerScore}**`
            )
            .join("\n\n")
        : "XÃ¬ DÃ¡ch chÆ°a cÃ³ lá»‹ch sá»­ vÃ¡n nÃ o."
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
    .setTitle("ðŸƒ Há»“ SÆ¡ XÃ¬ DÃ¡ch")
    .setThumbnail(emojiToTwemojiUrl("ðŸƒ"))
    .setDescription(`<@${player.userId}> - **${username}**`)
    .addFields(
      {
        name: "ðŸª™ VÃ­ hiá»‡n táº¡i",
        value: `Xu: **${formatXu(player.wallet.xu)}**\nNgá»c: **${formatNumber(player.wallet.ngoc)}**`,
        inline: true
      },
      {
        name: "ðŸŽ® ThÃ nh tÃ­ch XÃ¬ DÃ¡ch",
        value: `VÃ¡n: **${totalGames}**\nTháº¯ng: **${wins}**\nHÃ²a: **${pushes}**\nTá»‰ lá»‡ tháº¯ng: **${winRate}%**`,
        inline: true
      },
      {
        name: "ðŸ“ˆ Hiá»‡u suáº¥t",
        value: `LÃ£i rÃ²ng: **${formatXu(profitXu)}**\nÄ‚n Ä‘áº­m nháº¥t: **${formatXu(bestWinXu)}**`,
        inline: false
      },
      {
        name: "âœ¨ Tu vi tá»•ng",
        value: `Cáº¥p: **${player.stats.playerLevel}**\nXP: **${player.stats.playerXp}/100**\n${buildProgressBar(player.stats.playerXp, 100, 12)}`,
        inline: false
      }
    );
}

function buildRoomGuideText() {
  return [
    "**PhÃ²ng XÃ¬ DÃ¡ch Ä‘Ã£ sáºµn sÃ ng.**",
    "Nháº¯n `!play` Ä‘á»ƒ má»Ÿ báº£ng chá»n má»©c cÆ°á»£c, hoáº·c `!play 1000` Ä‘á»ƒ vÃ o tháº³ng vÃ¡n.",
    "Báº¥m `RÃºt` hoáº·c `Dá»«ng` Ä‘á»ƒ chÆ¡i.",
    "`!trangthai` Ä‘á»ƒ xem láº¡i bÃ n hiá»‡n táº¡i, `!stop` Ä‘á»ƒ há»§y vÃ¡n."
  ].join("\n");
}

function isTextCommand(raw) {
  return typeof raw === "string" && raw.trim().startsWith("!");
}

function getAvailableTextCommandMessage() {
  return [
    "Lá»‡nh chÆ°a Ä‘Ãºng. Báº¡n cÃ³ thá»ƒ dÃ¹ng:",
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
    throw new Error("PhÃ²ng nÃ y chÆ°a Ä‘Æ°á»£c báº­t cho XÃ¬ DÃ¡ch. HÃ£y dÃ¹ng `/xidach-tao-phong` trÆ°á»›c.");
  }

  if (sessions.has(channelId)) {
    throw new Error("PhÃ²ng nÃ y Ä‘ang cÃ³ má»™t vÃ¡n XÃ¬ DÃ¡ch rá»“i. HÃ£y chÆ¡i xong hoáº·c `!stop` trÆ°á»›c.");
  }

  if (!Number.isInteger(betAmount) || betAmount < MIN_BET || betAmount > MAX_BET) {
    throw new Error(`CÆ°á»£c pháº£i tá»« ${formatNumber(MIN_BET)} Ä‘áº¿n ${formatNumber(MAX_BET)} Xu.`);
  }

  const player = await ensureWalletPlayer(userId, username);
  if (player.wallet.xu < betAmount) {
    throw new Error(`Báº¡n khÃ´ng Ä‘á»§ Xu Ä‘á»ƒ cÆ°á»£c. Sá»‘ dÆ° hiá»‡n táº¡i: ${formatXu(player.wallet.xu)}.`);
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
  return `ÄÃ£ hoÃ n ${formatXu(session.betAmount)} cho <@${session.hostUserId}>. Sá»‘ dÆ° hiá»‡n táº¡i: ${formatXu(updated.wallet.xu)}.`;
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
    resultText = `Cáº£ hai Ä‘á»u Ä‘áº¡t ngÅ© linh nÃªn vÃ¡n nÃ y hÃ²a. Báº¡n Ä‘Æ°á»£c hoÃ n ${formatXu(session.betAmount)}. Sá»‘ dÆ°: ${formatXu(updated.wallet.xu)}.`;
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
      resultLabel: "HÃ²a ngÅ© linh",
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
    resultText = `Báº¡n Ä‘áº¡t ngÅ© linh vÃ  tháº¯ng ${formatXu(payout)}. LÃ£i ${formatXu(session.betAmount)}. Sá»‘ dÆ°: ${formatXu(updated.wallet.xu)}.`;
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
      resultLabel: "Tháº¯ng ngÅ© linh",
      betAmount: session.betAmount,
      netXu: session.betAmount,
      playerScore,
      dealerScore
    });
  } else if (dealerNguLinh) {
    resultText = `NhÃ  cÃ¡i Ä‘áº¡t ngÅ© linh. Báº¡n thua ${formatXu(session.betAmount)}.`;
    updateXiDachRanking(session.hostUserId, session.hostUsername, {
      games: 1,
      profitXu: -session.betAmount
    });
    addXiDachHistoryEntry({
      guildId: session.guildId,
      channelId: session.channelId,
      userId: session.hostUserId,
      username: session.hostUsername,
      resultLabel: "Thua nhÃ  cÃ¡i ngÅ© linh",
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
    resultText = `Cáº£ hai cÃ¹ng vÆ°á»£t 21 Ä‘iá»ƒm nÃªn vÃ¡n nÃ y hÃ²a. Báº¡n Ä‘Æ°á»£c hoÃ n ${formatXu(session.betAmount)}. Sá»‘ dÆ°: ${formatXu(updated.wallet.xu)}.`;
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
      resultLabel: "HÃ²a cÃ¹ng quáº¯c",
      betAmount: session.betAmount,
      netXu: 0,
      playerScore,
      dealerScore
    });
  } else if (playerScore > 21) {
    resultText = `Báº¡n Ä‘Ã£ vÆ°á»£t quÃ¡ 21 Ä‘iá»ƒm. Báº¡n thua ${formatXu(session.betAmount)}.`;
    updateXiDachRanking(session.hostUserId, session.hostUsername, {
      games: 1,
      profitXu: -session.betAmount
    });
    addXiDachHistoryEntry({
      guildId: session.guildId,
      channelId: session.channelId,
      userId: session.hostUserId,
      username: session.hostUsername,
      resultLabel: "Thua quáº¯c",
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
    resultText = `Báº¡n tháº¯ng vÃ  nháº­n ${formatXu(payout)}. LÃ£i ${formatXu(session.betAmount)}. Sá»‘ dÆ°: ${formatXu(updated.wallet.xu)}.`;
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
      resultLabel: "Tháº¯ng",
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
    resultText = `Hai bÃªn hÃ²a Ä‘iá»ƒm. Báº¡n Ä‘Æ°á»£c hoÃ n ${formatXu(session.betAmount)}. Sá»‘ dÆ°: ${formatXu(updated.wallet.xu)}.`;
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
      resultLabel: "HÃ²a",
      betAmount: session.betAmount,
      netXu: 0,
      playerScore,
      dealerScore
    });
  } else {
    resultText = `NhÃ  cÃ¡i cao Ä‘iá»ƒm hÆ¡n. Báº¡n thua ${formatXu(session.betAmount)}.`;
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
  await closeStatusMessage(channel, session);
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

async function sendStartedRound(channel, nextSession, betAmount) {
  await sendOrRefreshStatusMessage(
    channel,
    nextSession,
    `VÃ¡n má»›i Ä‘Ã£ báº¯t Ä‘áº§u vá»›i má»©c cÆ°á»£c ${formatXu(betAmount)}. Báº¥m **RÃºt** hoáº·c **Dá»«ng** Ä‘á»ƒ chÆ¡i.`
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
      await interaction.editReply(`ÄÃ£ má»Ÿ vÃ¡n XÃ¬ DÃ¡ch vá»›i má»©c cÆ°á»£c ${formatXu(betAmount)}.`);
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
    await interaction.reply({ content: "VÃ¡n XÃ¬ DÃ¡ch nÃ y khÃ´ng cÃ²n hoáº¡t Ä‘á»™ng.", ephemeral: true });
    return true;
  }

  if (interaction.user.id !== session.hostUserId) {
    await interaction.reply({ content: "Chá»‰ ngÆ°á»i má»Ÿ vÃ¡n má»›i Ä‘Æ°á»£c báº¥m nÃºt trong vÃ¡n nÃ y.", ephemeral: true });
    return true;
  }

  if (parsed.action === "status") {
    await interaction.deferReply({ ephemeral: true });
    await sendOrRefreshStatusMessage(interaction.channel, session, "ÄÃ¢y lÃ  tráº¡ng thÃ¡i hiá»‡n táº¡i cá»§a vÃ¡n.");
    await interaction.editReply("ÄÃ£ cáº­p nháº­t láº¡i bÃ n XÃ¬ DÃ¡ch hiá»‡n táº¡i.");
    return true;
  }

  if (parsed.action === "hit") {
    await interaction.deferReply({ ephemeral: true });
    if (session.playerCards.length >= 5) {
      await settleSession(interaction.channel, session);
      await interaction.editReply("Ban da du 5 la nen bot chot van theo luat hien tai.");
      return true;
    }
    session.playerCards.push(drawCard(session.deck));
    const playerScore = getHandScore(session.playerCards);
    const playerNguLinh = isNguLinh(session.playerCards);
    if (playerScore > 21 || playerNguLinh || session.playerCards.length >= 5) {
      await settleSession(interaction.channel, session);
      await interaction.editReply(
        playerScore > 21
          ? "Ban da quac. Bot da chot van va gui ket qua trong phong."
          : playerNguLinh
            ? "Ban da du 5 la khong quac, bot chot van theo luat ngu linh."
            : "Ban da du 5 la nen bot chot van theo luat hien tai."
      );
      return true;
    }

    await sendOrRefreshStatusMessage(interaction.channel, session, `Ban vua rut them bai. Diem hien tai: ${playerScore}.`);
    await interaction.editReply("Da cap nhat ban Xi Dach sau luot rut.");
    return true;
  }

  if (parsed.action === "stand") {
    await interaction.deferReply({ ephemeral: true });
    await settleSession(interaction.channel, session);
    await interaction.editReply("ÄÃ£ dá»«ng rÃºt bÃ i vÃ  chá»‘t vÃ¡n. Káº¿t quáº£ Ä‘Ã£ gá»­i vÃ o phÃ²ng.");
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
    await interaction.editReply(`ÄÃ£ má»Ÿ vÃ¡n XÃ¬ DÃ¡ch vá»›i má»©c cÆ°á»£c ${formatXu(betAmount)}.`);
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
      return { ok: true, skipReaction: true, reply: "Hiá»‡n chÆ°a cÃ³ vÃ¡n XÃ¬ DÃ¡ch nÃ o Ä‘ang cháº¡y." };
    }
    return { ok: true, skipReaction: true, reply: "ÄÃ¢y lÃ  tráº¡ng thÃ¡i hiá»‡n táº¡i cá»§a vÃ¡n.", silent: false };
  }

  if (STOP_KEYWORDS.has(lowered)) {
    if (!session) {
      return { ok: true, skipReaction: true, reply: "Hiá»‡n chÆ°a cÃ³ vÃ¡n XÃ¬ DÃ¡ch nÃ o Ä‘á»ƒ há»§y." };
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

      await sendStartedRound(message.channel, nextSession, betAmount);
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

