const { SlashCommandBuilder } = require("discord.js");
const { distributeFinalRewards, stopSession } = require("../services/word-chain-service");

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
        ? "Chưa có ai ghi điểm."
        : [...session.scores.entries()]
            .sort((a, b) => b[1] - a[1])
            .map(([userId, score], index) => `${index + 1}. <@${userId}>: ${score} điểm`)
            .join("\n");

    const rewardResult = await distributeFinalRewards(session);

    await interaction.reply(
      [
        "Đã dừng ván nối từ.",
        `Tổng số lượt hợp lệ: ${session.moveCount}`,
        `Bảng điểm:\n${scoreboard}`,
        `Thưởng cuối ván:\n${rewardResult.lines.join("\n")}`
      ].join("\n")
    );
  }
};
