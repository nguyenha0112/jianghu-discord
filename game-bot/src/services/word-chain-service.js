const { appendTransaction } = require("../storage/transaction-store");
const { ensurePlayer, getPlayer, updatePlayer } = require("../storage/player-store");

const sessions = new Map();
const recentHistoryByGuild = new Map();
const MAX_RECENT_WORDS = 50;
const TURN_REWARD_XU = 10;

const seedPhrases = [
  "gio mua",
  "bong dem",
  "mat troi",
  "mua thu",
  "thien ha",
  "giang ho"
];

function normalizePhrase(input) {
  return input
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

function getSession(channelId) {
  return sessions.get(channelId) || null;
}

function buildScoreboard(scores) {
  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([userId, score]) => `${userId}: ${score}`);
}

function pickSeedPhrase() {
  return seedPhrases[Math.floor(Math.random() * seedPhrases.length)];
}

function startSession({ guildId, channelId, channelName, hostUserId, hostUsername, seedPhrase }) {
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

async function handleWordChainMessage(message) {
  const session = sessions.get(message.channel.id);
  if (!session || !session.active) {
    return null;
  }

  const normalized = normalizePhrase(message.content);
  const tokens = splitTokens(normalized);

  if (tokens.length < 2) {
    return {
      ok: false,
      reply: "Cum tu can it nhat 2 tieng de choi noi tu."
    };
  }

  const firstToken = getFirstToken(normalized);
  if (firstToken !== session.requiredToken) {
    return {
      ok: false,
      reply: `Tu dau tien phai bat dau bang "${session.requiredToken}".`
    };
  }

  if (session.roundUsed.has(normalized)) {
    return {
      ok: false,
      reply: "Cum tu nay da duoc dung trong van hien tai."
    };
  }

  const recentUsage = findRecentUsage(session.guildId, normalized);
  if (recentUsage) {
    return {
      ok: false,
      reply: `Tu nay da duoc su dung trong ${MAX_RECENT_WORDS} luot gan day. Ban co the dung lai sau ${recentUsage.remainingTurns} luot nua.`
    };
  }

  const nextRequired = getLastToken(normalized);
  session.currentPhrase = normalized;
  session.requiredToken = nextRequired;
  session.moveCount += 1;
  session.roundUsed.add(normalized);
  session.scores.set(message.author.id, (session.scores.get(message.author.id) || 0) + 1);
  pushRecentPhrase(session.guildId, normalized);

  await rewardPlayer(message.author.id, message.author.username, TURN_REWARD_XU);

  return {
    ok: true,
    reply: `Hop le. +${TURN_REWARD_XU} Xu. Tu tiep theo phai bat dau bang "${nextRequired}".`,
    session
  };
}

module.exports = {
  startSession,
  stopSession,
  getSessionStatus,
  handleWordChainMessage,
  normalizePhrase
};
