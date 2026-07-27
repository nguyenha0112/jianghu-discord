const fs = require("node:fs");
const path = require("node:path");
const { EmbedBuilder } = require("discord.js");
const { appendTransaction } = require("../storage/transaction-store");
const { ensurePlayer, getPlayer, updatePlayer } = require("../storage/player-store");
const { getRoom, isEnabledRoom } = require("../storage/word-chain-room-store");

const sessions = new Map();
const recentHistoryByGuild = new Map();

const MAX_RECENT_WORDS = 50;
const TURN_TIMEOUT_MS = 30_000;
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

const seedPhrases = ["yêu thương", "bầu trời", "hy vọng", "bình yên", "quê nhà", "hoa hồng", "gia đình", "niềm vui"];
const START_KEYWORDS = new Set(["!batdau", "!choi", "!play", "bat dau", "bắt đầu", "chơi thôi"]);

const validPhraseSet = loadValidPhraseSet();

function loadValidPhraseSet() {
  try {
    const phrases = [...loadPhraseFile(PHRASE_DICTIONARY_PATH), ...loadPhraseFile(CUSTOM_PHRASE_DICTIONARY_PATH)];
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
    .filter((phrase) => splitTokens(phrase).length === 2);
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

  return splitTokens(normalized).length === 2 && validPhraseSet.has(normalized);
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

function shouldAutoStart(raw) {
  const normalized = normalizePhrase(raw);
  if (!normalized) {
    return false;
  }

  return START_KEYWORDS.has(normalized) || isMeaningfulPhrase(normalized);
}

function getSecondsLeft(session) {
  const msLeft = Math.max(0, session.turnDeadlineAt - Date.now());
  return Math.ceil(msLeft / 1000);
}

function clearSessionTimer(session) {
  if (session.turnTimer) {
    clearTimeout(session.turnTimer);
    session.turnTimer = null;
  }
}

function buildStatusEmbed(session, options = {}) {
  const scoreboard = buildScoreboard(session.scores);
  const lastMoveLine = options.lastMoveLine || "Chưa có lượt hợp lệ nào.";
  const title = options.title || "Nối Từ PvP";
  const accent = options.accent || 0x2ecc71;
  const timerText = session.paused ? "Đang dừng" : `${getSecondsLeft(session)} giây`;

  return new EmbedBuilder()
    .setColor(accent)
    .setTitle(title)
    .setDescription(
      [
        `**Từ hiện tại:** ${session.currentPhrase}`,
        `**Từ cần nối:** ${session.requiredToken}`,
        `**Trạng thái:** ${session.paused ? "Tạm dừng" : "Đang chơi"}`,
        `**Thời gian còn lại:** ${timerText}`
      ].join("\n")
    )
    .addFields(
      {
        name: "Hướng dẫn nhanh",
        value: "Người chơi nhập **cụm 2 tiếng có nghĩa**. Dùng `!stop` để tạm dừng, `!play` để tiếp tục.",
        inline: false
      },
      {
        name: "Lượt gần nhất",
        value: lastMoveLine,
        inline: false
      },
      {
        name: "Bảng điểm",
        value: scoreboard.length > 0 ? scoreboard.join("\n") : "Chưa có điểm.",
        inline: false
      }
    )
    .setFooter({
      text: "Sai chỉ bị đánh dấu reaction. Hết 30 giây mà không ai nối được thì ván sẽ tự dừng."
    });
}

async function sendOrRefreshStatusMessage(channel, session, options = {}) {
  const embed = buildStatusEmbed(session, options);

  if (!session.statusMessageId) {
    const sentMessage = await channel.send({ embeds: [embed] });
    session.statusMessageId = sentMessage.id;
    return sentMessage;
  }

  try {
    const message = await channel.messages.fetch(session.statusMessageId);
    await message.edit({ embeds: [embed] });
    return message;
  } catch (error) {
    const sentMessage = await channel.send({ embeds: [embed] });
    session.statusMessageId = sentMessage.id;
    return sentMessage;
  }
}

function scheduleTurnTimeout(session, channel) {
  clearSessionTimer(session);
  session.turnDeadlineAt = Date.now() + TURN_TIMEOUT_MS;

  session.turnTimer = setTimeout(async () => {
    const activeSession = sessions.get(session.channelId);
    if (!activeSession || activeSession.paused) {
      return;
    }

    activeSession.paused = true;
    await sendOrRefreshStatusMessage(channel, activeSession, {
      title: "Nối Từ PvP",
      accent: 0xe74c3c,
      lastMoveLine: "Đã hết 30 giây mà chưa có câu trả lời hợp lệ. Ván đã tự tạm dừng, gõ `!play` để tiếp tục."
    }).catch(() => {});
  }, TURN_TIMEOUT_MS);
}

function startSession({ guildId, channelId, channelName, hostUserId, hostUsername, seedPhrase }) {
  if (!isEnabledRoom(channelId)) {
    throw new Error("Phòng này chưa được cấu hình để chơi nối từ. Hãy dùng `/noitu-tao-phong` trước.");
  }

  const seed = normalizePhrase(seedPhrase || pickSeedPhrase());
  if (!isMeaningfulPhrase(seed)) {
    throw new Error("Cụm mở đầu phải là một cụm 2 tiếng có nghĩa trong từ điển nối từ.");
  }

  const session = {
    guildId,
    channelId,
    channelName,
    hostUserId,
    hostUsername,
    seedPhrase: seed,
    currentPhrase: seed,
    requiredToken: getLastToken(seed),
    active: true,
    paused: false,
    createdAt: new Date().toISOString(),
    moveCount: 0,
    scores: new Map(),
    usernames: new Map([[hostUserId, hostUsername]]),
    roundUsed: new Set([seed]),
    statusMessageId: null,
    currentStreak: 0,
    turnDeadlineAt: Date.now() + TURN_TIMEOUT_MS,
    turnTimer: null
  };

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
  const session = sessions.get(channelId);
  if (!session) {
    return null;
  }

  session.paused = true;
  clearSessionTimer(session);
  return session;
}

function resumeSession(channelId) {
  const session = sessions.get(channelId);
  if (!session) {
    return null;
  }

  session.paused = false;
  session.turnDeadlineAt = Date.now() + TURN_TIMEOUT_MS;
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
    `Từ hiện tại: ${session.currentPhrase}`,
    `Từ cần nối: ${session.requiredToken}`,
    "Luật: chỉ nhận cụm 2 tiếng có nghĩa.",
    "Mỗi lượt có 30 giây để trả lời.",
    "Khi phòng chưa có ván, chỉ cần nhắn `!batdau` hoặc gửi ngay một cụm 2 tiếng để bot tự mở ván."
  ].join("\n");
}

function buildRoomGuideText() {
  return [
    "**Phòng nối từ đã sẵn sàng.**",
    "`!batdau` hoặc gửi luôn một cụm 2 tiếng có nghĩa để mở ván.",
    "Khi ván đang chạy: chỉ cần nhắn cụm 2 tiếng để chơi.",
    "`!stop` để tạm dừng, `!play` để chơi tiếp.",
    "Sai bot chỉ đánh dấu `❌`, đúng bot đánh dấu `✅` và cập nhật khung trạng thái."
  ].join("\n");
}

async function processPhrase({ guildId, channel, userId, username, phrase }) {
  const session = sessions.get(channel.id);
  if (!session || !session.active) {
    return null;
  }

  if (session.paused) {
    return { ok: false, silent: true };
  }

  const normalized = normalizePhrase(phrase);
  const tokens = splitTokens(normalized);

  if (tokens.length !== 2) {
    return { ok: false, silent: true };
  }

  if (!isMeaningfulPhrase(normalized)) {
    return { ok: false, silent: true };
  }

  if (getFirstToken(normalized) !== session.requiredToken) {
    return { ok: false, silent: true };
  }

  if (session.roundUsed.has(normalized)) {
    return { ok: false, silent: true };
  }

  if (findRecentUsage(guildId, normalized)) {
    return { ok: false, silent: true };
  }

  const nextRequired = getLastToken(normalized);
  const nextScore = (session.scores.get(userId) || 0) + 1;

  session.currentPhrase = normalized;
  session.requiredToken = nextRequired;
  session.moveCount += 1;
  session.currentStreak += 1;
  session.roundUsed.add(normalized);
  session.scores.set(userId, nextScore);
  session.usernames.set(userId, username);
  pushRecentPhrase(session.guildId, normalized);

  scheduleTurnTimeout(session, channel);
  await sendOrRefreshStatusMessage(channel, session, {
    title: "Nối Từ PvP",
    accent: 0x2ecc71,
    lastMoveLine: `<@${userId}> trả lời đúng với **${normalized}**. Chuỗi hiện tại: **${session.currentStreak}**`
  });

  return {
    ok: true,
    silent: true,
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

  const raw = (message.content || "").trim();
  const lowered = raw.toLowerCase();
  let session = sessions.get(message.channel.id);

  if (!session || !session.active) {
    if (!shouldAutoStart(raw)) {
      return null;
    }

    const seedPhrase = START_KEYWORDS.has(normalizePhrase(raw)) ? null : raw;
    session = startSession({
      guildId: message.guild.id,
      channelId: message.channel.id,
      channelName: message.channel.name || "unknown",
      hostUserId: message.author.id,
      hostUsername: message.author.username,
      seedPhrase
    });

    scheduleTurnTimeout(session, message.channel);
    await sendOrRefreshStatusMessage(message.channel, session, {
      title: "Nối Từ PvP",
      accent: 0x3498db,
      lastMoveLine: `Ván mới đã được mở bởi <@${message.author.id}>.`
    });

    return {
      ok: true,
      silent: true
    };
  }

  if (lowered === "!stop") {
    const pausedSession = pauseSession(message.channel.id);
    await sendOrRefreshStatusMessage(message.channel, pausedSession, {
      title: "Nối Từ PvP",
      accent: 0xf39c12,
      lastMoveLine: `Ván chơi đã được tạm dừng bởi <@${message.author.id}>.`
    });
    return {
      ok: true,
      silent: true
    };
  }

  if (lowered === "!play") {
    const resumed = resumeSession(message.channel.id);
    scheduleTurnTimeout(resumed, message.channel);
    await sendOrRefreshStatusMessage(message.channel, resumed, {
      title: "Nối Từ PvP",
      accent: 0x3498db,
      lastMoveLine: `Ván chơi đã tiếp tục bởi <@${message.author.id}>.`
    });
    return {
      ok: true,
      silent: true
    };
  }

  return processPhrase({
    guildId: message.guild.id,
    channel: message.channel,
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
  isMeaningfulPhrase,
  sendOrRefreshStatusMessage,
  buildStatusEmbed,
  scheduleTurnTimeout,
  buildRoomGuideText
};
