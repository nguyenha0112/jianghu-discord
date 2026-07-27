const { EmbedBuilder, SlashCommandBuilder } = require("discord.js");
const { getRoomConfig, getSessionStatus } = require("../services/word-chain-service");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("noitu-trangthai")
    .setDescription("Xem trạng thái ván nối từ hiện tại."),
  async execute(interaction) {
    const roomConfig = getRoomConfig(interaction.channelId);
    if (!roomConfig) {
      await interaction.reply("Phòng này chưa được cấu hình là phòng nối từ.");
      return;
    }

    const session = getSessionStatus(interaction.channelId);

    if (!session) {
      await interaction.reply(
        "Phòng này đã bật nối từ nhưng hiện chưa có ván nào đang chạy. Dùng `/noitu-tao` để bắt đầu."
      );
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle("Trạng thái Nối Từ")
      .addFields(
        { name: "Chủ phòng", value: session.hostUsername, inline: true },
        { name: "Trạng thái", value: session.paused ? "Đang tạm dừng" : "Đang chạy", inline: true },
        { name: "Cụm từ hiện tại", value: session.currentPhrase, inline: false },
        { name: "Từ cần nối tiếp", value: session.requiredToken, inline: true },
        { name: "Số lượt hợp lệ", value: String(session.moveCount), inline: true },
        {
          name: "Bảng điểm",
          value: session.scoreboard.length > 0 ? session.scoreboard.join("\n") : "Chưa có điểm.",
          inline: false
        },
        {
          name: "Cách chơi nhanh",
          value:
            "Gõ cụm từ trực tiếp trong phòng. Dùng `!stop` để tạm dừng, `!play` để tiếp tục. Chỉ các cụm tiếng Việt có nghĩa trong từ điển mới được tính.",
          inline: false
        }
      );

    await interaction.reply({ embeds: [embed] });
  }
};
