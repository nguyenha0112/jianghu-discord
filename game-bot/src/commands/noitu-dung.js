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

    const scoreboardEntries = [...session.scores.entries()]
      .filter(([userId]) => userId !== "jianghu-pve-bot")
      .sort((a, b) => b[1] - a[1]);

    const scoreboard =
      scoreboardEntries.length === 0
        ? "Chưa có ai ghi điểm."
        : scoreboardEntries.map(([userId, score], index) => `${index + 1}. <@${userId}>: ${score} điểm`).join("\n");

    const rewardResult = await distributeFinalRewards(session);

    await interaction.reply({
      embeds: [
        {
          color: 0xe67e22,
          title: `Kết thúc ván nối từ ${session.mode.toUpperCase()}`,
          fields: [
            { name: "Tổng lượt hợp lệ", value: String(session.moveCount), inline: true },
            { name: "Chuỗi hiện tại", value: String(session.currentStreak), inline: true },
            { name: "Bảng điểm", value: scoreboard },
            { name: "Thưởng cuối ván", value: rewardResult.lines.join("\n") }
          ]
        }
      ]
    });
  }
};
