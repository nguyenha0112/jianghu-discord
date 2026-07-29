const { SlashCommandBuilder } = require("discord.js");
const { buildStatusEmbed, getRoomConfig, getSessionStatus } = require("../services/word-chain-service");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("noitu-trangthai")
    .setDescription("Xem trang thai van noi tu hien tai."),
  async execute(interaction) {
    const roomConfig = getRoomConfig(interaction.channelId);
    if (!roomConfig) {
      await interaction.reply("Phòng này chưa được cấu hình là phòng nối từ.");
      return;
    }

    const session = getSessionStatus(interaction.channelId);
    if (!session) {
      await interaction.reply("Phòng này đã bật nối từ nhưng hiện chưa có ván nào đang chạy. Nhắn `!play` để mở ván nhanh hoặc dùng `/noitu-tao` nếu muốn tự chọn cụm mở đầu.");
      return;
    }

    const embed = buildStatusEmbed(session, {
      accent: 0x2ecc71,
      lastMoveLine: "Đây là trạng thái hiện tại của ván."
    });

    await interaction.reply({ embeds: [embed] });
  }
};
