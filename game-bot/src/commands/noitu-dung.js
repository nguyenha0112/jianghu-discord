const { SlashCommandBuilder } = require("discord.js");
const { stopSession } = require("../services/word-chain-service");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("noitu-dung")
    .setDescription("Dừng ván nối từ hiện tại."),
  async execute(interaction) {
    const session = stopSession(interaction.channelId);

    if (!session) {
      await interaction.reply("Không có ván nối từ nào đang chạy để dừng.");
      return;
    }

    const scoreboard =
      session.scores.size === 0
        ? "Chua co ai ghi diem."
        : [...session.scores.entries()]
            .sort((a, b) => b[1] - a[1])
            .map(([userId, score]) => `<@${userId}>: ${score}`)
            .join("\n");

    await interaction.reply(
      [
        "Đã dừng ván nối từ.",
        `Tổng số lượt hợp lệ: ${session.moveCount}`,
        `Bảng điểm:\n${scoreboard}`
      ].join("\n")
    );
  }
};
