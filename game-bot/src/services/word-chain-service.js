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

const seedPhrases = [
  "giang ho",
  "mat troi",
  "mua thu",
  "bong dem",
  "thien ha",
  "hong nhan"
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
    throw new Error("Phong nay chua duoc cau hinh de choi noi tu. Hay dung /noitu-tao-phong truoc.");
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
    `Cum hien tai: "${session.currentPhrase}"`,
    `Tu can noi tiep: "${session.requiredToken}"`,
    "Go cum tu truc tiep trong phong de choi.",
    "Dung !stop de tam dung, !play de tiep tuc, /noitu-dung de ket thuc van.",
    "Thuong Xu chi duoc phat khi ket thuc van, khong cong Xu cho tung cau dung."
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
      reply: "Van noi tu dang tam dung. Go !play de tiep tuc."
    };
  }

  const normalized = normalizePhrase(phrase);
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
      reply: `Cum nay chua hop le. Tu dau tien phai bat dau bang "${session.requiredToken}".`
    };
  }

  if (session.roundUsed.has(normalized)) {
    return {
      ok: false,
      reply: "Cum tu nay da duoc dung trong van hien tai."
    };
  }

  const recentUsage = findRecentUsage(guildId, normalized);
  if (recentUsage) {
    return {
      ok: false,
      reply: `Tu nay da duoc su dung trong ${MAX_RECENT_WORDS} luot gan day. Ban co the dung lai sau ${recentUsage.remainingTurns} luot nua.`
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
      `Hop le. <@${userId}> hien co ${nextScore} diem trong van nay.`,
      `Tu tiep theo phai bat dau bang "${nextRequired}".`
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
        "Van nay chua du nguoi ghi diem de phat thuong.",
        `Can it nhat ${MIN_VALID_PLAYERS_FOR_REWARD} nguoi co diem hop le moi mo thuong cuoi van.`
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
      detail.push(`tham gia nang: +${PARTICIPATION_REWARD_XU} Xu`);
    }

    if (totalReward <= 0) {
      continue;
    }

    await rewardPlayer(userId, username, totalReward, "word_chain_final_reward");
    rewardLines.push(`<@${userId}> nhan ${totalReward} Xu (${detail.join(", ")}).`);
  }

  if (rewardLines.length === 0) {
    return {
      rewarded: false,
      lines: ["Van nay khong co moc thuong nao duoc kich hoat."]
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
      reply: "Da tam dung van noi tu trong phong nay. Go !play de choi tiep."
    };
  }

  if (lowered === "!play") {
    const resumed = resumeSession(message.channel.id);
    return {
      ok: true,
      reply: `Da tiep tuc van noi tu.\n${getHelpText(resumed)}`
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
  distributeFinalRewards
};
