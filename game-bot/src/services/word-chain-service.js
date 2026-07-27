const fs = require("node:fs");
const path = require("node:path");
const { appendTransaction } = require("../storage/transaction-store");
const { ensurePlayer, getPlayer, updatePlayer } = require("../storage/player-store");
const { getRoom, isEnabledRoom } = require("../storage/word-chain-room-store");

const sessions = new Map();
const recentHistoryByGuild = new Map();

const MAX_RECENT_WORDS = 50;
const MIN_VALID_PLAYERS_FOR_REWARD = 2;
const MIN_SCORE_FOR_PARTICIPATION_REWARD = 3;
const PARTICIPATION_REWARD_XU = 10;
const FINAL_RANK_REWARDS = [80, 40, 20];
const PHRASE_DICTIONARY_PATH = path.join(
  __dirname,
  "..",
  "..",
  "data",
  "vietnamese-compound-phrases.txt"
);
const CUSTOM_PHRASE_DICTIONARY_PATH = path.join(
  __dirname,
  "..",
  "..",
  "data",
  "custom-vietnamese-phrases.txt"
);

const seedPhrases = ["mặt trời", "mưa thu", "bóng đêm", "thiên hạ", "hồng nhan", "giang hồ"];

const validPhraseSet = loadValidPhraseSet();

function loadValidPhraseSet() {
  try {
    const phrases = [
      ...loadPhraseFile(PHRASE_DICTIONARY_PATH),
      ...loadPhraseFile(CUSTOM_PHRASE_DICTIONARY_PATH)
    ];

    return new Set(phrases);
  } catch (error) {
    console.error("Không thể tải từ điển nối từ:", error.message);
    return new Set(seedPhrases.map((phrase) => normalizePhrase(phrase)));
  }
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
    .filter((phrase) => {
      const tokens = phrase.split(" ").filter(Boolean);
      if (tokens.length < 2 || tokens.length > 5) {
        return false;
      }

      const singleCharacterTokens = tokens.filter((token) => token.length === 1).length;
      return singleCharacterTokens < tokens.length;
    });
}

function normalizePhrase(input) {
  return (input || "")
    .toLowerCase()
    .normalize("NFC")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function splitTokens(phrase) {
  return normalizePhrase(phrase).split(" ").filter(Boolean);
}

function getLastToken(phrase) {
  const tokens = splitTokens(phrase);
  return tokens[tokens.length - 1] || null;
}

function getFirstToken(phrase) {
  const tokens = splitTokens(phrase);
  return tokens[0] || null;
}

function isMeaningfulPhrase(phrase) {
  const normalized = normalizePhrase(phrase);
  if (!normalized) {
    return false;
  }

  const tokens = splitTokens(normalized);
  if (tokens.length < 2 || tokens.length > 5) {
    return false;
  }

  const singleCharacterTokens = tokens.filter((token) => token.length === 1).length;
  if (singleCharacterTokens >= tokens.length) {
    return false;
  }

  return validPhraseSet.has(normalized);
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

  return {
    index,
    remainingTurns: MAX_RECENT_WORDS - index
  };
}

function buildScoreboard(scores) {
  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([userId, score]) => `<@${userId}>: ${score}`);
}

function pickSeedPhrase() {
  return seedPhrases[Math.floor(Math.random() * seedPhrases.length)];
}

function getSession(channelId) {
  return sessions.get(channelId) || null;
}

function startSession({ guildId, channelId, channelName, hostUserId, hostUsername, seedPhrase }) {
  if (!isEnabledRoom(channelId)) {
    throw new Error("Phòng này chưa được cấu hình để chơi nối từ. Hãy dùng `/noitu-tao-phong` trước.");
  }

  const seed = normalizePhrase(seedPhrase || pickSeedPhrase());
  if (!isMeaningfulPhrase(seed)) {
    throw new Error("Cụm mở đầu không nằm trong từ điển nối từ hiện tại. Hãy dùng một cụm tiếng Việt có nghĩa.");
  }

  const lastToken = getLastToken(seed);

  const session = {
    guildId,
    channelId,
    channelName,
    hostUserId,
    hostUsername,
    seedPhrase: seed,
    currentPhrase: seed,
    requiredToken: lastToken,
    active: true,
    paused: false,
    createdAt: new Date().toISOString(),
    moveCount: 0,
    scores: new Map(),
    usernames: new Map([[hostUserId, hostUsername]]),
    roundUsed: new Set([seed])
  };

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

function pauseSession(channelId) {
  const session = sessions.get(channelId);
  if (!session) {
    return null;
  }

  session.paused = true;
  return session;
}

function resumeSession(channelId) {
  const session = sessions.get(channelId);
  if (!session) {
    return null;
  }

  session.paused = false;
  return session;
}

function getSessionStatus(channelId) {
  const session = sessions.get(channelId);
  if (!session) {
    return null;
  }

  return {
    ...session,
    scoreboard: buildScoreboard(session.scores)
  };
}

function getRoomConfig(channelId) {
  return getRoom(channelId);
}

async function rewardPlayer(userId, username, xuGain, type = "word_chain_reward") {
  await ensurePlayer(userId, username);
  const player = await getPlayer(userId);
  const nextStats = {
    ...player.stats,
    totalXuEarned: player.stats.totalXuEarned + xuGain
  };

  await updatePlayer(userId, {
    username,
    wallet: {
      ...player.wallet,
      xu: player.wallet.xu + xuGain
    },
    stats: nextStats
  });

  appendTransaction({
    userId,
    username,
    type,
    changes: {
      xu: xuGain
    }
  });
}

function getHelpText(session) {
  return [
    `Cụm hiện tại: "${session.currentPhrase}"`,
    `Từ cần nối tiếp: "${session.requiredToken}"`,
    "Gõ cụm từ trực tiếp trong phòng để chơi.",
    "Chỉ chấp nhận cụm tiếng Việt có nghĩa nằm trong từ điển nối từ hiện tại.",
    "Dùng `!stop` để tạm dừng, `!play` để tiếp tục, `/noitu-dung` để kết thúc ván.",
    "Thưởng Xu chỉ được phát khi kết thúc ván, không cộng Xu cho từng câu đúng."
  ].join("\n");
}

async function processPhrase({ guildId, channelId, userId, username, phrase }) {
  const session = sessions.get(channelId);
  if (!session || !session.active) {
    return null;
  }

  if (session.paused) {
    return {
      ok: false,
      reply: "Ván nối từ đang tạm dừng. Gõ `!play` để tiếp tục."
    };
  }

  const normalized = normalizePhrase(phrase);
  const tokens = splitTokens(normalized);

  if (tokens.length < 2) {
    return {
      ok: false,
      reply: "Cụm từ cần ít nhất 2 tiếng để chơi nối từ."
    };
  }

  if (!isMeaningfulPhrase(normalized)) {
    return {
      ok: false,
      reply: "Cụm này không có trong từ điển nối từ hiện tại hoặc chưa đủ nghĩa. Hãy dùng một cụm tiếng Việt tự nhiên hơn."
    };
  }

  const firstToken = getFirstToken(normalized);
  if (firstToken !== session.requiredToken) {
    return {
      ok: false,
      reply: `Cụm này chưa hợp lệ. Từ đầu tiên phải bắt đầu bằng "${session.requiredToken}".`
    };
  }

  if (session.roundUsed.has(normalized)) {
    return {
      ok: false,
      reply: "Cụm từ này đã được dùng trong ván hiện tại."
    };
  }

  const recentUsage = findRecentUsage(guildId, normalized);
  if (recentUsage) {
    return {
      ok: false,
      reply: `Từ này đã được sử dụng trong ${MAX_RECENT_WORDS} lượt gần đây. Bạn có thể dùng lại sau ${recentUsage.remainingTurns} lượt nữa.`
    };
  }

  const nextRequired = getLastToken(normalized);
  const nextScore = (session.scores.get(userId) || 0) + 1;

  session.currentPhrase = normalized;
  session.requiredToken = nextRequired;
  session.moveCount += 1;
  session.roundUsed.add(normalized);
  session.scores.set(userId, nextScore);
  session.usernames.set(userId, username);
  pushRecentPhrase(session.guildId, normalized);

  return {
    ok: true,
    reply: [
      `Hợp lệ. <@${userId}> hiện có ${nextScore} điểm trong ván này.`,
      `Từ tiếp theo phải bắt đầu bằng "${nextRequired}".`
    ].join("\n"),
    session
  };
}

async function distributeFinalRewards(session) {
  const ranked = [...session.scores.entries()].sort((a, b) => b[1] - a[1]);

  if (ranked.length < MIN_VALID_PLAYERS_FOR_REWARD) {
    return {
      rewarded: false,
      lines: [
        "Ván này chưa đủ người ghi điểm để phát thưởng.",
        `Cần ít nhất ${MIN_VALID_PLAYERS_FOR_REWARD} người có điểm hợp lệ mới mở thưởng cuối ván.`
      ]
    };
  }

  const rewardLines = [];

  for (let index = 0; index < ranked.length; index += 1) {
    const [userId, score] = ranked[index];
    const username = session.usernames.get(userId) || `user-${userId}`;
    let totalReward = 0;
    const detail = [];

    if (index < FINAL_RANK_REWARDS.length) {
      const rankReward = FINAL_RANK_REWARDS[index];
      totalReward += rankReward;
      detail.push(`top ${index + 1}: +${rankReward} Xu`);
    }

    if (score >= MIN_SCORE_FOR_PARTICIPATION_REWARD) {
      totalReward += PARTICIPATION_REWARD_XU;
      detail.push(`tham gia tốt: +${PARTICIPATION_REWARD_XU} Xu`);
    }

    if (totalReward <= 0) {
      continue;
    }

    await rewardPlayer(userId, username, totalReward, "word_chain_final_reward");
    rewardLines.push(`<@${userId}> nhận ${totalReward} Xu (${detail.join(", ")}).`);
  }

  if (rewardLines.length === 0) {
    return {
      rewarded: false,
      lines: ["Ván này không có mốc thưởng nào được kích hoạt."]
    };
  }

  return {
    rewarded: true,
    lines: rewardLines
  };
}

async function handleWordChainMessage(message) {
  if (!isEnabledRoom(message.channel.id)) {
    return null;
  }

  const session = sessions.get(message.channel.id);
  if (!session || !session.active) {
    return null;
  }

  const raw = (message.content || "").trim();
  const lowered = raw.toLowerCase();

  if (lowered === "!stop") {
    pauseSession(message.channel.id);
    return {
      ok: true,
      reply: "Đã tạm dừng ván nối từ trong phòng này. Gõ `!play` để chơi tiếp."
    };
  }

  if (lowered === "!play") {
    const resumed = resumeSession(message.channel.id);
    return {
      ok: true,
      reply: `Đã tiếp tục ván nối từ.\n${getHelpText(resumed)}`
    };
  }

  return processPhrase({
    guildId: message.guild.id,
    channelId: message.channel.id,
    userId: message.author.id,
    username: message.author.username,
    phrase: raw
  });
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
  normalizePhrase,
  distributeFinalRewards,
  isMeaningfulPhrase
};
