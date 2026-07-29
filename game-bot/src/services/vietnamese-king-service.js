const fs = require("node:fs");
const path = require("node:path");
const { EmbedBuilder } = require("discord.js");
const { lookupVietnameseDictionary } = require("../lib/vietnamese-dictionary");
const { applyPlayerXp } = require("../lib/player-progression");
const { formatLevelUpText } = require("../lib/ui-theme");
const { appendTransaction } = require("../storage/transaction-store");
const { ensurePlayer, getPlayer, updatePlayer } = require("../storage/player-store");
const { getRoom, isEnabledRoom } = require("../storage/vietnamese-king-room-store");
const { getVietnameseKingRanking, updateVietnameseKingRanking } = require("../storage/vietnamese-king-ranking-store");

const DATA_PATH = path.join(__dirname, "..", "..", "data", "vietnamese-king-puzzles.json");
const CUSTOM_PHRASES_PATH = path.join(__dirname, "..", "..", "data", "custom-vietnamese-phrases.txt");
const BONUS_PHRASES_PATH = path.join(__dirname, "..", "..", "data", "vietnamese-king-bonus-phrases.txt");
const BONUS_PUZZLES_PATH = path.join(__dirname, "..", "..", "data", "vietnamese-king-bonus-puzzles.json");
const sessions = new Map();
const recentPuzzleIdsByGuild = new Map();

const START_KEYWORDS = new Set(["!play", "!batdau"]);
const STOP_KEYWORDS = new Set(["!stop"]);
const HELP_KEYWORDS = new Set(["!help", "!huongdan"]);
const HINT_KEYWORDS = new Set(["!goiy", "!hint"]);
const RANK_KEYWORDS = new Set(["!rank", "!bxh", "!xephang"]);
const STATUS_KEYWORDS = new Set(["!trangthai", "!status"]);

const POINT_REWARD_XU = 8;
const WIN_BONUS_XU = 20;
const POINT_REWARD_XP = 5;
const WIN_BONUS_XP = 15;
const MAX_RECENT_PUZZLES = 120;
const MAX_GLOBAL_RECENT_PUZZLES = 360;
const HINT_POINT_PENALTY = 1;

function inferDifficultyFromAnswer(answer) {
  const normalized = normalizeText(answer);
  const tokens = normalized.split(" ").filter(Boolean);
  const charCount = [...normalized.replace(/\s+/gu, "")].length;

  if (tokens.length >= 4 || charCount >= 14) {
    return "hard";
  }
  if (tokens.length >= 3 || charCount >= 10) {
    return "medium";
  }
  return "easy";
}

function isAcceptableGeneratedPhrase(answer) {
  const normalized = normalizeText(answer);
  if (!normalized) {
    return false;
  }

  if (normalized.length < 4 || normalized.length > 24) {
    return false;
  }

  if (!/^[\p{L}\p{N}\s]+$/u.test(normalized)) {
    return false;
  }

  const tokens = normalized.split(" ").filter(Boolean);
  if (tokens.length < 2 || tokens.length > 4) {
    return false;
  }

  if (tokens.some((token) => token.length < 2 || token.length > 8)) {
    return false;
  }

  if (tokens.every((token) => token.length <= 2)) {
    return false;
  }

  const bannedFragments = ["a di", "a priori", "a posteriori", "mrơn", "rooi", "nguỵ", "pa tít", "đào khản"];
  if (bannedFragments.some((fragment) => normalized.includes(fragment))) {
    return false;
  }

  return true;
}

function buildGeneratedPuzzle(answer, index, sourceLabel) {
  const normalized = normalizeText(answer);
  const difficulty = inferDifficultyFromAnswer(normalized);
  const tokenCount = getAnswerTokenCount(normalized);
  const charCount = getAnswerCharacterCount(normalized);

  return {
    id: `generated-${sourceLabel}-${index}`,
    answer: normalized,
    type: "word",
    difficulty,
    hint: `Cụm từ tiếng Việt gồm ${tokenCount} tiếng, khoảng ${charCount} ký tự.`,
    meaning: "Cụm từ được sinh từ kho dữ liệu tiếng Việt để mở rộng ngân hàng câu hỏi."
  };
}

function loadGeneratedPhrasePuzzles(filePath, sourceLabel) {
  if (!fs.existsSync(filePath)) {
    return [];
  }

  return fs
    .readFileSync(filePath, "utf8")
    .split(/\r?\n/gu)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith("#"))
    .filter(isAcceptableGeneratedPhrase)
    .map((line, index) => buildGeneratedPuzzle(line, index + 1, sourceLabel));
}

function dedupePuzzles(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = normalizeText(item.answer || "");
    if (!key || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function loadCuratedPuzzles(filePath) {
  if (!fs.existsSync(filePath)) {
    return [];
  }

  try {
    const raw = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return Array.isArray(raw.puzzles) ? raw.puzzles : [];
  } catch {
    return [];
  }
}

function loadPuzzleBank() {
  const curated = [
    ...loadCuratedPuzzles(DATA_PATH),
    ...loadCuratedPuzzles(BONUS_PUZZLES_PATH)
  ];
  const generated = [
    ...loadGeneratedPhrasePuzzles(CUSTOM_PHRASES_PATH, "custom"),
    ...loadGeneratedPhrasePuzzles(BONUS_PHRASES_PATH, "bonus")
  ];
  return dedupePuzzles([...curated, ...generated]);
}

const puzzleBank = loadPuzzleBank();

function normalizeText(input) {
  return (input || "")
    .toLowerCase()
    .normalize("NFC")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function shuffleCharacters(token) {
  const chars = [...token];
  if (chars.length <= 1) {
    return token;
  }
  let shuffled = [...chars];
  let safe = 0;
  while (shuffled.join("") === chars.join("") && safe < 10) {
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
    }
    safe += 1;
  }
  return shuffled.join("");
}

function getPuzzlePattern(answer) {
  return normalizeText(answer)
    .split(" ")
    .filter(Boolean)
    .map((token) => "_ ".repeat(token.length).trim())
    .join("   ");
}

function scrambleAnswer(answer) {
  const normalized = normalizeText(answer).replace(/\s+/gu, "");
  return shuffleCharacters(normalized);
}

function getScrambledDisplay(answer) {
  return [...normalizeText(answer).replace(/\s+/gu, "")].join("/");
}

function getAnswerCharacterCount(answer) {
  return [...normalizeText(answer).replace(/\s+/gu, "")].length;
}

function getAnswerTokenCount(answer) {
  return normalizeText(answer).split(" ").filter(Boolean).length;
}

function formatInlineCode(text) {
  return `\`${String(text || "").replace(/`/gu, "'")}\``;
}

function buildPuzzlePrompt(session) {
  return [
    "🎮 Vua Tiếng Việt",
    `Từ cần đoán: ${formatInlineCode(session.scrambledText)} (gồm **${getAnswerCharacterCount(session.currentPuzzle.answer)}** ký tự).`,
    `Mẫu đáp án: ${formatInlineCode(session.patternText)}`
  ].join("\n");
}

function getPuzzleTypeLabel(type) {
  if (type === "proverb") {
    return "Tục ngữ / thành ngữ";
  }
  if (type === "ca_dao") {
    return "Ca dao";
  }
  return "Cụm từ";
}

function createSession({ guildId, channelId, channelName, hostUserId, hostUsername }) {
  return {
    guildId,
    channelId,
    channelName,
    hostUserId,
    hostUsername,
    currentPuzzle: null,
    scrambledText: null,
    patternText: null,
    hintLevel: 0,
    scores: new Map(),
    usernames: new Map([[hostUserId, hostUsername]]),
    moveCount: 0,
    statusMessageId: null,
    usedPuzzleIds: []
  };
}

function getGuildRecentPuzzleIds(guildId) {
  if (!recentPuzzleIdsByGuild.has(guildId)) {
    recentPuzzleIdsByGuild.set(guildId, []);
  }
  return recentPuzzleIdsByGuild.get(guildId);
}

function rememberGuildPuzzle(guildId, puzzleId) {
  const history = getGuildRecentPuzzleIds(guildId);
  history.push(puzzleId);
  if (history.length > MAX_GLOBAL_RECENT_PUZZLES) {
    recentPuzzleIdsByGuild.set(guildId, history.slice(-MAX_GLOBAL_RECENT_PUZZLES));
  }
}

function getPuzzlePriorityScore(puzzle) {
  const normalizedAnswer = normalizeText(puzzle.answer || "");
  const tokens = normalizedAnswer.split(" ").filter(Boolean);
  const charCount = [...normalizedAnswer.replace(/\s+/gu, "")].length;

  let score = 0;
  if (puzzle.type === "word") {
    score += 80;
  } else if (puzzle.type === "proverb") {
    score += 50;
  } else if (puzzle.type === "ca_dao") {
    score += 20;
  }

  if (puzzle.difficulty === "hard") {
    score += 35;
  } else if (puzzle.difficulty === "medium") {
    score += 25;
  } else if (puzzle.difficulty === "easy") {
    score += 10;
  }

  if (tokens.length <= 2) {
    score += 40;
  } else if (tokens.length <= 4) {
    score += 20;
  } else if (tokens.length >= 6) {
    score -= 35;
  }

  if (charCount <= 8) {
    score += 30;
  } else if (charCount <= 12) {
    score += 15;
  } else if (charCount > 18) {
    score -= 40;
  }

  return score;
}

function getTargetDifficulty(session) {
  const moveCount = session.moveCount || 0;
  if (moveCount >= 4 && moveCount % 4 === 0) {
    return "hard";
  }
  if (moveCount >= 2) {
    return "medium";
  }
  return "easy";
}

function pickPuzzle(session) {
  const recentSet = new Set(session.usedPuzzleIds.slice(-MAX_RECENT_PUZZLES));
  const guildRecentSet = new Set(getGuildRecentPuzzleIds(session.guildId));
  const available = puzzleBank.filter((item) => !recentSet.has(item.id) && !guildRecentSet.has(item.id));
  const pool = available.length > 0 ? available : puzzleBank;
  if (pool.length === 0) {
    return null;
  }

  const targetDifficulty = getTargetDifficulty(session);
  const difficultyPool = pool.filter((item) => item.difficulty === targetDifficulty);
  const effectivePool = difficultyPool.length >= 20 ? difficultyPool : pool;
  const scored = effectivePool
    .map((item) => ({ item, score: getPuzzlePriorityScore(item) }))
    .sort((left, right) => right.score - left.score);

  const topScore = scored[0]?.score ?? 0;
  const candidatePool = scored
    .filter((entry) => entry.score >= topScore - 60)
    .map((entry) => entry.item);

  return candidatePool[Math.floor(Math.random() * candidatePool.length)];
}

function setNextPuzzle(session) {
  const puzzle = pickPuzzle(session);
  if (!puzzle) {
    return null;
  }
  session.currentPuzzle = puzzle;
  session.scrambledText = getScrambledDisplay(scrambleAnswer(puzzle.answer));
  session.patternText = getPuzzlePattern(puzzle.answer);
  session.hintLevel = puzzle.type === "word" ? 0 : 1;
  session.usedPuzzleIds.push(puzzle.id);
  if (session.usedPuzzleIds.length > 200) {
    session.usedPuzzleIds = session.usedPuzzleIds.slice(-200);
  }
  rememberGuildPuzzle(session.guildId, puzzle.id);
  return puzzle;
}

async function resolvePuzzleMetadata(puzzle) {
  if (!puzzle || puzzle.type !== "word") {
    return puzzle;
  }
  if (puzzle.meaning && puzzle.hint) {
    return puzzle;
  }
  const dictionaryResult = await lookupVietnameseDictionary(puzzle.answer);
  if (!dictionaryResult?.accepted || !dictionaryResult.meanings?.length) {
    return puzzle;
  }
  const firstMeaning = dictionaryResult.meanings[0];
  return {
    ...puzzle,
    hint: puzzle.hint || `Từ loại: ${firstMeaning.pos || "Chưa rõ"}`,
    meaning: puzzle.meaning || firstMeaning.definition
  };
}

function buildHint(session) {
  const puzzle = session.currentPuzzle;
  if (!puzzle) {
    return "Chưa có câu đố nào.";
  }

  const tokens = normalizeText(puzzle.answer).split(" ").filter(Boolean);
  if (session.hintLevel === 1) {
    const difficultyLabel = puzzle.difficulty === "hard" ? "Khó" : puzzle.difficulty === "medium" ? "Vừa" : "Dễ";
    return `Gợi ý 1: Đây là dạng **${getPuzzleTypeLabel(puzzle.type)}**, gồm **${tokens.length} tiếng**, độ khó **${difficultyLabel}**.`;
  }
  if (session.hintLevel >= 2) {
    const firstChar = normalizeText(puzzle.answer).replace(/\s+/gu, "")[0] || "?";
    return `Gợi ý 2: ${puzzle.hint}\nGợi ý 3: ${puzzle.meaning}\nGợi ý 4: Ký tự đầu tiên là **${firstChar}**.`;
  }
  return "Chưa mở gợi ý.";
}

function buildScoreboard(scores) {
  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([userId, score]) => `<@${userId}>: ${score} điểm`);
}

function buildStatusEmbed(session, note = "Chờ người chơi đoán đáp án.") {
  const puzzle = session.currentPuzzle;
  return new EmbedBuilder()
    .setColor(0xf1c40f)
    .setTitle("Vua Tiếng Việt")
    .setDescription(
      [
        `**Chữ bị xáo:** ${formatInlineCode(session.scrambledText || "Chưa có")}`,
        `**Số ký tự:** ${session.currentPuzzle ? getAnswerCharacterCount(session.currentPuzzle.answer) : 0}`,
        `**Mẫu đáp án:** ${formatInlineCode(session.patternText || "Chưa có")}`,
        `**Loại câu:** ${puzzle ? getPuzzleTypeLabel(puzzle.type) : "Chưa có"}`,
        `**Số lượt đúng:** ${session.moveCount}`
      ].join("\n")
    )
    .addFields(
      { name: "Gợi ý hiện tại", value: buildHint(session), inline: false },
      { name: "Bảng điểm", value: buildScoreboard(session.scores).join("\n") || "Chưa có điểm.", inline: false },
      { name: "Ghi chú", value: note, inline: false }
    )
    .setFooter({ text: "Dùng !trangthai để xem bảng trạng thái, !goiy để mở gợi ý, !stop để kết thúc." });
}

async function sendOrRefreshStatusMessage(channel, session, note) {
  const payload = { embeds: [buildStatusEmbed(session, note)] };
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

function startSession({ guildId, channelId, channelName, hostUserId, hostUsername }) {
  if (!isEnabledRoom(channelId)) {
    throw new Error("Phòng này chưa được bật cho Vua Tiếng Việt. Hãy dùng `/vuatiengviet-tao-phong` trước.");
  }
  const session = createSession({ guildId, channelId, channelName, hostUserId, hostUsername });
  const puzzle = setNextPuzzle(session);
  if (!puzzle) {
    throw new Error("Hiện chưa có dữ liệu câu đố cho Vua Tiếng Việt.");
  }
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
  return session ? { ...session, scoreboard: buildScoreboard(session.scores) } : null;
}

function getRoomConfig(channelId) {
  return getRoom(channelId);
}

function getHelpText(session = null) {
  return [
    session?.scrambledText ? `Chữ bị xáo: ${formatInlineCode(session.scrambledText)}` : "Chữ bị xáo: chưa có",
    session?.currentPuzzle ? `Gồm: ${getAnswerCharacterCount(session.currentPuzzle.answer)} ký tự` : "Gồm: chưa có",
    session?.patternText ? `Mẫu đáp án: ${formatInlineCode(session.patternText)}` : "Mẫu đáp án: chưa có",
    "Luật: bot đưa ra một cụm từ, thành ngữ, tục ngữ hoặc ca dao ngắn với toàn bộ ký tự bị xáo lẫn.",
    "Các dấu `_` cho bạn biết số ký tự của từng tiếng để suy luận lại đáp án.",
    `Mỗi câu đúng nhận ${POINT_REWARD_XU} Xu. Người dẫn đầu cuối ván nhận thêm ${WIN_BONUS_XU} Xu.`,
    "`!trangthai` để xem bảng trạng thái hiện tại.",
    `\`!goiy\` để mở gợi ý, mỗi lần dùng bị trừ ${HINT_POINT_PENALTY} điểm của người gọi.`,
    "`!stop` để kết thúc ván.",
    "`!rank` để xem bảng xếp hạng.",
    "`!help` hoặc `!huongdan` để xem hướng dẫn."
  ].join("\n");
}

function buildRoomGuideText() {
  return [
    "**Phòng Vua Tiếng Việt đã sẵn sàng.**",
    "Nhắn `!play` hoặc `!batdau` để mở ván mới.",
    "Bot sẽ xáo toàn bộ ký tự của đáp án và hiển thị mẫu `_` để bạn đoán lại.",
    "Người chơi ghép lại cụm từ hoặc câu dân gian đúng có nghĩa để ghi điểm.",
    "`!trangthai` để xem bảng trạng thái hiện tại.",
    `\`!goiy\` để mở thêm gợi ý, nhưng người gọi sẽ bị trừ ${HINT_POINT_PENALTY} điểm.`,
    "`!rank` để xem bảng xếp hạng.",
    "`!stop` để kết thúc ván hiện tại."
  ].join("\n");
}

async function rewardPlayer(userId, username, xuGain, xpGain = 0, type = "vietnamese_king_reward") {
  await ensurePlayer(userId, username);
  const player = await getPlayer(userId);
  const safeWallet = player?.wallet || { xu: 0, ngoc: 0 };
  const safeStats = player?.stats || {
    playerLevel: 1,
    playerXp: 0,
    totalXuEarned: 0,
    totalNgocEarned: 0,
    totalWorkActions: 0,
    totalItemsSold: 0
  };
  const xpResult = applyPlayerXp({ ...safeStats, totalXuEarned: safeStats.totalXuEarned + xuGain }, xpGain);
  const updatedPlayer = await updatePlayer(userId, {
    username,
    wallet: { ...safeWallet, xu: safeWallet.xu + xuGain },
    stats: xpResult.stats
  });
  appendTransaction({ userId, username, type, changes: { xu: xuGain, playerXp: xpGain } });
  return { player: updatedPlayer, levelInfo: xpResult.levelInfo };
}

async function distributeFinalRewards(session) {
  if (!session) {
    return { rewarded: false, lines: ["Không có ván nào để phát thưởng."] };
  }
  const ranked = [...session.scores.entries()].filter(([, score]) => score > 0).sort((a, b) => b[1] - a[1]);
  if (ranked.length === 0) {
    return { rewarded: false, lines: ["Ván này chưa có ai ghi điểm."] };
  }

  const rewardLines = [];
  for (let index = 0; index < ranked.length; index += 1) {
    const [userId, score] = ranked[index];
    const username = session.usernames.get(userId) || `user-${userId}`;
    let totalReward = score * POINT_REWARD_XU;
    let xpGain = score * POINT_REWARD_XP;
    if (index === 0) {
      totalReward += WIN_BONUS_XU;
      xpGain += WIN_BONUS_XP;
    }
    const rewardResult = await rewardPlayer(userId, username, totalReward, xpGain, "vietnamese_king_final_reward");
    updateVietnameseKingRanking(userId, username, { wins: index === 0 ? 1 : 0, points: score, games: 1 });
    const levelUpText = formatLevelUpText(rewardResult.levelInfo);
    rewardLines.push(
      `<@${userId}> có ${score} điểm, nhận 🪙 ${score * POINT_REWARD_XU} Xu${index === 0 ? `, thưởng đứng đầu +🪙 ${WIN_BONUS_XU} Xu` : ""}. +${xpGain} XP. Tổng thưởng: 🪙 ${totalReward} Xu. Số dư hiện tại: 🪙 ${rewardResult.player.wallet.xu} Xu.${levelUpText ? ` ${levelUpText}` : ""}`
    );
  }
  return { rewarded: true, lines: rewardLines };
}

function getRankingText() {
  const ranking = getVietnameseKingRanking(10);
  if (ranking.length === 0) {
    return "Bảng xếp hạng Vua Tiếng Việt hiện chưa có dữ liệu.";
  }
  return [
    "Bảng xếp hạng Vua Tiếng Việt:",
    ...ranking.map((entry, index) => `${index + 1}. <@${entry.userId}> - Thắng: ${entry.wins}, Điểm: ${entry.points}, Ván: ${entry.games}`)
  ].join("\n");
}

function isTextCommand(raw) {
  return typeof raw === "string" && raw.trim().startsWith("!");
}

function getAvailableTextCommandMessage() {
  return [
    "Lệnh chưa đúng. Bạn có thể dùng:",
    "- `!play`: Mở ván mới",
    "- `!trangthai`: Xem bảng trạng thái",
    "- `!goiy`: Xem gợi ý",
    "- `!rank`: Xem bảng xếp hạng",
    "- `!stop`: Kết thúc ván",
    "- `!help`: Xem hướng dẫn"
  ].join("\n");
}

async function advancePuzzle(channel, session, note) {
  const nextPuzzle = setNextPuzzle(session);
  if (!nextPuzzle) {
    return false;
  }
  session.currentPuzzle = await resolvePuzzleMetadata(session.currentPuzzle);
  return true;
}

async function handleMessage(message) {
  if (!isEnabledRoom(message.channel.id)) {
    return null;
  }

  const raw = (message.content || "").trim();
  const lowered = raw.toLowerCase();
  let session = sessions.get(message.channel.id);

  if (!session) {
    if (HELP_KEYWORDS.has(lowered)) {
      return { ok: true, skipReaction: true, reply: getHelpText() };
    }
    if (STATUS_KEYWORDS.has(lowered)) {
      return { ok: true, skipReaction: true, reply: "Hiện chưa có ván Vua Tiếng Việt nào đang chạy trong phòng này." };
    }
    if (RANK_KEYWORDS.has(lowered)) {
      return { ok: true, skipReaction: true, reply: getRankingText() };
    }
    if (STOP_KEYWORDS.has(lowered)) {
      return { ok: true, skipReaction: true, reply: "Hiện chưa có ván Vua Tiếng Việt nào đang chạy để dừng." };
    }
    if (!START_KEYWORDS.has(lowered)) {
      if (isTextCommand(raw)) {
        return { ok: false, skipReaction: true, reply: getAvailableTextCommandMessage() };
      }
      return null;
    }

    session = startSession({
      guildId: message.guild.id,
      channelId: message.channel.id,
      channelName: message.channel.name || "unknown",
      hostUserId: message.author.id,
      hostUsername: message.author.username
    });
    session.currentPuzzle = await resolvePuzzleMetadata(session.currentPuzzle);

    return {
      ok: true,
      skipReaction: true,
      reply: buildPuzzlePrompt(session)
    };
  }

  if (HELP_KEYWORDS.has(lowered)) {
    return { ok: true, skipReaction: true, reply: getHelpText(session) };
  }
  if (RANK_KEYWORDS.has(lowered)) {
    return { ok: true, skipReaction: true, reply: getRankingText() };
  }
  if (STATUS_KEYWORDS.has(lowered)) {
    await sendOrRefreshStatusMessage(message.channel, session, "Đây là bảng trạng thái hiện tại của ván.");
    return { ok: true, skipReaction: true, reply: "Đã cập nhật bảng trạng thái Vua Tiếng Việt." };
  }
  if (HINT_KEYWORDS.has(lowered)) {
    session.hintLevel = Math.min(session.hintLevel + 1, 2);
    const currentScore = session.scores.get(message.author.id) || 0;
    const nextScore = Math.max(0, currentScore - HINT_POINT_PENALTY);
    session.scores.set(message.author.id, nextScore);
    session.usernames.set(message.author.id, message.author.username);
    return {
      ok: true,
      skipReaction: true,
      reply: `${buildHint(session)}\n<@${message.author.id}> bị trừ **${HINT_POINT_PENALTY} điểm** vì dùng gợi ý. Điểm hiện tại: **${nextScore}**.`
    };
  }
  if (STOP_KEYWORDS.has(lowered)) {
    const stoppedSession = stopSession(message.channel.id);
    const rewardResult = await distributeFinalRewards(stoppedSession);
    const topLine = buildScoreboard(stoppedSession.scores)[0] || "Chưa có ai ghi điểm.";
    return { ok: true, skipReaction: true, reply: `Đã kết thúc ván Vua Tiếng Việt. Dẫn đầu: ${topLine}. ${rewardResult.lines.join(" ")}` };
  }
  if (START_KEYWORDS.has(lowered)) {
    return { ok: true, skipReaction: true, reply: "Ván hiện tại đang chạy rồi. Hãy đoán tiếp hoặc dùng `!stop` để kết thúc ván này." };
  }
  if (isTextCommand(raw)) {
    return { ok: false, skipReaction: true, reply: getAvailableTextCommandMessage() };
  }

  const normalizedGuess = normalizeText(raw);
  const normalizedAnswer = normalizeText(session.currentPuzzle.answer);
  if (normalizedGuess !== normalizedAnswer) {
    return { ok: false, react: "failure", silent: true };
  }

  const userId = message.author.id;
  const username = message.author.username;
  session.usernames.set(userId, username);
  session.scores.set(userId, (session.scores.get(userId) || 0) + 1);
  session.moveCount += 1;

  const previousAnswer = session.currentPuzzle.answer;
  const nextReady = await advancePuzzle(message.channel, session, `<@${userId}> đã đoán đúng **${previousAnswer}**. Câu mới đã sẵn sàng.`);

  if (!nextReady) {
    const rewardResult = await distributeFinalRewards(session);
    stopSession(message.channel.id);
    return { ok: true, react: "success", reply: `Bạn đã đoán đúng **${previousAnswer}**. Đã hết dữ liệu câu đố. ${rewardResult.lines.join(" ")}` };
  }

  return {
    ok: true,
    react: "success",
    reply: `Chuẩn rồi. Đáp án là **${previousAnswer}**. <@${userId}> hiện có **${session.scores.get(userId)} điểm**, tạm quy đổi **🪙 ${session.scores.get(userId) * POINT_REWARD_XU} Xu** nếu chốt ván lúc này.\n${buildPuzzlePrompt(session)}`
  };
}

module.exports = {
  handleMessage,
  startSession,
  stopSession,
  getSessionStatus,
  getRoomConfig,
  getHelpText,
  buildRoomGuideText,
  buildStatusEmbed,
  distributeFinalRewards
};
