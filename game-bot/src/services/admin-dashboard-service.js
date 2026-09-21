const { EmbedBuilder } = require("discord.js");
const wordChainStore = require("../storage/word-chain-room-store");
const vietnameseKingStore = require("../storage/vietnamese-king-room-store");
const taiXiuStore = require("../storage/taixiu-room-store");
const bauCuaStore = require("../storage/baucua-room-store");
const xiDachStore = require("../storage/xidach-room-store");
const rpsStore = require("../storage/rps-room-store");
const quickQuizStore = require("../storage/quick-quiz-room-store");
const levelUpStore = require("../storage/levelup-room-store");
const serverLogStore = require("../storage/serverlog-room-store");
const { getSessionStatus: getWordChainSession } = require("./word-chain-service");
const { getSessionStatus: getVietnameseKingSession } = require("./vietnamese-king-service");
const { getSessionStatus: getTaiXiuSession } = require("./taixiu-service");
const { getSessionStatus: getBauCuaSession } = require("./baucua-service");
const { getSessionStatus: getXiDachSession } = require("./xidach-service");
const { getSessionStatus: getRpsSession } = require("./rps-service");
const { getSessionStatus: getQuickQuizSession } = require("./quick-quiz-service");

const STORE_DEFINITIONS = [
  { key: "word_chain", name: "Nối Từ", store: wordChainStore, kind: "game", getSession: getWordChainSession },
  { key: "vietnamese_king", name: "Vua Tiếng Việt", store: vietnameseKingStore, kind: "game", getSession: getVietnameseKingSession },
  { key: "taixiu", name: "Tài Xỉu", store: taiXiuStore, kind: "game", getSession: getTaiXiuSession },
  { key: "baucua", name: "Bầu Cua", store: bauCuaStore, kind: "game", getSession: getBauCuaSession },
  { key: "xidach", name: "Xì Dách", store: xiDachStore, kind: "game", getSession: getXiDachSession },
  { key: "rock_paper_scissors", name: "Oẳn Tù Tì", store: rpsStore, kind: "game", getSession: getRpsSession },
  { key: "quick_quiz", name: "Quiz Nhanh", store: quickQuizStore, kind: "game", getSession: getQuickQuizSession },
  { key: "levelup_notifications", name: "Thông báo lên cấp", store: levelUpStore, kind: "system" },
  { key: "serverlog_notifications", name: "Log rời server", store: serverLogStore, kind: "system" }
];

function roomBelongsToGuild(room, guildId, storageKey) {
  return room.guildId === guildId || storageKey === guildId;
}

function collectDashboard(guildId) {
  const items = STORE_DEFINITIONS.map((definition) => {
    const rooms = Object.entries(definition.store.listRooms())
      .filter(([storageKey, room]) => room.enabled && roomBelongsToGuild(room, guildId, storageKey))
      .map(([storageKey, room]) => ({
        channelId: room.channelId || storageKey,
        channelName: room.channelName || "không rõ",
        active: Boolean(definition.getSession?.(room.channelId || storageKey) || room.activeSession),
        mode: room.mode || null
      }));
    return { ...definition, rooms, sync: definition.store.getSyncStatus() };
  });
  return {
    items,
    roomCount: items.reduce((sum, item) => sum + item.rooms.length, 0),
    activeCount: items.reduce((sum, item) => sum + item.rooms.filter((room) => room.active).length, 0),
    pendingTotal: items.reduce((sum, item) => sum + item.sync.pendingTotal, 0)
  };
}

function roomSummary(item) {
  if (item.rooms.length === 0) return `⚪ **${item.name}:** chưa cấu hình`;
  const rooms = item.rooms.map((room) => {
    const mode = room.mode ? ` ${room.mode.toUpperCase()}` : "";
    return `<#${room.channelId}>${mode}${room.active ? " • đang chơi" : ""}`;
  });
  return `🟢 **${item.name}:** ${rooms.join(", ")}`;
}

function buildAdminDashboardEmbed(guildId) {
  const report = collectDashboard(guildId);
  const gameLines = report.items.filter((item) => item.kind === "game").map(roomSummary);
  const systemLines = report.items.filter((item) => item.kind === "system").map(roomSummary);
  const syncText = report.pendingTotal === 0
    ? "✅ Không có thay đổi phòng nào đang chờ đồng bộ."
    : `⚠️ Có **${report.pendingTotal}** thay đổi phòng đang chờ Supabase. Bot vẫn dùng bản local và sẽ tự thử lại.`;
  return new EmbedBuilder()
    .setColor(report.pendingTotal === 0 ? 0x2ecc71 : 0xf39c12)
    .setTitle("🛠️ Trạng thái Jianghu Game Bot")
    .setDescription(`**${report.roomCount} phòng** đã cấu hình • **${report.activeCount} ván** đang hoạt động`)
    .addFields(
      { name: "🎮 Phòng game", value: gameLines.join("\n") || "Chưa có phòng game." },
      { name: "📣 Phòng hệ thống", value: systemLines.join("\n") || "Chưa có phòng hệ thống." },
      { name: "☁️ Đồng bộ dữ liệu", value: syncText }
    )
    .setFooter({ text: "Bảng chỉ hiển thị cấu hình thuộc server hiện tại." })
    .setTimestamp();
}

module.exports = { collectDashboard, buildAdminDashboardEmbed };
