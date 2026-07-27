const { appendTransaction } = require("../storage/transaction-store");
const { ensurePlayer, getPlayer, updatePlayer } = require("../storage/player-store");
const { getRoom, isEnabledRoom } = require("../storage/word-chain-room-store");

const sessions = new Map();
const recentHistoryByGuild = new Map();
const MAX_RECENT_WORDS = 50;
const TURN_REWARD_XU = 10;

const seedPhrases = [
  "giang hồ",
  "mặt trời",
  "mưa thu",
  "bóng đêm",
  "thiên hạ",
  "hồng nhan"
];

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

async function rewardPlayer(userId, username, xuGain) {
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
    type: "word_chain_reward",
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
    "Dùng `!stop` để tạm dừng, `!play` để tiếp tục, `/noitu-dừng` để kết thúc ván."
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
  session.currentPhrase = normalized;
  session.requiredToken = nextRequired;
  session.moveCount += 1;
  session.roundUsed.add(normalized);
  session.scores.set(userId, (session.scores.get(userId) || 0) + 1);
  pushRecentPhrase(session.guildId, normalized);

  await rewardPlayer(userId, username, TURN_REWARD_XU);

  return {
    ok: true,
    reply: [
      `Hợp lệ. +${TURN_REWARD_XU} Xu cho <@${userId}>.`,
      `Từ tiếp theo phải bắt đầu bằng "${nextRequired}".`
    ].join("\n"),
    session
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
  normalizePhrase
};
