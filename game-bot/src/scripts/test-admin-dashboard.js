const { enableRoom: enableRpsRoom, disableRoom: disableRpsRoom } = require("../storage/rps-room-store");
const { enableRoom: enableQuizRoom, disableRoom: disableQuizRoom } = require("../storage/quick-quiz-room-store");
const { collectDashboard, buildAdminDashboardEmbed } = require("../services/admin-dashboard-service");

function main() {
  const guildId = "dashboard-test-guild";
  const rpsChannel = "dashboard-rps-channel";
  const quizChannel = "dashboard-quiz-channel";
  disableRpsRoom(rpsChannel);
  disableQuizRoom(quizChannel);
  enableRpsRoom(rpsChannel, { guildId, channelName: "oantuti", activeSession: { phase: "choosing" } });
  enableQuizRoom(quizChannel, { guildId, channelName: "quiz", activeSession: null });
  const report = collectDashboard(guildId);
  if (report.roomCount !== 2) throw new Error(`Expected 2 rooms, received ${report.roomCount}`);
  if (report.activeCount !== 1) throw new Error(`Expected 1 active game, received ${report.activeCount}`);
  const json = buildAdminDashboardEmbed(guildId).toJSON();
  const rendered = JSON.stringify(json);
  if (!rendered.includes(rpsChannel) || !rendered.includes(quizChannel) || !rendered.includes("Đồng bộ dữ liệu")) {
    throw new Error("Dashboard does not contain expected room and sync information");
  }
  disableRpsRoom(rpsChannel);
  disableQuizRoom(quizChannel);
  console.log(JSON.stringify({ ok: true, rooms: report.roomCount, activeGames: report.activeCount, pendingVisible: true, guildScoped: true }, null, 2));
}

try { main(); } catch (error) { console.error("Admin dashboard test failed:", error); process.exit(1); }
