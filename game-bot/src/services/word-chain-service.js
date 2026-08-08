const fs = require("node:fs");
const path = require("node:path");
const { EmbedBuilder } = require("discord.js");
const { canManageGameRoom } = require("../lib/room-admin");
const { lookupVietnameseDictionary } = require("../lib/vietnamese-dictionary");
const { addPlayerXp } = require("../lib/player-progression");
const { appendTransaction } = require("../storage/transaction-store");
const { ensurePlayer, getPlayer, updatePlayer } = require("../storage/player-store");
const { getRoom, isEnabledRoom } = require("../storage/word-chain-room-store");
const { listCandidatePhrases, recordCandidatePhrase, updateCandidatePhrase } = require("../storage/word-chain-candidate-store");
const { getWordChainRanking, updateWordChainRanking } = require("../storage/word-chain-ranking-store");

const sessions = new Map();
const recentHistoryByGuild = new Map();

const MAX_RECENT_WORDS = 30;
const MIN_PVP_REWARDED_PLAYERS = 2;
const PVP_POINT_REWARD_XU = 12;
const PVP_WIN_BONUS_XU = 30;
const PVP_CHECKPOINT_INTERVAL = 25;
const PVP_CHECKPOINT_LEADER_BONUS_XU = 60;
const PVE_POINT_REWARD_XU = 10;
const PVE_WIN_BONUS_XU = 20;
const WORD_CHAIN_POINT_XP = 4;
const WORD_CHAIN_WIN_BONUS_XP = 12;
const BOT_PVE_USER_ID = "jianghu-pve-bot";
const BOT_PVE_NAME = "Jianghu Bot";

const REFERENCE_PAIR_DICTIONARY_PATH = path.join(__dirname, "..", "..", "data", "reference-wordPairs.json");
const PHRASE_DICTIONARY_PATH = path.join(__dirname, "..", "..", "data", "vietnamese-compound-phrases.txt");
const CUSTOM_PHRASE_DICTIONARY_PATH = path.join(__dirname, "..", "..", "data", "custom-vietnamese-phrases.txt");
const BANNED_PHRASE_DICTIONARY_PATH = path.join(__dirname, "..", "..", "data", "word-chain-banned-phrases.txt");
const PREFERRED_PHRASE_DICTIONARY_PATH = path.join(__dirname, "..", "..", "data", "word-chain-preferred-phrases.txt");
const STARTER_PHRASE_DICTIONARY_PATH = path.join(__dirname, "..", "..", "data", "word-chain-starter-phrases.txt");

const FALLBACK_SEEDS = ["niềm vui", "quê nhà", "bình yên", "hy vọng", "gia đình", "vui vẻ", "tình cảm", "hoa hồng"];

const START_KEYWORDS = new Set(["!batdau", "!play"]);
const STOP_KEYWORDS = new Set(["!stop"]);
const HELP_KEYWORDS = new Set(["!help", "!huongdan"]);
const RANK_KEYWORDS = new Set(["!rank", "!bxh", "!xephang"]);
const STATUS_KEYWORDS = new Set(["!trangthai", "!status"]);
const ADMIN_PENDING_KEYWORDS = new Set(["!tuduyet", "!pendingtu"]);
const TEXT_COMMAND_ALIASES = new Map([
  ["!batdau", "Mở ván mới"],
  ["!play", "Mở ván mới"],
  ["!stop", "Kết thúc ván hiện tại"],
  ["!trangthai", "Xem bảng trạng thái hiện tại"],
  ["!rank", "Xem bảng xếp hạng PvE"],
  ["!bxh", "Xem bảng xếp hạng PvE"],
  ["!help", "Xem hướng dẫn nhanh"],
  ["!huongdan", "Xem hướng dẫn nhanh"]
]);

const phraseCatalog = loadPhraseCatalog();
const validPhraseSet = new Set(phraseCatalog.allPhrases);
const customPhraseSet = new Set(phraseCatalog.customPhrases);
const referencePhraseSet = new Set(phraseCatalog.referencePhrases);
const bannedPhraseSet = new Set(phraseCatalog.bannedPhrases);
const preferredPhraseSet = new Set(phraseCatalog.preferredPhrases);
const starterPhraseSet = new Set(phraseCatalog.starterPhrases);
const phrasesByFirstToken = buildPhraseIndex(validPhraseSet);

function loadPhraseCatalog() {
  try {
    const referencePhrases = loadReferencePhrasePairs(REFERENCE_PAIR_DICTIONARY_PATH);
    const basePhrases = loadPhraseFile(PHRASE_DICTIONARY_PATH);
    const customPhrases = loadPhraseFile(CUSTOM_PHRASE_DICTIONARY_PATH);
    const bannedPhrases = loadPhraseFile(BANNED_PHRASE_DICTIONARY_PATH);
    const preferredPhrases = loadPhraseFile(PREFERRED_PHRASE_DICTIONARY_PATH);
    const starterPhrases = loadPhraseFile(STARTER_PHRASE_DICTIONARY_PATH);
    const allPhrases =
      referencePhrases.length > 0
        ? [...new Set([...referencePhrases, ...customPhrases, ...starterPhrases])]
        : [...new Set([...basePhrases, ...customPhrases, ...starterPhrases])];

    return {
      allPhrases: allPhrases.filter((phrase) => !bannedPhrases.includes(phrase)),
      referencePhrases: [...new Set(referencePhrases)],
      customPhrases: [...new Set(customPhrases)],
      bannedPhrases: [...new Set(bannedPhrases)],
      preferredPhrases: [...new Set(preferredPhrases)],
      starterPhrases: [...new Set(starterPhrases)]
    };
  } catch (error) {
    console.error("Không thể tải dữ liệu nối từ:", error.message);
    const fallback = FALLBACK_SEEDS.map((phrase) => normalizePhrase(phrase));
    return {
      allPhrases: fallback,
      referencePhrases: fallback,
      customPhrases: fallback,
      bannedPhrases: [],
      preferredPhrases: fallback,
      starterPhrases: fallback
    };
  }
}

function loadReferencePhrasePairs(filePath) {
  if (!fs.existsSync(filePath)) {
    return [];
  }
  const raw = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const phrases = [];

  for (const [firstToken, seconds] of Object.entries(raw)) {
    if (!Array.isArray(seconds)) {
      continue;
    }
    for (const secondToken of seconds) {
      const phrase = normalizePhrase(`${firstToken} ${secondToken}`);
      if (splitTokens(phrase).length === 2) {
        phrases.push(phrase);
      }
    }
  }
  return [...new Set(phrases)];
}

function loadPhraseFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return [];
  }
  return fs
    .readFileSync(filePath, "utf8")
    .split(/\r?\n/u)
    .map((line) => normalizePhrase(line))
    .filter(Boolean)
    .filter((phrase) => splitTokens(phrase).length === 2);
}

function appendUniquePhrase(filePath, phrase) {
  const normalized = normalizePhrase(phrase).replace(/!/gu, "").trim();
  if (splitTokens(normalized).length !== 2) {
    return false;
  }

  const current = new Set(loadPhraseFile(filePath));
  if (current.has(normalized)) {
    return false;
  }

  fs.appendFileSync(filePath, `${normalized}\n`, "utf8");
  return true;
}

function buildPhraseIndex(phrases) {
  const index = new Map();
  for (const phrase of phrases) {
    const firstToken = getFirstToken(phrase);
    if (!firstToken) {
      continue;
    }
    if (!index.has(firstToken)) {
      index.set(firstToken, []);
    }
    index.get(firstToken).push(phrase);
  }
  return index;
}

function normalizePhrase(input) {
  return (input || "")
    .toLowerCase()
    .normalize("NFC")
    .replace(/[^\p{L}\p{N}\s!]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function splitTokens(phrase) {
  return normalizePhrase(phrase)
    .replace(/!/gu, "")
    .split(" ")
    .filter(Boolean);
}

function getFirstToken(phrase) {
  return splitTokens(phrase)[0] || null;
}

function getLastToken(phrase) {
  const tokens = splitTokens(phrase);
  return tokens[tokens.length - 1] || null;
}

function isMeaningfulPhrase(phrase) {
  const normalized = normalizePhrase(phrase).replace(/!/gu, "").trim();
  return splitTokens(normalized).length === 2 && validPhraseSet.has(normalized) && !bannedPhraseSet.has(normalized);
}

async function ensureDictionaryPhrase(normalizedPhrase, meta = {}) {
  if (isMeaningfulPhrase(normalizedPhrase) || bannedPhraseSet.has(normalizedPhrase)) {
    return isMeaningfulPhrase(normalizedPhrase);
  }

  const dictionaryResult = await lookupVietnameseDictionary(normalizedPhrase);
  if (!dictionaryResult.accepted) {
    return false;
  }

  validPhraseSet.add(normalizedPhrase);
  customPhraseSet.add(normalizedPhrase);
  recordCandidatePhrase(normalizedPhrase, {
    guildId: meta.guildId,
    channelId: meta.channelId,
    username: meta.username,
    status: "accepted_from_dictionary",
    source: dictionaryResult.source,
    meaning: dictionaryResult.meanings?.[0]?.definition || null
  });
  return true;
}

function isTextCommand(raw) {
  return typeof raw === "string" && raw.trim().startsWith("!");
}

function getAvailableTextCommandMessage() {
  const commands = [
    ...[...TEXT_COMMAND_ALIASES.entries()].map(([command, description]) => `- \`${command}\`: ${description}`),
    "- `!tuduyet`: Admin xem danh sách từ đang chờ duyệt",
    "- `!duyettu <cụm>`: Admin duyệt cụm 2 tiếng vào bộ từ",
    "- `!tuchoi <cụm>`: Admin từ chối/cấm cụm không hợp lệ"
  ];
  return `Lệnh chưa đúng. Bạn có thể dùng:\n${commands.join("\n")}`;
}

function canManageWordChainText(message) {
  return canManageGameRoom({ user: message.author, member: message.member });
}

function parsePhraseAfterCommand(raw, command) {
  return normalizePhrase(raw.slice(command.length)).replace(/!/gu, "").trim();
}

function getWordReviewListText(limit = 10) {
  const items = listCandidatePhrases({ status: "pending", limit });
  if (items.length === 0) {
    return "Hiện chưa có từ nối pending cần duyệt.";
  }

  return [
    "Danh sách từ nối đang chờ duyệt:",
    ...items.map((item, index) => `${index + 1}. **${item.phrase}** - ${item.count || 1} lần, nguồn: ${item.source || "người chơi"}`)
  ].join("\n");
}

function approveWordChainPhrase(phrase, reviewer) {
  const normalized = normalizePhrase(phrase).replace(/!/gu, "").trim();
  if (splitTokens(normalized).length !== 2) {
    return "Chỉ duyệt cụm đúng 2 tiếng. Ví dụ: `!duyettu đồng lúa`.";
  }

  appendUniquePhrase(CUSTOM_PHRASE_DICTIONARY_PATH, normalized);
  validPhraseSet.add(normalized);
  customPhraseSet.add(normalized);
  const firstToken = getFirstToken(normalized);
  if (!phrasesByFirstToken.has(firstToken)) {
    phrasesByFirstToken.set(firstToken, []);
  }
  if (!phrasesByFirstToken.get(firstToken).includes(normalized)) {
    phrasesByFirstToken.get(firstToken).push(normalized);
  }
  updateCandidatePhrase(normalized, { status: "approved", reviewedBy: reviewer });
  return `Đã duyệt **${normalized}** vào bộ từ nối.`;
}

function rejectWordChainPhrase(phrase, reviewer) {
  const normalized = normalizePhrase(phrase).replace(/!/gu, "").trim();
  if (splitTokens(normalized).length !== 2) {
    return "Chỉ từ chối cụm đúng 2 tiếng. Ví dụ: `!tuchoi từ sai`.";
  }

  appendUniquePhrase(BANNED_PHRASE_DICTIONARY_PATH, normalized);
  bannedPhraseSet.add(normalized);
  validPhraseSet.delete(normalized);
  const firstToken = getFirstToken(normalized);
  if (phrasesByFirstToken.has(firstToken)) {
    phrasesByFirstToken.set(
      firstToken,
      phrasesByFirstToken.get(firstToken).filter((item) => item !== normalized)
    );
  }
  updateCandidatePhrase(normalized, { status: "rejected", reviewedBy: reviewer });
  return `Đã từ chối **${normalized}** và đưa vào danh sách cấm.`;
}

function handleAdminWordReviewCommand(message, raw, lowered) {
  if (ADMIN_PENDING_KEYWORDS.has(lowered)) {
    if (!canManageWordChainText(message)) {
      return { ok: false, silent: false, skipReaction: true, reply: "Bạn cần quyền quản trị game để xem danh sách duyệt từ." };
    }
    return { ok: true, silent: false, skipReaction: true, reply: getWordReviewListText(10) };
  }

  if (lowered.startsWith("!duyettu")) {
    if (!canManageWordChainText(message)) {
      return { ok: false, silent: false, skipReaction: true, reply: "Bạn cần quyền quản trị game để duyệt từ." };
    }
    return { ok: true, silent: false, skipReaction: true, reply: approveWordChainPhrase(parsePhraseAfterCommand(raw, "!duyettu"), message.author.id) };
  }

  if (lowered.startsWith("!tuchoi")) {
    if (!canManageWordChainText(message)) {
      return { ok: false, silent: false, skipReaction: true, reply: "Bạn cần quyền quản trị game để từ chối từ." };
    }
    return { ok: true, silent: false, skipReaction: true, reply: rejectWordChainPhrase(parsePhraseAfterCommand(raw, "!tuchoi"), message.author.id) };
  }

  return null;
}

function getGuildHistory(guildId) {
  if (!recentHistoryByGuild.has(guildId)) {
    recentHistoryByGuild.set(guildId, []);
  }
  return recentHistoryByGuild.get(guildId);
}

function pushRecentPhrase(guildId, phrase) {
  const history = getGuildHistory(guildId);
  history.unshift(phrase);
  if (history.length > MAX_RECENT_WORDS) {
    history.length = MAX_RECENT_WORDS;
  }
}

function findRecentUsage(guildId, phrase) {
  const history = getGuildHistory(guildId);
  const index = history.findIndex((entry) => entry === phrase);
  if (index === -1) {
    return null;
  }
  return { index, remainingTurns: MAX_RECENT_WORDS - index };
}

function getRecentReuseMessage(phrase, usage) {
  return `Cụm **${phrase}** đã được dùng trong ${MAX_RECENT_WORDS} lượt gần đây. Bạn có thể dùng lại sau **${usage.remainingTurns}** lượt nữa.`;
}

function buildScoreboard(scores) {
  return [...scores.entries()]
    .filter(([userId]) => userId !== BOT_PVE_USER_ID)
    .sort((a, b) => b[1] - a[1])
    .map(([userId, score]) => `<@${userId}>: ${score}`);
}

function getPhrasePreferenceScore(phrase) {
  if (bannedPhraseSet.has(phrase)) {
    return -1000;
  }
  if (preferredPhraseSet.has(phrase)) {
    return 100;
  }
  if (customPhraseSet.has(phrase)) {
    return 50;
  }
  if (referencePhraseSet.has(phrase)) {
    return 20;
  }
  return 0;
}

function countAvailableFollowups(token, session, phraseToExclude = null) {
  const normalizedToken = normalizePhrase(token).replace(/!/gu, "").trim();
  let count = 0;

  for (const phrase of phrasesByFirstToken.get(normalizedToken) || []) {
    if (session.roundUsed?.has(phrase)) {
      continue;
    }
    if (phraseToExclude && phrase === phraseToExclude) {
      continue;
    }
    if (session.guildId && findRecentUsage(session.guildId, phrase)) {
      continue;
    }
    count += 1;
  }
  return count;
}

function getCandidateRepliesForToken(token, session, excludedPhrases = []) {
  const normalizedToken = normalizePhrase(token).replace(/!/gu, "").trim();
  const excluded = new Set(excludedPhrases.map((phrase) => normalizePhrase(phrase)));

  return (phrasesByFirstToken.get(normalizedToken) || []).filter((phrase) => {
    if (excluded.has(phrase)) {
      return false;
    }
    if (session.roundUsed?.has(phrase)) {
      return false;
    }
    if (session.guildId && findRecentUsage(session.guildId, phrase)) {
      return false;
    }
    return true;
  });
}

function getPveDifficultyProfile(sessionOrMoveCount = 0) {
  const moveCount = typeof sessionOrMoveCount === "number" ? sessionOrMoveCount : sessionOrMoveCount?.moveCount || 0;
  if (moveCount < 6) {
    return {
      label: "easy",
      targetReplies: 14,
      minSafeReplies: 7,
      maxShortlist: 28,
      trapWeight: -45,
      pressureWeight: 18,
      counterWeight: 3
    };
  }
  if (moveCount < 16) {
    return {
      label: "normal",
      targetReplies: 9,
      minSafeReplies: 4,
      maxShortlist: 24,
      trapWeight: -10,
      pressureWeight: 4,
      counterWeight: 5
    };
  }
  return {
    label: "hard",
    targetReplies: 5,
    minSafeReplies: 1,
    maxShortlist: 18,
    trapWeight: 18,
    pressureWeight: -24,
    counterWeight: 8
  };
}

function evaluatePveSeedPhrase(phrase, guildId) {
  const requiredToken = getLastToken(phrase);
  const playerReplies = getCandidateRepliesForToken(requiredToken, { guildId, roundUsed: new Set([phrase]) }, [phrase]);
  const replyCount = playerReplies.length;
  const profile = getPveDifficultyProfile(0);
  const targetReplyCount = profile.targetReplies;
  const averageReplyPreference =
    replyCount > 0 ? playerReplies.reduce((sum, item) => sum + getPhrasePreferenceScore(item), 0) / replyCount : 0;
  const closenessScore = Math.max(0, 55 - Math.abs(replyCount - targetReplyCount) * 4);
  const difficultyScore = replyCount === 0 ? -150 : replyCount < profile.minSafeReplies ? -60 : replyCount <= 18 ? 45 : 20;
  const naturalnessScore = averageReplyPreference >= 50 ? 25 : averageReplyPreference >= 20 ? 12 : -30;
  return getPhrasePreferenceScore(phrase) + closenessScore + difficultyScore + naturalnessScore;
}

function pickSeedPhrase(guildId, excludedPhrases = [], mode = "pvp") {
  const excluded = new Set(excludedPhrases.map((phrase) => normalizePhrase(phrase)));
  const seedPool = [...new Set([...starterPhraseSet, ...preferredPhraseSet, ...customPhraseSet, ...FALLBACK_SEEDS.map((item) => normalizePhrase(item))])].filter(
    (phrase) => splitTokens(phrase).length === 2 && !excluded.has(phrase) && !findRecentUsage(guildId, phrase)
  );

  if (seedPool.length === 0) {
    const fallbackPool = [...new Set(FALLBACK_SEEDS.map((item) => normalizePhrase(item)))].filter((phrase) => !excluded.has(phrase));
    return fallbackPool[Math.floor(Math.random() * fallbackPool.length)] || normalizePhrase(FALLBACK_SEEDS[0]);
  }

  const scored = seedPool.map((phrase) => ({
    phrase,
    score:
      mode === "pve"
        ? evaluatePveSeedPhrase(phrase, guildId)
        : getPhrasePreferenceScore(phrase) + countAvailableFollowups(getLastToken(phrase), { guildId: "__seed__", roundUsed: new Set([phrase]) }, phrase)
  }));
  const bestScore = Math.max(...scored.map((item) => item.score));
  const candidateSeeds = scored.filter((item) => item.score >= bestScore - 10).map((item) => item.phrase);
  return candidateSeeds[Math.floor(Math.random() * candidateSeeds.length)];
}

function getRoomMode(channelId) {
  return getRoom(channelId)?.mode || "pvp";
}

function buildStatusEmbed(session, options = {}) {
  const modeLabel = session.mode === "pve" ? "PvE" : "PvP";
  const modeGuide =
    session.mode === "pve"
      ? `Farm tự do với bot. ${PVE_POINT_REWARD_XU} Xu mỗi điểm, thắng bot thêm ${PVE_WIN_BONUS_XU} Xu.`
      : `Đối kháng tự do nhiều người. ${PVP_POINT_REWARD_XU} Xu mỗi điểm nhưng giảm dần theo mốc, cứ ${PVP_CHECKPOINT_INTERVAL} lượt sẽ chốt thưởng giữa trận và người đứng đầu nhận thêm ${PVP_CHECKPOINT_LEADER_BONUS_XU} Xu.`;

  return new EmbedBuilder()
    .setColor(options.accent || 0x2ecc71)
    .setTitle(`Nối Từ ${modeLabel}`)
    .setDescription(
      [
        `**Từ hiện tại:** ${session.currentPhrase}`,
        `**Từ cần nối:** ${session.requiredToken}`,
        `**Chế độ:** ${session.mode === "pve" ? "Chơi với bot" : "Nhiều người cùng nối"}`
      ].join("\n")
    )
    .addFields(
      {
        name: "Hướng dẫn nhanh",
        value: `${modeGuide}\nLuật lặp: một cụm đã dùng phải chờ ${MAX_RECENT_WORDS} lượt mới được dùng lại.`,
        inline: false
      },
      { name: "Lượt gần nhất", value: options.lastMoveLine || "Chưa có lượt hợp lệ nào.", inline: false },
      { name: "Bảng điểm", value: buildScoreboard(session.scores).join("\n") || "Chưa có điểm.", inline: false }
    )
    .setFooter({ text: "Dùng !trangthai để xem bảng trạng thái, !stop để kết thúc ván, !rank để xem xếp hạng." });
}

async function sendOrRefreshStatusMessage(channel, session, options = {}) {
  const embed = buildStatusEmbed(session, options);
  const payload = { embeds: [embed] };
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

function clearSessionTimer() {}

function scheduleTurnTimeout() {
  return null;
}

function createBaseSession({ guildId, channelId, channelName, hostUserId, hostUsername, mode }) {
  return {
    guildId,
    channelId,
    channelName,
    hostUserId,
    hostUsername,
    mode,
    phase: "active",
    currentPhrase: null,
    requiredToken: null,
    createdAt: new Date().toISOString(),
    moveCount: 0,
    currentStreak: 0,
    scores: new Map(),
    usernames: new Map([[hostUserId, hostUsername]]),
    roundUsed: new Set(),
    statusMessageId: null,
    lobbyMessageId: null,
    lastMoverUserId: null,
    turnTimer: null,
    warningTimers: [],
    participants: [],
    turnOrder: [],
    currentTurnIndex: 0,
    lastRewardMoveCount: 0,
    rewardedScores: new Map()
  };
}

function cloneScoreMap(scores) {
  return new Map(scores ? [...scores.entries()] : []);
}

function getProgressivePointReward(score, baseReward) {
  let remaining = Math.max(0, Number(score) || 0);
  let reward = 0;
  const tiers = [
    { limit: 200, rate: 1 },
    { limit: 300, rate: 0.7 },
    { limit: 500, rate: 0.45 },
    { limit: 1000, rate: 0.25 },
    { limit: Number.POSITIVE_INFINITY, rate: 0.1 }
  ];

  for (const tier of tiers) {
    if (remaining <= 0) {
      break;
    }
    const used = Math.min(remaining, tier.limit);
    reward += Math.floor(used * baseReward * tier.rate);
    remaining -= used;
  }

  return reward;
}

function getRewardRanking(session, { deltaOnly = false } = {}) {
  const baseline = deltaOnly ? session.rewardedScores || new Map() : new Map();
  return [...session.scores.entries()]
    .filter(([userId]) => userId !== BOT_PVE_USER_ID)
    .map(([userId, score]) => {
      const baselineScore = baseline.get(userId) || 0;
      return [userId, deltaOnly ? Math.max(0, score - baselineScore) : score, score];
    })
    .filter(([, rewardScore]) => rewardScore > 0)
    .sort((a, b) => b[1] - a[1] || b[2] - a[2]);
}

async function rewardRankingSnapshot(session, {
  deltaOnly = false,
  leaderBonusXu = 0,
  leaderBonusXp = 0,
  type = "word_chain_final_reward",
  label = "kết ván"
} = {}) {
  const ranked = getRewardRanking(session, { deltaOnly });

  if (session.mode === "pvp" && ranked.length < MIN_PVP_REWARDED_PLAYERS) {
    return { rewarded: false, lines: [`PvP chỉ phát thưởng khi có ít nhất ${MIN_PVP_REWARDED_PLAYERS} người chơi có điểm hợp lệ.`] };
  }
  if (ranked.length === 0) {
    return { rewarded: false, lines: ["Ván này chưa có ai đạt điều kiện nhận thưởng."] };
  }

  const rewardLines = [];
  for (let index = 0; index < ranked.length; index += 1) {
    const [userId, rewardScore, totalScore] = ranked[index];
    const username = session.usernames.get(userId) || `user-${userId}`;
    const pointReward = getProgressivePointReward(
      rewardScore,
      session.mode === "pve" ? PVE_POINT_REWARD_XU : PVP_POINT_REWARD_XU
    );
    let totalReward = pointReward;
    let xpGain = rewardScore * WORD_CHAIN_POINT_XP;

    if (index === 0 && leaderBonusXu > 0) {
      totalReward += leaderBonusXu;
      xpGain += leaderBonusXp;
    }

    if (totalReward <= 0) {
      continue;
    }

    const updatedPlayer = await rewardPlayer(userId, username, totalReward, xpGain, type);
    const balance = updatedPlayer?.wallet?.xu ?? totalReward;
    updateWordChainRanking(userId, username, session.mode, {
      wins: index === 0 && label === "kết ván" ? 1 : 0,
      points: totalScore,
      games: label === "kết ván" ? 1 : 0
    });

    rewardLines.push(
      session.mode === "pve"
        ? `<@${userId}> có ${totalScore} điểm, phần thưởng ${label} là 🪙 ${pointReward} Xu${index === 0 && leaderBonusXu > 0 ? `, thưởng thắng bot +🪙 ${leaderBonusXu} Xu` : ""}. +${xpGain} XP. Tổng nhận: 🪙 ${totalReward} Xu. Số dư hiện tại: 🪙 ${balance} Xu.`
        : `<@${userId}> có ${totalScore} điểm, phần thưởng ${label} là 🪙 ${pointReward} Xu${index === 0 && leaderBonusXu > 0 ? `, thưởng đứng đầu +🪙 ${leaderBonusXu} Xu` : ""}. +${xpGain} XP. Tổng nhận: 🪙 ${totalReward} Xu. Số dư hiện tại: 🪙 ${balance} Xu.`
    );
  }

  if (deltaOnly) {
    session.rewardedScores = cloneScoreMap(session.scores);
    session.lastRewardMoveCount = session.moveCount;
  }

  return rewardLines.length > 0 ? { rewarded: true, lines: rewardLines } : { rewarded: false, lines: ["Không có mốc thưởng nào được kích hoạt."] };
}

async function maybeAwardPvpCheckpoint(channel, session) {
  if (session.mode !== "pvp") {
    return null;
  }
  if (session.moveCount - (session.lastRewardMoveCount || 0) < PVP_CHECKPOINT_INTERVAL) {
    return null;
  }

  const rewardResult = await rewardRankingSnapshot(session, {
    deltaOnly: true,
    leaderBonusXu: PVP_CHECKPOINT_LEADER_BONUS_XU,
    leaderBonusXp: Math.floor(WORD_CHAIN_WIN_BONUS_XP / 2),
    type: "word_chain_checkpoint_reward",
    label: `mốc ${session.moveCount} lượt`
  });

  if (!rewardResult?.rewarded) {
    session.lastRewardMoveCount = session.moveCount;
    session.rewardedScores = cloneScoreMap(session.scores);
    return rewardResult;
  }

  await channel
    .send(`🏁 Đã chốt thưởng giữa trận ở mốc **${session.moveCount} lượt**. ${rewardResult.lines.join(" ")}`)
    .catch(() => {});
  return rewardResult;
}

function startSession({ guildId, channelId, channelName, hostUserId, hostUsername, seedPhrase, mode }) {
  if (!isEnabledRoom(channelId)) {
    throw new Error("Phòng này chưa được cấu hình để chơi nối từ. Hãy dùng `/noitu-tao-phong` trước.");
  }

  const roomMode = mode || getRoomMode(channelId);
  const session = createBaseSession({ guildId, channelId, channelName, hostUserId, hostUsername, mode: roomMode });

  const seed = normalizePhrase(seedPhrase || pickSeedPhrase(guildId, [], roomMode)).replace(/!/gu, "").trim();
  if (!isMeaningfulPhrase(seed)) {
    throw new Error("Cụm mở đầu phải là một cụm 2 tiếng có nghĩa nằm trong bộ từ của game.");
  }
  const recentUsage = findRecentUsage(guildId, seed);
  if (recentUsage && seedPhrase) {
    throw new Error(getRecentReuseMessage(seed, recentUsage));
  }

  session.currentPhrase = seed;
  session.requiredToken = getLastToken(seed);
  session.roundUsed = new Set([seed]);
  if (roomMode === "pvp") {
    session.participants = [{ userId: hostUserId, username: hostUsername }];
    session.usernames.set(hostUserId, hostUsername);
  }
  pushRecentPhrase(guildId, seed);
  sessions.set(channelId, session);
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

function pauseSession(channelId) {
  return stopSession(channelId);
}

function resumeSession(channelId) {
  return sessions.get(channelId) || null;
}

function getSessionStatus(channelId) {
  const session = sessions.get(channelId);
  if (!session) {
    return null;
  }
  return { ...session, scoreboard: buildScoreboard(session.scores) };
}

function getRoomConfig(channelId) {
  return getRoom(channelId);
}

async function rewardPlayer(userId, username, xuGain, xpGain = 0, type = "word_chain_reward") {
  await ensurePlayer(userId, username);
  const player = await getPlayer(userId);
  const updatedPlayer = await updatePlayer(userId, {
    username,
    wallet: { ...player.wallet, xu: player.wallet.xu + xuGain },
    stats: addPlayerXp(
      { ...player.stats, totalXuEarned: player.stats.totalXuEarned + xuGain },
      xpGain
    )
  });
  appendTransaction({ userId, username, type, changes: { xu: xuGain, playerXp: xpGain } });
  return updatedPlayer;
}

function getHelpText(session) {
  const modeLine =
    session.mode === "pve"
      ? `PvE là chế độ farm. ${PVE_POINT_REWARD_XU} Xu mỗi điểm, thắng bot thêm ${PVE_WIN_BONUS_XU} Xu.`
      : `PvP là chế độ nhiều người cùng nối tự do. ${PVP_POINT_REWARD_XU} Xu mỗi điểm, người dẫn đầu nhận thêm ${PVP_WIN_BONUS_XU} Xu.`;
  return [
    session.currentPhrase ? `Từ hiện tại: ${session.currentPhrase}` : "Từ hiện tại: chưa bắt đầu",
    session.requiredToken ? `Từ cần nối: ${session.requiredToken}` : "Từ cần nối: chưa có",
    `Chế độ: ${session.mode === "pve" ? "PvE" : "PvP"}`,
    "Luật: chỉ nhận cụm 2 tiếng có nghĩa.",
    `Một cụm đã dùng phải chờ ${MAX_RECENT_WORDS} lượt mới được lặp lại, kể cả bot PvE.`,
    modeLine,
    "Không giới hạn thời gian trả lời.",
    "`!trangthai` để xem bảng trạng thái hiện tại.",
    "`!stop` để kết thúc ván hiện tại.",
    "`!rank` để xem bảng xếp hạng PvE.",
    "`!help` hoặc `!huongdan` để xem hướng dẫn nhanh."
  ].join("\n");
}

function buildRoomGuideText(mode = "pvp") {
  if (mode === "pvp") {
    return [
      "**Phòng nối từ PvP đã sẵn sàng.**",
      "Nhắn `!play` hoặc `!batdau` để mở ván mới ngay trong phòng này.",
      "Mọi người trong phòng có thể cùng tham gia bằng cách nối đúng.",
      "Không giới hạn thời gian, không có bước Join hay Start riêng.",
      `Mọi cụm đã dùng đều phải chờ ${MAX_RECENT_WORDS} lượt mới được lặp lại.`,
      "`!trangthai` để xem ván hiện tại.",
      "`!stop` để dừng trận.",
      "`!rank` để xem bảng xếp hạng PvE chung.",
      "`!help` hoặc `!huongdan` để xem hướng dẫn nhanh."
    ].join("\n");
  }

  return [
    "**Phòng nối từ PvE đã sẵn sàng.**",
    "Nhắn `!play` hoặc `!batdau` để vào ván với bot.",
    `Mỗi cụm đã dùng đều phải chờ ${MAX_RECENT_WORDS} lượt mới được lặp lại, kể cả câu của bot.`,
    `Mỗi điểm nhận ${PVE_POINT_REWARD_XU} Xu, thắng bot thêm ${PVE_WIN_BONUS_XU} Xu.`,
    "`!trangthai` để xem ván hiện tại.",
    "`!rank` để xem bảng xếp hạng PvE chung.",
    "`!stop` để dừng ván.",
    "`!help` hoặc `!huongdan` để xem hướng dẫn nhanh."
  ].join("\n");
}

async function validatePhrase(session, guildId, phrase, meta = {}) {
  const normalized = normalizePhrase(phrase).replace(/!/gu, "").trim();
  if (splitTokens(normalized).length !== 2) {
    return { ok: false, reason: "not_two_words", reply: "Chỉ nhận cụm 2 tiếng có nghĩa." };
  }
  const isKnownPhrase = await ensureDictionaryPhrase(normalized, {
    guildId,
    channelId: meta.channelId,
    username: meta.username
  });
  if (!isKnownPhrase) {
    return { ok: false, reason: "not_meaningful", reply: `Cụm **${normalized || phrase}** chưa có trong bộ từ của game.` };
  }
  if (getFirstToken(normalized) !== session.requiredToken) {
    return { ok: false, reason: "wrong_prefix", reply: `Hiện tại phải nối bằng từ **${session.requiredToken}**.` };
  }
  const recentUsage = findRecentUsage(guildId, normalized);
  if (recentUsage) {
    return { ok: false, reason: "used_recently", reply: getRecentReuseMessage(normalized, recentUsage) };
  }
  if (session.roundUsed.has(normalized)) {
    return { ok: false, reason: "used_in_round", reply: `Cụm **${normalized}** đã xuất hiện trong ván này rồi.` };
  }
  return { ok: true, normalized };
}

function trackUnknownPhrase(messageLike, phrase) {
  const normalized = normalizePhrase(phrase).replace(/!/gu, "").trim();
  if (splitTokens(normalized).length !== 2 || isMeaningfulPhrase(normalized)) {
    return;
  }

  recordCandidatePhrase(normalized, {
    guildId: messageLike.guildId,
    channelId: messageLike.channelId,
    username: messageLike.username,
    status: "pending"
  });
}

function listCandidateReplies(session) {
  return getCandidateRepliesForToken(session.requiredToken, session);
}

function buildHypotheticalSession(session, extraUsed = []) {
  return {
    guildId: session.guildId,
    roundUsed: new Set([...(session.roundUsed || new Set()), ...extraUsed])
  };
}

function evaluateBotReplyStrength(session, phrase) {
  const nextToken = getLastToken(phrase);
  const humanReplies = getCandidateRepliesForToken(nextToken, session, [phrase]).slice(0, 10);
  const profile = getPveDifficultyProfile(session);

  if (humanReplies.length === 0) {
    return profile.label === "hard" ? 100000 + getPhrasePreferenceScore(phrase) : -100000 + getPhrasePreferenceScore(phrase);
  }

  let totalBotCounters = 0;
  let minBotCounters = Number.POSITIVE_INFINITY;
  let trapReplies = 0;

  for (const humanReply of humanReplies) {
    const hypothetical = buildHypotheticalSession(session, [phrase, humanReply]);
    const botCounters = getCandidateRepliesForToken(getLastToken(humanReply), hypothetical, [phrase, humanReply]).slice(0, 12);
    const counterCount = botCounters.length;

    totalBotCounters += counterCount;
    minBotCounters = Math.min(minBotCounters, counterCount);

    if (counterCount > 0) {
      const hasTrapCounter = botCounters.some((counterPhrase) => {
        const counterSession = buildHypotheticalSession(session, [phrase, humanReply, counterPhrase]);
        const playerOptionsAfterCounter = getCandidateRepliesForToken(getLastToken(counterPhrase), counterSession, [
          phrase,
          humanReply,
          counterPhrase
        ]);
        return playerOptionsAfterCounter.length === 0;
      });

      if (hasTrapCounter) {
        trapReplies += 1;
      }
    }
  }

  const averageBotCounters = totalBotCounters / humanReplies.length;
  const replyCountScore = Math.max(0, 60 - Math.abs(humanReplies.length - profile.targetReplies) * 5);
  const safetyScore = humanReplies.length < profile.minSafeReplies ? -80 : 0;
  const pressureScore = humanReplies.length * profile.pressureWeight;
  const counterScore = averageBotCounters * profile.counterWeight + minBotCounters * Math.max(2, profile.counterWeight);
  const trapScore = trapReplies * profile.trapWeight;
  const preferenceScore = getPhrasePreferenceScore(phrase) * 4;

  return preferenceScore + replyCountScore + safetyScore + pressureScore + counterScore + trapScore;
}

function chooseBotReply(session) {
  const candidates = listCandidateReplies(session);
  if (candidates.length === 0) {
    return null;
  }

  const shortlisted = candidates
    .map((phrase) => ({
      phrase,
      replyCount: countAvailableFollowups(getLastToken(phrase), session, phrase),
      preference: getPhrasePreferenceScore(phrase)
    }))
    .sort((left, right) => {
      const profile = getPveDifficultyProfile(session);
      if (profile.label === "hard") {
        return left.replyCount - right.replyCount || right.preference - left.preference || left.phrase.localeCompare(right.phrase, "vi");
      }
      return right.replyCount - left.replyCount || right.preference - left.preference || left.phrase.localeCompare(right.phrase, "vi");
    })
    .slice(0, getPveDifficultyProfile(session).maxShortlist)
    .map((entry) => entry.phrase);

  const scored = shortlisted
    .map((phrase) => ({
      phrase,
      score: evaluateBotReplyStrength(session, phrase)
    }))
    .sort((left, right) => right.score - left.score || left.phrase.localeCompare(right.phrase, "vi"));

  const bestScore = scored[0]?.score ?? Number.NEGATIVE_INFINITY;
  const topBand = scored.filter((entry) => entry.score >= bestScore - 8).map((entry) => entry.phrase);
  return topBand[Math.floor(Math.random() * topBand.length)] || scored[0]?.phrase || null;
}

function findPlayablePhraseForToken(requiredToken, guildId, excludedPhrases = []) {
  const excluded = new Set(excludedPhrases.map((phrase) => normalizePhrase(phrase)));
  const normalizedToken = normalizePhrase(requiredToken).replace(/!/gu, "").trim();
  const candidates = (phrasesByFirstToken.get(normalizedToken) || []).filter((phrase) => {
    if (excluded.has(phrase)) {
      return false;
    }
    if (findRecentUsage(guildId, phrase)) {
      return false;
    }
    return true;
  });
  candidates.sort((a, b) => getPhrasePreferenceScore(b) - getPhrasePreferenceScore(a) || a.localeCompare(b, "vi"));
  return candidates[0] || null;
}

function findDeadEndPhraseForSession(session, token) {
  const normalizedToken = normalizePhrase(token).replace(/!/gu, "").trim();
  const candidates = (phrasesByFirstToken.get(normalizedToken) || []).filter((phrase) => {
    if (session.roundUsed.has(phrase)) {
      return false;
    }
    if (findRecentUsage(session.guildId, phrase)) {
      return false;
    }
    return true;
  });
  for (const phrase of candidates) {
    if (countAvailableFollowups(getLastToken(phrase), session, phrase) === 0) {
      return phrase;
    }
  }
  return null;
}

async function applyAcceptedPhrase({ session, channel, userId, username, phrase, actorLabel }) {
  session.currentPhrase = phrase;
  session.requiredToken = getLastToken(phrase);
  session.moveCount += 1;
  session.currentStreak += 1;
  session.roundUsed.add(phrase);
  session.scores.set(userId, (session.scores.get(userId) || 0) + 1);
  session.usernames.set(userId, username);
  session.lastMoverUserId = userId;
  if (session.mode === "pvp" && !session.participants.some((player) => player.userId === userId)) {
    session.participants.push({ userId, username });
  }
  pushRecentPhrase(session.guildId, phrase);
  await sendOrRefreshStatusMessage(channel, session, { accent: 0x2ecc71, lastMoveLine: `${actorLabel} trả lời đúng với **${phrase}**.` });
  await maybeAwardPvpCheckpoint(channel, session);
}

async function endSessionWithMessage(channel, session, reply) {
  clearSessionTimer(session);
  sessions.delete(session.channelId);
  await channel.send(reply).catch(() => {});
}

async function processPvpPhrase({ guildId, channel, userId, username, phrase }) {
  const session = sessions.get(channel.id);
  if (!session || session.phase !== "active") {
    return null;
  }

  const validation = await validatePhrase(session, guildId, phrase, { channelId: channel.id, username });
  if (!validation.ok) {
    if (validation.reason === "not_meaningful") {
      trackUnknownPhrase({ guildId, channelId: channel.id, username }, phrase);
    }
    return { ok: false, react: "failure", silent: false, reply: validation.reply };
  }

  await applyAcceptedPhrase({ session, channel, userId, username, phrase: validation.normalized, actorLabel: `<@${userId}>` });
  if (listCandidateReplies(session).length === 0) {
    const rewardResult = await distributeFinalRewards(session);
    await endSessionWithMessage(
      channel,
      session,
      `Không còn từ để nối tiếp. <@${userId}> kết thúc ván PvP ở vị trí dẫn đầu. ${rewardResult.lines.join(" ")} Gõ \`!play\` để mở ván mới.`
    );
    return { ok: true, react: "success", silent: false, reply: `Không còn từ để nối tiếp. <@${userId}> dẫn đầu ván PvP.` };
  }

  await sendOrRefreshStatusMessage(channel, session, {
    accent: 0x2ecc71,
    lastMoveLine: `<@${userId}> vừa nối đúng. Mọi người có thể tiếp tục trả lời từ **${session.requiredToken}**.`
  });
  return { ok: true, react: "success", silent: true };
}

async function processPvePhrase({ guildId, channel, userId, username, phrase }) {
  const session = sessions.get(channel.id);
  if (!session || session.phase !== "active") {
    return null;
  }
  const validation = await validatePhrase(session, guildId, phrase, { channelId: channel.id, username });
  if (!validation.ok) {
    if (validation.reason === "not_meaningful") {
      trackUnknownPhrase({ guildId, channelId: channel.id, username }, phrase);
    }
    return { ok: false, silent: validation.reason !== "used_recently", reply: validation.reply };
  }

  await applyAcceptedPhrase({ session, channel, userId, username, phrase: validation.normalized, actorLabel: `<@${userId}>` });
  const botReply = chooseBotReply(session);
  if (!botReply) {
    const rewardResult = await distributeFinalRewards(session);
    await endSessionWithMessage(
      channel,
      session,
      `<@${userId}> thắng ván PvE vì bot không tìm được từ để nối tiếp. ${rewardResult.lines.join(" ")} Gõ \`!play\` để mở ván mới.`
    );
    return { ok: true, react: "success", silent: false, reply: "Bot không tìm được từ để nối tiếp. Bạn thắng ván này." };
  }
  await applyAcceptedPhrase({ session, channel, userId: BOT_PVE_USER_ID, username: BOT_PVE_NAME, phrase: botReply, actorLabel: `**${BOT_PVE_NAME}**` });
  return { ok: true, react: "success", silent: false, reply: `${BOT_PVE_NAME} nối tiếp bằng **${botReply}**.` };
}

async function distributeFinalRewards(session) {
  if (!session) {
    return { rewarded: false, lines: ["Không có ván nào để phát thưởng."] };
  }
  return rewardRankingSnapshot(session, {
    deltaOnly: session.mode === "pvp",
    leaderBonusXu: session.mode === "pvp" ? PVP_WIN_BONUS_XU : PVE_WIN_BONUS_XU,
    leaderBonusXp: WORD_CHAIN_WIN_BONUS_XP,
    type: "word_chain_final_reward",
    label: "kết ván"
  });
}

async function handlePvpLobbyInteraction(interaction) {
  return false;
}

async function handleWordChainMessage(message) {
  if (!isEnabledRoom(message.channel.id)) {
    return null;
  }

  const raw = (message.content || "").trim();
  const lowered = raw.toLowerCase();
  let session = sessions.get(message.channel.id);
  const roomMode = getRoomMode(message.channel.id);
  const adminCommandResult = handleAdminWordReviewCommand(message, raw, lowered);
  if (adminCommandResult) {
    return adminCommandResult;
  }

  if (!session) {
    if (HELP_KEYWORDS.has(lowered)) {
      const fakeSession = { mode: roomMode, currentPhrase: null, requiredToken: null };
      return { ok: true, silent: false, skipReaction: true, reply: getHelpText(fakeSession) };
    }
    if (STATUS_KEYWORDS.has(lowered)) {
      return { ok: true, silent: false, skipReaction: true, reply: "Hiện chưa có ván Nối Từ nào đang chạy trong phòng này." };
    }
    if (RANK_KEYWORDS.has(lowered)) {
      return { ok: true, silent: false, skipReaction: true, reply: getRankingText("pve") };
    }
    if (STOP_KEYWORDS.has(lowered)) {
      return { ok: true, silent: false, skipReaction: true, reply: "Hiện chưa có ván nào đang chạy để dừng." };
    }
    if (isTextCommand(raw) && !START_KEYWORDS.has(lowered)) {
      return { ok: false, silent: false, skipReaction: true, reply: getAvailableTextCommandMessage() };
    }
    let canAutoStart = shouldAutoStart(raw);
    if (!canAutoStart && !isTextCommand(raw)) {
      canAutoStart = await ensureDictionaryPhrase(normalizePhrase(raw).replace(/!/gu, "").trim(), {
        guildId: message.guild.id,
        channelId: message.channel.id,
        username: message.author.username
      });
    }
    if (!canAutoStart) {
      return null;
    }

    const seedPhrase = isTextCommand(raw) ? null : raw;
    session = startSession({
      guildId: message.guild.id,
      channelId: message.channel.id,
      channelName: message.channel.name || "unknown",
      hostUserId: message.author.id,
      hostUsername: message.author.username,
      seedPhrase,
      mode: roomMode
    });

    await sendOrRefreshStatusMessage(message.channel, session, {
      accent: 0x3498db,
      lastMoveLine: `Ván mới đã được mở bởi <@${message.author.id}>.`
    });
    return {
      ok: true,
      silent: false,
      skipReaction: true,
      reply:
        session.mode === "pve"
          ? `Đã mở ván mới ở chế độ **PVE**. Từ hiện tại là **${session.currentPhrase}**.`
          : `Đã mở ván mới ở chế độ **PVP**. Từ hiện tại là **${session.currentPhrase}**. Mọi người có thể cùng nối tiếp ngay bây giờ.`
    };
  }

  if (HELP_KEYWORDS.has(lowered)) {
    return { ok: true, silent: false, skipReaction: true, reply: getHelpText(session) };
  }
  if (STATUS_KEYWORDS.has(lowered)) {
    await sendOrRefreshStatusMessage(message.channel, session, "Đây là bảng trạng thái hiện tại của ván.");
    return { ok: true, silent: false, skipReaction: true, reply: "Đã cập nhật bảng trạng thái ván Nối Từ." };
  }
  if (RANK_KEYWORDS.has(lowered)) {
    return { ok: true, silent: false, skipReaction: true, reply: getRankingText("pve") };
  }

  if (STOP_KEYWORDS.has(lowered)) {
    const stoppedSession = stopSession(message.channel.id);
    const rewardResult = await distributeFinalRewards(stoppedSession);
    const topLine = buildScoreboard(stoppedSession.scores)[0] || "Chưa có ai ghi điểm.";
    return { ok: true, silent: false, skipReaction: true, reply: `Đã kết thúc ván nối từ. Dẫn đầu: ${topLine}. ${rewardResult.lines.join(" ")}` };
  }

  if (START_KEYWORDS.has(lowered)) {
    return { ok: true, silent: false, skipReaction: true, reply: "Ván hiện tại đang chạy rồi. Hãy chơi tiếp hoặc dùng `!stop` để kết thúc ván này." };
  }
  if (isTextCommand(raw)) {
    return { ok: false, silent: false, skipReaction: true, reply: getAvailableTextCommandMessage() };
  }

  return session.mode === "pve"
    ? processPvePhrase({ guildId: message.guild.id, channel: message.channel, userId: message.author.id, username: message.author.username, phrase: raw })
    : processPvpPhrase({ guildId: message.guild.id, channel: message.channel, userId: message.author.id, username: message.author.username, phrase: raw });
}

function shouldAutoStart(raw) {
  const trimmed = (raw || "").trim();
  if (!trimmed) {
    return false;
  }
  if (isTextCommand(trimmed)) {
    return START_KEYWORDS.has(trimmed.toLowerCase());
  }
  return isMeaningfulPhrase(trimmed);
}

function getRankingText(mode = "pve") {
  const ranking = getWordChainRanking(mode, 10);
  if (ranking.length === 0) {
    return `Bảng xếp hạng ${mode.toUpperCase()} hiện chưa có dữ liệu.`;
  }

  return [
    `Bảng xếp hạng ${mode.toUpperCase()}:`,
    ...ranking.map(
      (entry, index) =>
        `${index + 1}. <@${entry.userId}> - Thắng: ${entry[mode].wins}, Điểm: ${entry[mode].points}, Ván: ${entry[mode].games}`
    )
  ].join("\n");
}

module.exports = {
  startSession,
  stopSession,
  pauseSession,
  resumeSession,
  getSessionStatus,
  getRoomConfig,
  getHelpText,
  handleWordChainMessage,
  handlePvpLobbyInteraction,
  normalizePhrase,
  distributeFinalRewards,
  isMeaningfulPhrase,
  sendOrRefreshStatusMessage,
  buildStatusEmbed,
  scheduleTurnTimeout,
  buildRoomGuideText,
  getRoomMode,
  chooseBotReply,
  findPlayablePhraseForToken,
  countAvailableFollowups,
  findDeadEndPhraseForSession,
  maybeAwardPvpCheckpoint
};
