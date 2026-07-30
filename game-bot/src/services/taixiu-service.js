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
const {
  buildBetButtonConfig,
  formatXu: formatXuDisplay,
  getBetKindLabel: getBetKindLabelDisplay
} = require("../lib/taixiu-ui");
const { appendTransaction } = require("../storage/transaction-store");
const { ensurePlayer, getPlayer, updatePlayer } = require("../storage/player-store");
const { getRoom, isEnabledRoom } = require("../storage/taixiu-room-store");

const sessions = new Map();
const modalLocks = new Map();

const START_KEYWORDS = new Set(["!play", "!batdau"]);
const STOP_KEYWORDS = new Set(["!stop"]);
const HELP_KEYWORDS = new Set(["!help", "!huongdan"]);
const STATUS_KEYWORDS = new Set(["!trangthai", "!status"]);
const CLOSE_KEYWORDS = new Set(["!chot", "!lac"]);

const MIN_BET = 20;
const MAX_BET = 250000;
const BETTING_DURATION_MS = 45000;
const BET_XP_GAIN = 1;
const WIN_XP_GAIN = 4;
const MODAL_LOCK_MS = 3000;

const BET_BUTTON_PREFIX = "taixiu:bet:";
const BET_MODAL_PREFIX = "taixiu:modal:";
const ACTION_BUTTON_PREFIX = "taixiu:action:";

function normalizeText(input) {
  return (input || "").trim().toLowerCase();
}

function formatNumber(value) {
  return new Intl.NumberFormat("vi-VN").format(Number(value || 0));
}

function formatXu(value) {
  return `🪙 ${formatNumber(value)} Xu`;
}

function getBetKindLabel(kind, target = null) {
  if (kind === "tai") {
    return "Tài (11-18)";
  }
  if (kind === "xiu") {
    return "Xỉu (3-10)";
  }
  if (kind === "chan") {
    return "Chẵn";
  }
  if (kind === "le") {
    return "Lẻ";
  }
  if (kind === "so") {
    return `Số ${target}`;
  }
  return kind;
}

function getPayoutMultiplier(kind) {
  return kind === "so" ? 11 : 2;
}

function createSession({ guildId, channelId, channelName, hostUserId, hostUsername, channel = null }) {
  return {
    guildId,
    channelId,
    channelName,
    hostUserId,
    hostUsername,
    channel,
    phase: "betting",
    statusMessageId: null,
    bets: new Map(),
    createdAt: new Date().toISOString(),
    countdownEndsAt: Date.now() + BETTING_DURATION_MS,
    timeoutId: null,
    reminderIds: [],
    lastRoll: null
  };
}

function parseBetCommand(raw) {
  const trimmed = normalizeText(raw);
  let match = trimmed.match(/^!(tai|xiu|chan|le)\s+(\d+)$/u);
  if (match) {
    return { kind: match[1], target: null, amount: Number(match[2]) };
  }

  match = trimmed.match(/^!so\s+(1[0-8]|[3-9])\s+(\d+)$/u);
  if (match) {
    return { kind: "so", target: Number(match[1]), amount: Number(match[2]) };
  }

  return null;
}

function parseButtonCustomId(customId) {
  if (customId?.startsWith(BET_BUTTON_PREFIX)) {
    const rest = customId.slice(BET_BUTTON_PREFIX.length);
    const [channelId, kind] = rest.split(":");
    if (!channelId || !kind) {
      return null;
    }
    return { type: "bet", channelId, kind };
  }

  if (customId?.startsWith(ACTION_BUTTON_PREFIX)) {
    const rest = customId.slice(ACTION_BUTTON_PREFIX.length);
    const [channelId, action] = rest.split(":");
    if (!channelId || !action) {
      return null;
    }
    return { type: "action", channelId, action };
  }

  return null;
}

function parseModalCustomId(customId) {
  if (!customId?.startsWith(BET_MODAL_PREFIX)) {
    return null;
  }
  const rest = customId.slice(BET_MODAL_PREFIX.length);
  const [channelId, kind] = rest.split(":");
  if (!channelId || !kind) {
    return null;
  }
  return { channelId, kind };
}

function countDownSeconds(session) {
  return Math.max(0, Math.ceil((session.countdownEndsAt - Date.now()) / 1000));
}

function getUserBetList(userBets) {
  return userBets.bets
    .map((bet) => `${getBetKindLabelDisplay(bet.kind, bet.target)}: ${formatXuDisplay(bet.amount)}`)
    .join(", ");
}

function buildBetLines(session) {
  return [...session.bets.entries()]
    .sort((left, right) => {
      const totalLeft = left[1].bets.reduce((sum, bet) => sum + bet.amount, 0);
      const totalRight = right[1].bets.reduce((sum, bet) => sum + bet.amount, 0);
      return totalRight - totalLeft;
    })
    .map(([userId, userBets]) => {
      const totalAmount = userBets.bets.reduce((sum, bet) => sum + bet.amount, 0);
      return `<@${userId}>: ${getUserBetList(userBets)}\nTổng cược: ${formatXuDisplay(totalAmount)}`;
    });
}

function getTotalsByKind(session) {
  const totals = { tai: 0, xiu: 0, chan: 0, le: 0 };
  for (const userBets of session.bets.values()) {
    for (const bet of userBets.bets) {
      if (bet.kind in totals) {
        totals[bet.kind] += bet.amount;
      }
    }
  }
  return totals;
}

function buildBetComponents(session) {
  if (!session || session.phase !== "betting") {
    return [];
  }

  const taiButton = buildBetButtonConfig("tai");
  const xiuButton = buildBetButtonConfig("xiu");
  const chanButton = buildBetButtonConfig("chan");
  const leButton = buildBetButtonConfig("le");
  const soButton = buildBetButtonConfig("so");

  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`${BET_BUTTON_PREFIX}${session.channelId}:tai`).setLabel("Tài").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`${BET_BUTTON_PREFIX}${session.channelId}:xiu`).setLabel("Xỉu").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`${BET_BUTTON_PREFIX}${session.channelId}:chan`).setLabel("Chẵn").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`${BET_BUTTON_PREFIX}${session.channelId}:le`).setLabel("Lẻ").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`${BET_BUTTON_PREFIX}${session.channelId}:so`).setLabel("Số").setStyle(ButtonStyle.Success)
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`${ACTION_BUTTON_PREFIX}${session.channelId}:status`).setLabel("Xem luật").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`${ACTION_BUTTON_PREFIX}${session.channelId}:close`).setLabel("Chốt kèo").setStyle(ButtonStyle.Danger)
    )
  ];
}

function buildStatusEmbed(session, note = "Chờ người chơi đặt cược.") {
  const totals = getTotalsByKind(session);
  return new EmbedBuilder()
    .setColor(0xe67e22)
    .setTitle("Tài Xỉu Jianghu")
    .setDescription(
      [
        `**Trạng thái:** ${session.phase === "betting" ? "Đang nhận cược" : "Đã chốt"}`,
        `**Thời gian còn lại:** ${session.phase === "betting" ? `${countDownSeconds(session)} giây` : "Đã lắc"}`,
        `**Tài:** ${formatXu(totals.tai)}`,
        `**Xỉu:** ${formatXu(totals.xiu)}`,
        `**Chẵn:** ${formatXu(totals.chan)}`,
        `**Lẻ:** ${formatXu(totals.le)}`
      ].join("\n")
    )
    .addFields(
      { name: "Danh sách cược", value: buildBetLines(session).join("\n\n") || "Chưa có ai đặt cược.", inline: false },
      { name: "Ghi chú", value: note, inline: false }
    )
    .setFooter({
      text: "Có thể bấm nút hoặc dùng !tai, !xiu, !chan, !le, !so 18 100. Hết 45 giây bot sẽ tự lắc."
    });
}

function buildStyledBetComponents(session) {
  if (!session || session.phase !== "betting") {
    return [];
  }

  const taiButton = buildBetButtonConfig("tai");
  const xiuButton = buildBetButtonConfig("xiu");
  const chanButton = buildBetButtonConfig("chan");
  const leButton = buildBetButtonConfig("le");
  const soButton = buildBetButtonConfig("so");

  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`${BET_BUTTON_PREFIX}${session.channelId}:tai`).setLabel(taiButton.label).setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`${BET_BUTTON_PREFIX}${session.channelId}:xiu`).setLabel(xiuButton.label).setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`${BET_BUTTON_PREFIX}${session.channelId}:chan`).setLabel(chanButton.label).setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`${BET_BUTTON_PREFIX}${session.channelId}:le`).setLabel(leButton.label).setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`${BET_BUTTON_PREFIX}${session.channelId}:so`).setLabel(soButton.label).setStyle(ButtonStyle.Success)
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`${ACTION_BUTTON_PREFIX}${session.channelId}:status`).setLabel("📜 Xem luật").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`${ACTION_BUTTON_PREFIX}${session.channelId}:close`).setLabel("⏱️ Chốt kèo").setStyle(ButtonStyle.Danger)
    )
  ];
}

function buildStyledStatusEmbed(session, note = "Chờ người chơi đặt cược.") {
  const totals = getTotalsByKind(session);
  return new EmbedBuilder()
    .setColor(0xe67e22)
    .setTitle("🎲 Sòng Bạc Jianghu")
    .setDescription(
      [
        `**Trạng thái:** ${session.phase === "betting" ? "Đang nhận cược" : "Đã chốt kèo"}`,
        `**Thời gian còn lại:** ${session.phase === "betting" ? `${countDownSeconds(session)} giây` : "Đã lắc xong"}`,
        "",
        `🔥 **Tài:** ${formatXuDisplay(totals.tai)}`,
        `🌊 **Xỉu:** ${formatXuDisplay(totals.xiu)}`,
        `⚖️ **Chẵn:** ${formatXuDisplay(totals.chan)}`,
        `🎯 **Lẻ:** ${formatXuDisplay(totals.le)}`
      ].join("\n")
    )
    .addFields(
      { name: "🧾 Bảng cược hiện tại", value: buildBetLines(session).join("\n\n") || "Chưa có ai đặt cược.", inline: false },
      { name: "📢 Thông báo", value: note, inline: false }
    )
    .setFooter({
      text: "Có thể bấm nút hoặc dùng !tai, !xiu, !chan, !le, !so 18 100. Hết 45 giây bot sẽ tự lắc."
    });
}

async function sendOrRefreshStatusMessage(channel, session, note) {
  const payload = { embeds: [buildStyledStatusEmbed(session, note)], components: buildStyledBetComponents(session) };
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

function getHelpText() {
  return [
    "Luật: mở ván rồi mọi người đặt cược bằng Xu đã kiếm được.",
    `Cược tối thiểu: ${MIN_BET} Xu. Cược tối đa mỗi cửa: ${MAX_BET} Xu.`,
    "`!play` hoặc `!batdau` để mở kèo mới.",
    "Có thể bấm nút trên bảng trạng thái để chọn cửa hoặc chốt kèo.",
    "`!tai 100`, `!xiu 100`, `!chan 100`, `!le 100`, `!so 18 100` đều dùng được.",
    "Một người có thể đặt nhiều cửa trong cùng một ván.",
    "Tỷ lệ trả thưởng: Tài/Xỉu/Chẵn/Lẻ x2, Số cụ thể x11.",
    "`!chot` hoặc nút `Chốt kèo` để chốt sớm, nếu không bot sẽ tự lắc sau 45 giây.",
    "`!trangthai` để xem kèo hiện tại.",
    "`!stop` để hủy kèo đang mở và hoàn cược."
  ].join("\n");
}

function buildRoomGuideText() {
  return [
    "**Phòng Tài Xỉu đã sẵn sàng.**",
    "Nhắn `!play` để mở kèo mới.",
    "Có thể bấm nút ngay trên bảng trạng thái để chọn cửa.",
    "Ví dụ gõ tay: `!tai 100`, `!le 200`, `!so 18 500`.",
    "Một người có thể đặt nhiều cửa trong cùng một ván.",
    "Sau 45 giây bot tự lắc, hoặc nhắn `!chot` / bấm `Chốt kèo` để lắc ngay.",
    "`!trangthai` để xem bảng cược, `!stop` để hủy kèo."
  ].join("\n");
}

async function ensureWalletPlayer(userId, username) {
  await ensurePlayer(userId, username);
  return getPlayer(userId);
}

async function adjustPlayerXu(userId, username, amount, type, extra = {}) {
  const player = await ensureWalletPlayer(userId, username);
  const xpGain = extra.xpGain || 0;
  const updated = await updatePlayer(userId, {
    username,
    wallet: { ...player.wallet, xu: player.wallet.xu + amount },
    stats: addPlayerXp(
      { ...player.stats, totalXuEarned: player.stats.totalXuEarned + Math.max(0, amount) },
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

function rollDice() {
  const dice = [1, 2, 3].map(() => Math.floor(Math.random() * 6) + 1);
  const total = dice.reduce((sum, value) => sum + value, 0);
  return {
    dice,
    total,
    taiXiu: total >= 11 ? "tai" : "xiu",
    chanLe: total % 2 === 0 ? "chan" : "le"
  };
}

function clearSessionTimers(session) {
  if (!session) {
    return;
  }
  if (session.timeoutId) {
    clearTimeout(session.timeoutId);
    session.timeoutId = null;
  }
  for (const reminderId of session.reminderIds || []) {
    clearTimeout(reminderId);
  }
  session.reminderIds = [];
}

function buildSettlementEmbed(session, lines, roll) {
  return new EmbedBuilder()
    .setColor(0xf39c12)
    .setTitle("Kết Quả Tài Xỉu")
    .setDescription(
      [
        `🎲 **${roll.dice.join(" - ")}** = **${roll.total}**`,
        `Tài/Xỉu: **${getBetKindLabel(roll.taiXiu)}**`,
        `Chẵn/Lẻ: **${getBetKindLabel(roll.chanLe)}**`
      ].join("\n")
    )
    .addFields({ name: "Tổng kết", value: lines.join("\n").slice(0, 1024), inline: false });
}

function buildSettlementEmbedV2(session, lines, roll) {
  const playerCount = session?.bets?.size || 0;
  const totalStaked = [...(session?.bets?.values() || [])].reduce(
    (sum, userBets) => sum + userBets.bets.reduce((betSum, bet) => betSum + bet.amount, 0),
    0
  );

  return new EmbedBuilder()
    .setColor(0xf39c12)
    .setTitle("🎲 Kết Quả Tài Xỉu")
    .setDescription(
      [
        `🎲 **${roll.dice.join(" - ")}** = **${roll.total}**`,
        `🔥/🌊 Tài Xỉu: **${getBetKindLabelDisplay(roll.taiXiu)}**`,
        `⚖️/🎯 Chẵn Lẻ: **${getBetKindLabelDisplay(roll.chanLe)}**`
      ].join("\n")
    )
    .addFields(
      { name: "👥 Người tham gia", value: String(playerCount), inline: true },
      { name: "🪙 Tổng cược", value: formatXuDisplay(totalStaked), inline: true },
      { name: "📋 Tổng kết", value: lines.join("\n").slice(0, 1024), inline: false }
    );
}

async function settleSession(channel, session, trigger = "auto") {
  if (!session || session.phase !== "betting") {
    return null;
  }
  session.phase = "closed";
  clearSessionTimers(session);
  sessions.delete(session.channelId);

  if (session.bets.size === 0) {
    const noBetMessage =
      trigger === "auto"
        ? "Hết thời gian nhưng chưa có ai đặt cược, kèo Tài Xỉu tự đóng."
        : "Chưa có ai đặt cược nên kèo đã được đóng.";
    await channel.send({ content: noBetMessage, components: [] }).catch(() => {});
    return { ok: false, lines: [noBetMessage] };
  }

  const result = await settleBets(session);
  await channel.send({ embeds: [buildSettlementEmbedV2(session, result.lines, result.roll)] }).catch(() => {});
  return {
    ok: true,
    lines: [
      `Kết quả xúc xắc: 🎲 ${result.roll.dice.join(" - ")} = ${result.roll.total}`,
      `Tài/Xỉu: ${getBetKindLabel(result.roll.taiXiu)}`,
      `Chẵn/Lẻ: ${getBetKindLabel(result.roll.chanLe)}`,
      ...result.lines
    ],
    roll: result.roll
  };
}

function scheduleCountdown(channel, session) {
  clearSessionTimers(session);

  const reminderSchedule = [
    { delayMs: 15000, text: "⏳ Còn 30 giây để đặt cược." },
    { delayMs: 35000, text: "⏳ Còn 10 giây để đặt cược." },
    { delayMs: 40000, text: "⏳ Còn 5 giây để đặt cược." }
  ];

  for (const reminder of reminderSchedule) {
    const reminderId = setTimeout(async () => {
      const liveSession = sessions.get(session.channelId);
      if (!liveSession || liveSession.phase !== "betting") {
        return;
      }
      await channel.send(reminder.text).catch(() => {});
      await sendOrRefreshStatusMessage(channel, liveSession, reminder.text).catch(() => {});
    }, reminder.delayMs);
    session.reminderIds.push(reminderId);
  }

  session.timeoutId = setTimeout(async () => {
    const liveSession = sessions.get(session.channelId);
    if (!liveSession || liveSession.phase !== "betting") {
      return;
    }
    await settleSession(channel, liveSession, "auto");
  }, BETTING_DURATION_MS);
}

function startSession({ guildId, channelId, channelName, hostUserId, hostUsername, channel }) {
  if (!isEnabledRoom(channelId)) {
    throw new Error("Phòng này chưa được bật cho Tài Xỉu. Hãy dùng `/taixiu-tao-phong` trước.");
  }

  const session = createSession({ guildId, channelId, channelName, hostUserId, hostUsername, channel });
  sessions.set(channelId, session);
  if (channel) {
    scheduleCountdown(channel, session);
  }
  return session;
}

function stopSession(channelId) {
  const session = sessions.get(channelId);
  if (!session) {
    return null;
  }
  clearSessionTimers(session);
  sessions.delete(channelId);
  return session;
}

function getSessionStatus(channelId) {
  const session = sessions.get(channelId);
  return session ? { ...session, betLines: buildBetLines(session) } : null;
}

function getRoomConfig(channelId) {
  return getRoom(channelId);
}

async function refundAllBets(session) {
  const refundLines = [];
  for (const [userId, userBets] of session.bets.entries()) {
    const totalRefund = userBets.bets.reduce((sum, bet) => sum + bet.amount, 0);
    const updatedPlayer = await adjustPlayerXu(userId, userBets.username, totalRefund, "taixiu_refund", {
      betCount: userBets.bets.length,
      xpGain: 0
    });
    refundLines.push(`<@${userId}> được hoàn ${formatXu(totalRefund)}. Số dư hiện tại: ${formatXu(updatedPlayer.wallet.xu)}.`);
  }
  return refundLines;
}

function isWinningBet(bet, roll) {
  if (bet.kind === "tai") {
    return roll.taiXiu === "tai";
  }
  if (bet.kind === "xiu") {
    return roll.taiXiu === "xiu";
  }
  if (bet.kind === "chan") {
    return roll.chanLe === "chan";
  }
  if (bet.kind === "le") {
    return roll.chanLe === "le";
  }
  if (bet.kind === "so") {
    return roll.total === bet.target;
  }
  return false;
}

async function settleBets(session) {
  const roll = rollDice();
  session.lastRoll = roll;
  const lines = [];

  for (const [userId, userBets] of session.bets.entries()) {
    const totalStaked = userBets.bets.reduce((sum, bet) => sum + bet.amount, 0);
    let totalPayout = 0;
    let totalXp = 0;
    const winningBetLabels = [];

    for (const bet of userBets.bets) {
      if (isWinningBet(bet, roll)) {
        const payout = bet.amount * getPayoutMultiplier(bet.kind);
        totalPayout += payout;
        totalXp += WIN_XP_GAIN;
        winningBetLabels.push(`${getBetKindLabel(bet.kind, bet.target)}: ${formatXu(payout)}`);
      }
    }

    let updatedPlayer = null;
    if (totalPayout > 0) {
      updatedPlayer = await adjustPlayerXu(userId, userBets.username, totalPayout, "taixiu_win", {
        side: winningBetLabels.join(", "),
        rollTotal: roll.total,
        xpGain: totalXp
      });
    }

    const net = totalPayout - totalStaked;
    let resultText = `<@${userId}> cược ${getUserBetList(userBets)}`;
    if (totalPayout <= 0) {
      resultText += ` và thua ${formatXu(totalStaked)}.`;
    } else if (net > 0) {
      resultText += ` và thắng ${winningBetLabels.join(", ")} (lãi ${formatXu(net)}).`;
    } else if (net === 0) {
      resultText += " và hòa vốn.";
    } else {
      resultText += ` và nhận lại ${formatXu(totalPayout)} nhưng vẫn lỗ ${formatXu(Math.abs(net))}.`;
    }

    if (updatedPlayer) {
      resultText += ` Số dư: ${formatXu(updatedPlayer.wallet.xu)}.`;
    }

    lines.push(resultText);
  }

  return { lines, roll };
}

async function placeBet(session, userId, username, kind, target, amount) {
  if (session.phase !== "betting") {
    return { ok: false, reply: "Kèo này đã chốt rồi. Hãy mở kèo mới bằng `!play`." };
  }
  if (!Number.isInteger(amount) || amount < MIN_BET || amount > MAX_BET) {
    return { ok: false, reply: `Số cược phải từ ${formatNumber(MIN_BET)} đến ${formatNumber(MAX_BET)} Xu.` };
  }
  if (kind === "so" && (!Number.isInteger(target) || target < 3 || target > 18)) {
    return { ok: false, reply: "Số cụ thể chỉ nhận từ 3 đến 18." };
  }

  const player = await ensureWalletPlayer(userId, username);
  if (player.wallet.xu < amount) {
    return { ok: false, reply: `Bạn không đủ Xu để cược. Số dư hiện tại: ${formatXu(player.wallet.xu)}.` };
  }

  const updatedPlayer = await adjustPlayerXu(userId, username, -amount, "taixiu_bet", {
    side: getBetKindLabel(kind, target),
    betType: kind,
    target,
    xpGain: BET_XP_GAIN
  });

  const existing = sessions.get(session.channelId)?.bets.get(userId) || { username, bets: [] };
  existing.username = username;
  existing.bets.push({ kind, target, amount });
  session.bets.set(userId, existing);

  return {
    ok: true,
    reply: `Đã đặt ${formatXu(amount)} vào cửa **${getBetKindLabel(kind, target)}**. +${BET_XP_GAIN} XP. Số dư còn lại: ${formatXu(updatedPlayer.wallet.xu)}.`
  };
}

function buildBetModal(channelId, kind) {
  const modal = new ModalBuilder().setCustomId(`${BET_MODAL_PREFIX}${channelId}:${kind}`).setTitle(`Đặt cược ${getBetKindLabel(kind)}`);
  const rows = [];

  if (kind === "so") {
    rows.push(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("target")
          .setLabel("Nhập số muốn cược (3 - 18)")
          .setPlaceholder("Ví dụ: 18")
          .setRequired(true)
          .setStyle(TextInputStyle.Short)
      )
    );
  }

  rows.push(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("amount")
        .setLabel(`Nhập số Xu (${MIN_BET} - ${MAX_BET})`)
        .setPlaceholder("Ví dụ: 1000")
        .setRequired(true)
        .setStyle(TextInputStyle.Short)
    )
  );

  modal.addComponents(...rows);
  return modal;
}

function getModalLockKey(channelId, userId) {
  return `${channelId}:${userId}`;
}

function isModalLocked(channelId, userId) {
  const key = getModalLockKey(channelId, userId);
  const lockedUntil = modalLocks.get(key) || 0;
  return lockedUntil > Date.now();
}

function lockModal(channelId, userId) {
  const key = getModalLockKey(channelId, userId);
  modalLocks.set(key, Date.now() + MODAL_LOCK_MS);
}

async function handleBetButtonInteraction(interaction) {
  const parsed = parseButtonCustomId(interaction.customId);
  if (!parsed) {
    return false;
  }

  const session = sessions.get(parsed.channelId);
  if (!session || session.phase !== "betting") {
    await interaction.reply({ content: "Kèo này không còn mở để đặt cược nữa.", ephemeral: true });
    return true;
  }

  if (interaction.channelId !== parsed.channelId) {
    await interaction.reply({ content: "Hãy đặt cược trong đúng phòng Tài Xỉu.", ephemeral: true });
    return true;
  }

  if (parsed.type === "action") {
    if (parsed.action === "status") {
      await interaction.reply({ content: getHelpText(), ephemeral: true });
      return true;
    }
    if (parsed.action === "close") {
      if (session.bets.size === 0) {
        await interaction.reply({ content: "Chưa có ai đặt cược, chưa thể chốt kèo.", ephemeral: true });
        return true;
      }
      await interaction.deferReply({ ephemeral: true });
      await settleSession(interaction.channel, session, "manual");
      await interaction.editReply("Đã chốt kèo Tài Xỉu.");
      return true;
    }
  }

  if (isModalLocked(parsed.channelId, interaction.user.id)) {
    await interaction.reply({ content: "Bạn vừa mở form cược rồi. Chờ vài giây rồi thử lại nhé.", ephemeral: true });
    return true;
  }

  lockModal(parsed.channelId, interaction.user.id);
  await interaction.showModal(buildBetModal(parsed.channelId, parsed.kind));
  return true;
}

async function handleBetModalInteraction(interaction) {
  const parsed = parseModalCustomId(interaction.customId);
  if (!parsed) {
    return false;
  }

  const session = sessions.get(parsed.channelId);
  if (!session || session.phase !== "betting") {
    await interaction.reply({ content: "Kèo này đã đóng hoặc không còn tồn tại.", ephemeral: true });
    return true;
  }

  await interaction.deferReply({ ephemeral: true });
  const amount = Number(interaction.fields.getTextInputValue("amount"));
  const target = parsed.kind === "so" ? Number(interaction.fields.getTextInputValue("target")) : null;
  const result = await placeBet(session, interaction.user.id, interaction.user.username, parsed.kind, target, amount);

  if (result.ok && interaction.channel) {
    await sendOrRefreshStatusMessage(
      interaction.channel,
      session,
      `<@${interaction.user.id}> vừa đặt ${formatXu(amount)} vào cửa ${getBetKindLabel(parsed.kind, target)}.`
    ).catch(() => {});
  }

  await interaction.editReply({ content: result.reply });
  return true;
}

async function handleMessage(message) {
  if (!isEnabledRoom(message.channel.id)) {
    return null;
  }

  const raw = (message.content || "").trim();
  const lowered = normalizeText(raw);
  let session = sessions.get(message.channel.id);

  if (!session) {
    if (HELP_KEYWORDS.has(lowered)) {
      return { ok: true, skipReaction: true, reply: getHelpText() };
    }
    if (STATUS_KEYWORDS.has(lowered)) {
      return { ok: true, skipReaction: true, reply: "Hiện chưa có kèo Tài Xỉu nào đang mở." };
    }
    if (STOP_KEYWORDS.has(lowered)) {
      return { ok: true, skipReaction: true, reply: "Hiện chưa có kèo Tài Xỉu nào để hủy." };
    }
    if (!START_KEYWORDS.has(lowered)) {
      return null;
    }

    session = startSession({
      guildId: message.guild.id,
      channelId: message.channel.id,
      channelName: message.channel.name || "unknown",
      hostUserId: message.author.id,
      hostUsername: message.author.username,
      channel: message.channel
    });

    await sendOrRefreshStatusMessage(message.channel, session, `Kèo mới đã được mở bởi <@${message.author.id}>.`);
    return {
      ok: true,
      skipReaction: true,
      reply: "Đã mở kèo **Tài Xỉu** mới. Có thể bấm nút trên bảng hoặc dùng `!tai`, `!xiu`, `!chan`, `!le`, `!so 18 100`."
    };
  }

  if (HELP_KEYWORDS.has(lowered)) {
    return { ok: true, skipReaction: true, reply: getHelpText() };
  }
  if (STATUS_KEYWORDS.has(lowered)) {
    await sendOrRefreshStatusMessage(message.channel, session, "Đây là trạng thái hiện tại của kèo.");
    return { ok: true, skipReaction: true, reply: "Đã cập nhật bảng trạng thái kèo." };
  }
  if (STOP_KEYWORDS.has(lowered)) {
    const stoppedSession = stopSession(message.channel.id);
    const refunds = await refundAllBets(stoppedSession);
    return { ok: true, skipReaction: true, reply: `Đã hủy kèo Tài Xỉu hiện tại. ${refunds.join(" ")}` };
  }

  const betCommand = parseBetCommand(raw);
  if (betCommand) {
    const result = await placeBet(session, message.author.id, message.author.username, betCommand.kind, betCommand.target, betCommand.amount);
    if (result.ok) {
      await sendOrRefreshStatusMessage(
        message.channel,
        session,
        `<@${message.author.id}> vừa đặt ${formatXu(betCommand.amount)} vào cửa ${getBetKindLabel(betCommand.kind, betCommand.target)}.`
      );
    }
    return { ok: result.ok, skipReaction: result.ok, reply: result.reply, react: result.ok ? "success" : "failure" };
  }

  if (CLOSE_KEYWORDS.has(lowered)) {
    if (session.bets.size === 0) {
      return { ok: false, skipReaction: true, reply: "Chưa có ai đặt cược, chưa thể chốt kèo." };
    }
    const settled = await settleSession(message.channel, session, "manual");
    return { ok: true, skipReaction: true, silent: true, reply: settled?.lines?.join("\n") || "Kèo đã được chốt." };
  }

  if (START_KEYWORDS.has(lowered)) {
    return { ok: true, skipReaction: true, reply: "Kèo hiện tại đang mở rồi. Hãy đặt cược hoặc đợi bot tự lắc sau 45 giây." };
  }

  return null;
}

module.exports = {
  handleMessage,
  handleBetButtonInteraction,
  handleBetModalInteraction,
  startSession,
  stopSession,
  getSessionStatus,
  getRoomConfig,
  getHelpText,
  buildRoomGuideText,
  buildStatusEmbed
};
