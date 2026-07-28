const { SlashCommandBuilder } = require("discord.js");
const { distributeFinalRewards, stopSession } = require("../services/vietnamese-king-service");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("vuatiengviet-dung")
    .setDescription("Dừng ván Vua Tiếng Việt hiện tại."),
  async execute(interaction) {
    const session = stopSession(interaction.channelId);

    if (!session) {
      await interaction.reply("Không có ván Vua Tiếng Việt nào đang chạy để dừng.");
      return;
    }

    const scoreboardEntries = [...session.scores.entries()].sort((a, b) => b[1] - a[1]);
    const scoreboard =
      scoreboardEntries.length === 0
        ? "Chưa có ai ghi điểm."
        : scoreboardEntries.map(([userId, score], index) => `${index + 1}. <@${userId}>: ${score} điểm`).join("\n");

    const rewardResult = await distributeFinalRewards(session);

    await interaction.reply({
      embeds: [
        {
          color: 0xe67e22,
          title: "Kết thúc ván Vua Tiếng Việt",
          fields: [
            { name: "Tổng câu đã giải", value: String(session.moveCount), inline: true },
            { name: "Bảng điểm", value: scoreboard, inline: false },
            { name: "Thưởng cuối ván", value: rewardResult.lines.join("\n"), inline: false }
          ]
        }
      ]
    });
  }
};
